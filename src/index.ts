import express from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from 'zod';
import { getAllSkills, getSkillByName, searchSkills } from './skills.js';

const execFileAsync = promisify(execFile);

const app = express();
app.use(cors());

// ponytail: un McpServer nuevo por conexión - el SDK no permite conectar una
// misma instancia a más de un transporte a la vez (Protocol es 1:1).
async function createServer(): Promise<McpServer> {
  const skills = await getAllSkills();

  // `instructions` se inyecta en el system prompt del cliente al conectar:
  // es la "memoria inicial" de OT. Incluye el catálogo (para que el modelo
  // sepa qué existe sin llamar tools) y el contexto global del usuario si
  // existe ~/.ot/skills/_global-context.md.
  const catalog = skills
    .map(s => `- ${s.name}: ${s.description || '(sin descripción)'}`)
    .join('\n');
  const globalContext = skills.find(s => s.name === '_global-context');
  const instructions =
    `OT es el catálogo personal de skills e instrucciones del usuario, compartido entre todos sus clientes de IA. ` +
    `Usa get_skill(name) para leer una skill completa cuando su descripción aplique a la tarea actual.\n\n` +
    `Skills disponibles:\n${catalog}` +
    (globalContext ? `\n\n## Contexto global del usuario (aplícalo siempre):\n\n${globalContext.content}` : '');

  const server = new McpServer(
    { name: "ot-mcp-server", version: "1.0.0" },
    { instructions }
  );

  server.tool(
    "list_skills",
    "Devuelve el catálogo de skills disponibles (nombres, descripciones, tags).",
    {},
    async () => {
      const skills = await getAllSkills();
      const catalog = skills.map(s => ({
        name: s.name,
        description: s.description,
        tags: s.tags,
        scope: s.scope
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(catalog, null, 2) }]
      };
    }
  );

  server.tool(
    "get_skill",
    "Obtiene el contenido completo de una skill por su nombre.",
    {
      name: z.string().describe("El nombre de la skill (ej. 'ejemplo-global')")
    },
    async ({ name }) => {
      const skill = await getSkillByName(name);
      if (!skill) {
        return {
          content: [{ type: "text", text: `Error: Skill '${name}' no encontrada.` }],
          isError: true
        };
      }
      return {
        content: [{ type: "text", text: skill.content }]
      };
    }
  );

  server.tool(
    "search_skills",
    "Busca skills por una palabra clave (en el nombre, descripción o contenido).",
    {
      query: z.string().describe("Palabra clave a buscar")
    },
    async ({ query }) => {
      const results = await searchSkills(query);
      const catalog = results.map(s => ({
        name: s.name,
        description: s.description,
        tags: s.tags
      }));
      return {
        content: [{ type: "text", text: JSON.stringify(catalog, null, 2) }]
      };
    }
  );

  server.tool(
    "convert_to_markdown",
    "Convierte un archivo (PDF, DOCX, PPTX, XLSX, HTML, audio, imagen) o una URL a texto Markdown usando MarkItDown.",
    {
      source: z.string().describe("Ruta de archivo o URL a convertir")
    },
    async ({ source }) => {
      try {
        // execFile (no exec/shell) - `source` viene del cliente MCP, no confiar en él para interpolar un shell.
        const { stdout } = await execFileAsync('markitdown', [source]);
        return { content: [{ type: "text", text: stdout }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error convirtiendo '${source}': ${(err as Error).message}` }],
          isError: true
        };
      }
    }
  );

  // Cada skill se expone también como prompt (slash command en Claude Code,
  // Cursor, etc.) y como resource (adjuntable con @) — así una skill de
  // comportamiento (ej. ponytail) se activa en cualquier cliente MCP sin
  // copiar archivos. ponytail: se registran al conectar; skills nuevas
  // aparecen en la próxima conexión del cliente.
  for (const skill of skills) {
    const content = skill.content;

    server.prompt(
      skill.name,
      skill.description || `Skill '${skill.name}' del catálogo OT`,
      async () => ({
        messages: [{
          role: "user" as const,
          content: { type: "text" as const, text: content }
        }]
      })
    );

    server.resource(
      skill.name,
      `skill://${skill.name}`,
      { description: skill.description, mimeType: "text/markdown" },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: content }]
      })
    );
  }

  return server;
}

// --- Transporte moderno: Streamable HTTP (stateless) ---
// ponytail: modo stateless (server+transport por request), sin gestión de
// sesiones; pasar a sessionIdGenerator si algún cliente exige sesión.
app.post("/mcp", express.json(), async (req, res) => {
  const server = await createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Usa POST /mcp (modo stateless)." },
    id: null
  });
});

// --- Transporte legacy: SSE (para clientes que aún no soportan Streamable HTTP) ---
// ponytail: un transporte por sesión (Map), no una variable global -
// necesario para soportar clientes MCP concurrentes.
const transports = new Map<string, SSEServerTransport>();

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  // Registrar antes de connect: el cliente puede POSTear a /messages apenas
  // recibe el evento endpoint que dispara connect().
  transports.set(transport.sessionId, transport);
  console.log(`Client connected (SSE): ${transport.sessionId}`);

  res.on('close', () => {
    console.log(`Client disconnected (SSE): ${transport.sessionId}`);
    transports.delete(transport.sessionId);
  });

  await (await createServer()).connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);
  if (!transport) {
    res.status(400).send("No hay conexión SSE activa para ese sessionId");
    return;
  }
  await transport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`OT MCP Server corriendo en http://localhost:${PORT}`);
  console.log(`Endpoint Streamable HTTP (recomendado): http://localhost:${PORT}/mcp`);
  console.log(`Endpoint SSE (legacy): http://localhost:${PORT}/sse`);
});

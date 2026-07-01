import express from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from 'zod';
import { getAllSkills, getSkillByName, searchSkills } from './skills.js';

const execFileAsync = promisify(execFile);

const app = express();
app.use(cors());

// Un McpServer nuevo por conexión, ya que el SDK no permite conectar una
// misma instancia a más de un transporte a la vez.
function createServer(): McpServer {
  const server = new McpServer({
    name: "ot-mcp-server",
    version: "1.0.0"
  });

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

  return server;
}

// Mapa para soportar clientes MCP concurrentes
const transports = new Map<string, SSEServerTransport>();

app.get("/sse", async (req, res) => {
  console.log("Client connecting...");
  const transport = new SSEServerTransport("/messages", res);
  
  const serverInstance = createServer();
  await serverInstance.connect(transport);
  
  transports.set(transport.sessionId, transport);
  console.log(`Client connected: ${transport.sessionId}`);

  res.on('close', () => {
    console.log(`Client disconnected: ${transport.sessionId}`);
    transports.delete(transport.sessionId);
  });
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
  console.log(`Endpoint SSE: http://localhost:${PORT}/sse`);
});

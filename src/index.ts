import express from 'express';
import cors from 'cors';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from 'zod';
import { getAllSkills, getSkillByName, searchSkills } from './skills.js';

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

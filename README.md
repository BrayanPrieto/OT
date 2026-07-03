# OT — Orquestador MCP Transparente

OT es un servicio local, persistente, que corre en tu máquina y actúa como **fuente única de verdad de skills y contexto** para todos tus clientes de Inteligencia Artificial que soporten el protocolo MCP (Model Context Protocol), como Claude Code, Cursor, OpenCode, Antigravity CLI, etc.

En lugar de copiar tus archivos `.md` de instrucciones de un cliente a otro, OT los sirve a través de un único servidor. ¡Un servidor, muchos clientes, cero duplicación!

## Características (Fase 1)

- **Servidor MCP nativo:** Escrito en Node.js, usando el SDK oficial `@modelcontextprotocol/sdk`.
- **Doble transporte:** Streamable HTTP (`/mcp`, el estándar moderno, recomendado) y SSE (`/sse`, legacy para clientes viejos).
- **Skills como Prompts MCP:** cada skill del catálogo se expone como *prompt* MCP — en Claude Code, Cursor y otros clientes aparecen como slash commands (ej. `/mcp__ot__ponytail`). Así activas una skill de comportamiento en cualquier cliente **sin copiar archivos**.
- **Skills como Resources MCP:** cada skill también es un resource (`skill://nombre`) que los clientes pueden adjuntar como contexto (ej. con `@` en Claude Code).
- **Tools Integradas:**
  - `list_skills`: Devuelve el catálogo completo de skills instaladas.
  - `get_skill`: Recupera el texto íntegro de una skill.
  - `search_skills`: Búsqueda de skills por palabra clave.
  - `convert_to_markdown`: Convierte un archivo o URL (PDF, DOCX, PPTX, XLSX, audio, imagen) a Markdown vía [MarkItDown](https://github.com/microsoft/markitdown).
- **Sync a clientes nativos (`npm run sync`):** para skills que deben estar *siempre activas* (no bajo demanda), OT genera los archivos nativos (`SKILL.md`) en los directorios de cada cliente configurados en `ot-config.json` → `syncTargets.skillDirs`. `~/.ot` sigue siendo la única fuente de verdad; nunca sobreescribe skills creadas a mano.
- **Skills Remotas ("Zero Config"):** Posibilidad de agregar repositorios externos (ej. la regla global *ponytail*). Al hacer `npm install`, estos repositorios se descargan y sincronizan en `~/.ot/remote-skills/`, fuera del repositorio principal de OT.
- **Fuente única en `~/.ot/`:** el catálogo de skills vive en una carpeta fija de tu máquina, no en el directorio desde el que se ejecuta el proceso — así da igual desde dónde arranques el servidor (o si corre dentro de Docker).
- **Soporte de Frontmatter:** Parsea y extrae metadatos en formato YAML (descripción, tags, scope) desde los archivos `.md` locales y remotos.

## Requisitos

- Node.js (v18+)
- NPM o Yarn
- Git (para sincronizar skills remotas)

## Instalación

Clona el repositorio y ejecuta la instalación. Gracias al script `postinstall`, OT descargará automáticamente cualquier skill remota configurada (como `ponytail` por defecto).

```bash
git clone https://github.com/BrayanPrieto/OT.git
cd OT
npm install
```

## Uso

1. **Levantar el servidor:**

   Local:
   ```bash
   npm start
   ```

   Con Docker / OrbStack (recomendado para que corra persistente en background):
   ```bash
   docker compose up --build -d
   ```

   *Esto iniciará el servidor en `http://localhost:3001`.*

2. **Configurar tu cliente MCP:**
   Apunta la configuración MCP de tu IA al endpoint Streamable HTTP:
   ```text
   http://localhost:3001/mcp
   ```
   Ejemplo con Claude Code:
   ```bash
   claude mcp add --transport http ot http://localhost:3001/mcp
   ```
   Si tu cliente solo soporta SSE (legacy), usa `http://localhost:3001/sse`.

3. **Usar una skill desde cualquier cliente:**
   - Como slash command: `/mcp__ot__ponytail` (prompts MCP).
   - Como contexto: adjunta el resource `skill://ponytail`.
   - Bajo demanda: el modelo llama `list_skills` / `get_skill` solo.

4. **Skills siempre-activas (sync):**
   ```bash
   npm run sync
   ```
   Genera `SKILL.md` nativos en los directorios configurados (por defecto `~/.claude/skills`). Edita `syncTargets.skillDirs` en `ot-config.json` para agregar más clientes.

## Añadir Skills y Tools

Ver [SKILLS.md](./SKILLS.md) para el detalle de cómo agregar skills locales,
skills remotas (repos git) y nuevos tools al servidor MCP.

## Estructura del Proyecto

- `src/index.ts`: Punto de entrada del servidor Express y configuración MCP.
- `src/skills.ts`: Motor de búsqueda y parseo de archivos Markdown.
- `scripts/sync-skills.js`: Script de clonación/sincronización de repos remotos.
- `scripts/ot-cli.ts`: CLI mínima (`npm run cli -- list|add-skill`).
- `scripts/export-agents.ts`: Genera `AGENTS.md` para clientes no-MCP (`npm run export-agents`).
- `ot-config.json`: Archivo de manifiesto para skills remotas.
- `Dockerfile` / `docker-compose.yml`: para correr OT persistente vía Docker/OrbStack.
- `~/.ot/skills/`, `~/.ot/remote-skills/`: fuente única de verdad del catálogo (fuera del repo).

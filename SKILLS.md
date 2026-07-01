# Cómo agregar cosas a OT

OT lee todo desde `~/.ot/` (fijo, no depende de dónde lo corras ni de si usas Docker).
Dentro de esa carpeta:

- `~/.ot/skills/` — tus skills locales.
- `~/.ot/remote-skills/` — repos git clonados automáticamente (gestionados por `sync-skills.js`, no tocar a mano).

Si corres OT con Docker Compose, `~/.ot` de tu máquina (host) se monta dentro del contenedor, así que sigues editando en tu Mac normal.

## 1. Agregar una skill local

Crea un `.md` en `~/.ot/skills/`, por ejemplo `~/.ot/skills/mi-skill.md`:

```markdown
---
name: mi-skill
description: Cuándo debe usarse esta skill (esto es lo que ven los clientes MCP en list_skills)
tags: [tag1, tag2]
scope: global
---

Contenido / instrucciones de la skill.
```

No hace falta reiniciar nada del lado del cliente: la próxima vez que llame a
`list_skills`, `get_skill` o `search_skills`, el servidor vuelve a leer el
archivo (no hay caché).

## 2. Agregar una skill remota (repo de git)

Edita `ot-config.json` en la raíz del proyecto:

```json
{
  "remoteSkills": [
    { "name": "ponytail", "url": "https://github.com/DietrichGebert/ponytail.git" },
    { "name": "mi-repo", "url": "https://github.com/usuario/mi-repo.git" }
  ]
}
```

Luego sincroniza:

```bash
node scripts/sync-skills.js   # o: npm install (dispara postinstall)
```

Esto clona (o hace `git pull` si ya existe) cada repo dentro de
`~/.ot/remote-skills/<name>/`. Cualquier `.md` ahí adentro (incluyendo
`AGENTS.md`, que se trata como skill especial) aparece automáticamente en el
catálogo.

## 3. Agregar un tool nuevo al servidor MCP

Los tools viven en `src/index.ts`. Sigue el mismo patrón que `list_skills` /
`get_skill` / `search_skills`:

```ts
server.tool(
  "nombre_del_tool",
  "Descripción de cuándo usarlo",
  { parametro: z.string().describe("qué es este parámetro") }, // {} si no recibe nada
  async ({ parametro }) => {
    // lógica del tool
    return {
      content: [{ type: "text", text: "resultado" }]
    };
  }
);
```

No hace falta registrar el tool en ningún otro lado — `McpServer` lo expone
automáticamente a cualquier cliente conectado.

## 4. Correr con Docker / OrbStack

```bash
docker compose up --build -d   # levanta el servidor en background, puerto 3001
docker compose logs -f ot      # ver logs
docker compose down            # apagar
```

El volumen `~/.ot:/root/.ot` es lo único con estado: puedes borrar y
reconstruir el contenedor sin perder tus skills.

## 5. Convertir documentos a Markdown (MarkItDown)

El tool `convert_to_markdown` (expuesto por el MCP server) convierte PDF,
DOCX, PPTX, XLSX, HTML, audio o imágenes a texto usando
[MarkItDown](https://github.com/microsoft/markitdown), instalado en la imagen
Docker. No crea una skill automáticamente — el resultado es texto plano que
tú decides si guardar como `.md` en `~/.ot/skills/`.

## 6. CLI mínima

```bash
npm run cli -- list                 # lista el catálogo completo
npm run cli -- add-skill mi-skill   # crea ~/.ot/skills/mi-skill.md con plantilla
```

## 7. Exportar a AGENTS.md (clientes no-MCP)

Para herramientas que no hablan MCP pero sí leen `AGENTS.md` (como OpenCode),
genera el archivo a partir de tus skills `scope: global`:

```bash
npm run export-agents -- /ruta/al/proyecto
```

Sobreescribe `AGENTS.md` en esa carpeta — no lo edites a mano, vuelve a
correr el comando cuando cambien tus skills.

## 8. Contexto personal siempre cargado

Es solo una convención, no requiere código: si creas
`~/.ot/skills/_global-context.md`, aparece en el catálogo como cualquier
otra skill, pero el nombre (`_global-context`) marca que es la que el
cliente MCP debería pedir primero con `get_skill`.

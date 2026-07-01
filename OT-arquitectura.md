# OT — Orquestador MCP Transparente

## 1. Problema que resuelve

Hoy, si usas varios asistentes de IA (Claude Code, OpenCode, Antigravity CLI, Ollama, etc.), cada uno tiene su propio mecanismo de contexto:

- Claude: `SKILL.md` con su propia estructura de frontmatter.
- OpenCode: `AGENTS.md` + sistema de skills propio.
- Otros clientes: convenciones distintas o ninguna.

Resultado: si armas una skill o instrucción útil en una herramienta, tienes que volver a crearla o copiarla manualmente en las demás. No hay una fuente única de verdad.

## 2. Idea central

**OT es un servicio MCP local, persistente, que corre en background en tu máquina (Mac o Windows) y actúa como fuente única de skills/contexto para todos tus clientes de IA que hablen MCP.**

En vez de "distribuir" skills a cada herramienta, cada herramienta se **conecta una sola vez** a OT vía `http://localhost:PUERTO`, y desde ahí descubre y consume el catálogo completo. Un servidor, muchos clientes, cero duplicación.

Esto es distinto de un simple servidor MCP normal: OT no expone *tools* de terceros (no es un conector a Slack, GitHub, etc.). OT expone **tu propio catálogo de conocimiento y comportamiento**: skills, instrucciones globales, contexto personal.

## 3. Por qué "transparente"

Porque desde la perspectiva de cada IA cliente, OT debería sentirse invisible:

- No requiere que el usuario "traiga" skills a mano.
- No requiere reconfigurar nada cada vez que cambias de herramienta.
- Cada cliente simplemente pregunta y recibe lo que necesita, cuando lo necesita.

## 4. Arquitectura de alto nivel

```
┌─────────────────────────────────────────────────────────┐
│                      OT (servicio local)                  │
│  ┌───────────────┐   ┌────────────────┐  ┌─────────────┐ │
│  │  MCP Server    │   │  Skill Store    │  │  Adapters   │ │
│  │  (HTTP/SSE)    │◄──┤  (filesystem +  │  │  (para no-  │ │
│  │  list/get/     │   │   metadata)     │  │   MCP)      │ │
│  │  search skills │   └────────────────┘  └─────────────┘ │
│  └───────┬───────┘                                        │
└──────────┼─────────────────────────────────────────────────┘
           │  MCP (HTTP/SSE) — localhost:PUERTO
     ┌─────┼──────────┬─────────────┬──────────────┐
     ▼                ▼             ▼              ▼
 Claude Code    Antigravity CLI  OpenCode      Cursor / otros
 (cliente MCP)   (cliente MCP)  (cliente MCP)   clientes MCP
```

Para clientes que **no** hablan MCP (Ollama en crudo, por ejemplo), se necesita una capa adaptadora aparte (ver sección 7).

## 5. Componentes

### 5.1 MCP Server (núcleo)
- Expone MCP sobre HTTP/SSE (no stdio), porque necesitas un proceso persistente al que muchos clientes se conecten simultáneamente, no una instancia efímera por sesión.
- Tools que expone como mínimo:
  - `list_skills` — devuelve catálogo (nombre, descripción, tags).
  - `get_skill(name)` — devuelve el contenido completo.
  - `search_skills(query)` — búsqueda semántica o por keywords.
- Opcional: exponer también como *resources* MCP (no solo tools), para que el cliente las cargue directo sin "llamar" nada.

### 5.2 Skill Store
- Carpeta local, por ejemplo `~/.ot/skills/`.
- Cada skill es un `.md` con frontmatter:
  ```yaml
  ---
  name: nombre-skill
  description: Cuándo usar esta skill
  tags: [tag1, tag2]
  scope: global | proyecto | herramienta-especifica
  ---
  Contenido de la skill...
  ```
- Un archivo especial (`_global-context.md` o similar) para tu contexto personal/instrucciones fijas, que siempre se sugiere cargar primero.

### 5.3 Adapters (para clientes no-MCP)
- Traducen el catálogo de OT a lo que cada herramienta sin soporte MCP necesita.
- Ejemplo: un watcher que, al detectar una sesión nueva de una herramienta basada en archivos (`AGENTS.md`, `CLAUDE.md`), sincroniza o genera ese archivo desde el Skill Store.

### 5.4 Instalador de servicio (multiplataforma)
- **macOS:** `launchd` — un `.plist` en `~/Library/LaunchAgents/` que arranca OT al iniciar sesión.
- **Windows:** Windows Service (via `node-windows` o NSSM) o Tarea Programada al inicio de sesión.
- Mismo binario/código Node.js en ambos, mismo puerto, misma carpeta de skills (sincronizable vía git/Syncthing entre máquinas si quieres tenerlas idénticas).

## 6. Stack técnico propuesto

- **Node.js + TypeScript** — mejor soporte de servicio nativo en ambos SOs, y el SDK oficial `@modelcontextprotocol/sdk` está más maduro ahí que en otros lenguajes.
- **Transporte MCP:** Streamable HTTP (el método moderno recomendado por el protocolo, reemplaza a SSE puro).
- **Almacenamiento:** filesystem plano al inicio (simple, versionable con git). Se puede migrar a SQLite si el catálogo crece mucho y necesitas búsqueda más rápida.
- **CLI de administración:** `ot add-skill`, `ot list`, `ot start`, `ot status` — para gestionar el catálogo sin tocar archivos a mano.

## 7. Lo que NO resuelve por sí solo

- Clientes que no son clientes MCP (Ollama crudo sin wrapper) necesitan un traductor intermedio — no es parte del núcleo, es un adapter opcional.
- OT no reemplaza MCP servers de terceros (GitHub, Slack, DBs) — esos siguen siendo servidores MCP normales que cada cliente conecta aparte. OT es específicamente para *tu* conocimiento/comportamiento, no para *herramientas* externas.

## 8. Roadmap sugerido (fases)

1. **Fase 0 — Núcleo mínimo:** MCP server en Node con `list_skills`/`get_skill`, corriendo manualmente (`npm start`), 2-3 skills de prueba, probado contra Claude Code local.
2. **Fase 1 — Servicio Mac:** empaquetar como `launchd` agent, arranque automático, prueba de conexión persistente desde dos clientes MCP distintos al mismo tiempo.
3. **Fase 2 — Servicio Windows:** mismo comportamiento vía Windows Service/Tarea Programada.
4. **Fase 3 — CLI de administración:** comandos para agregar/editar/buscar skills sin tocar archivos a mano.
5. **Fase 4 — Adapters no-MCP:** primer adapter (por ejemplo, sincronización a `AGENTS.md` para herramientas basadas en archivo).
6. **Fase 5 — Búsqueda semántica:** si el catálogo crece, indexar con embeddings para que `search_skills` sea más inteligente que un grep.

## 9. Próximo paso concreto

Construir la Fase 0: un MCP server en Node.js con el SDK oficial, transporte Streamable HTTP, y las tres tools básicas, corriendo en `localhost` y probado contra un cliente real.

# OT — Orquestador MCP Transparente

OT es un servicio local, persistente, que corre en tu máquina y actúa como **fuente única de verdad de skills y contexto** para todos tus clientes de Inteligencia Artificial que soporten el protocolo MCP (Model Context Protocol), como Claude Code, Cursor, OpenCode, Antigravity CLI, etc.

En lugar de copiar tus archivos `.md` de instrucciones de un cliente a otro, OT los sirve a través de un único servidor. ¡Un servidor, muchos clientes, cero duplicación!

## Características (Fase 0.5)

- **Servidor MCP nativo:** Escrito en Node.js, usando el SDK oficial `@modelcontextprotocol/sdk`.
- **Conexión SSE:** Se comunica a través de HTTP Server-Sent Events (SSE) para facilitar conexiones concurrentes y persistentes.
- **Tools Integradas:**
  - `list_skills`: Devuelve el catálogo completo de skills instaladas.
  - `get_skill`: Recupera el texto íntegro de una skill.
  - `search_skills`: Búsqueda de skills por palabra clave.
- **Skills Remotas ("Zero Config"):** Posibilidad de agregar repositorios externos (ej. la regla global *ponytail*). Al hacer `npm install`, estos repositorios se descargan y sincronizan en la carpeta oculta `.ot-remote-skills/` para mantener limpio el repositorio principal de OT.
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
   ```bash
   npm start
   ```
   *Esto iniciará el servidor en `http://localhost:3001`.*

2. **Configurar tu cliente MCP:**
   Apunta la configuración MCP de tu IA a la siguiente URL SSE:
   ```text
   http://localhost:3001/sse
   ```

## Añadir Skills

### Skills Locales
Simplemente crea archivos `.md` dentro de la carpeta `skills/`. Ejemplo de estructura (`skills/mi-skill.md`):

```markdown
---
name: mi-skill
description: Instrucciones sobre cómo hacer algo
tags: [ejemplo, prueba]
scope: global
---
# Instrucciones
Aquí van tus directivas de IA...
```

### Skills Remotas (Repositorios)
Edita el archivo `ot-config.json` en la raíz del proyecto para añadir tus repositorios preferidos:

```json
{
  "remoteSkills": [
    {
      "name": "ponytail",
      "url": "https://github.com/DietrichGebert/ponytail.git"
    }
  ]
}
```

Luego vuelve a ejecutar `npm install` o directamente `node scripts/sync-skills.js` para sincronizar.

## Estructura del Proyecto

- `src/index.ts`: Punto de entrada del servidor Express y configuración MCP.
- `src/skills.ts`: Motor de búsqueda y parseo de archivos Markdown.
- `scripts/sync-skills.js`: Script de clonación/sincronización de repos remotos.
- `ot-config.json`: Archivo de manifiesto para skills remotas.
- `.ot-remote-skills/`: Carpeta temporal e ignorada en Git donde residen los repos remotos.

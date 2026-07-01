import fs from 'fs/promises';
import path from 'path';
import { getAllSkills } from '../src/skills.js';

const targetDir = process.argv[2] || process.cwd();
const targetPath = path.join(targetDir, 'AGENTS.md');

const skills = (await getAllSkills()).filter(s => s.scope === 'global');

const header = '<!-- Generado por OT (`npm run export-agents`). No editar a mano. -->\n\n';
const body = skills
  .map(s => `## ${s.name}\n\n${s.description}\n\n${s.content}`)
  .join('\n\n---\n\n');

await fs.writeFile(targetPath, header + body + '\n');
console.log(`AGENTS.md generado en ${targetPath} (${skills.length} skills)`);

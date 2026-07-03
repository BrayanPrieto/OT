import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { getAllSkills } from '../src/skills.js';

const OT_HOME = process.env.OT_HOME || path.join(os.homedir(), '.ot');
const SKILLS_DIR = path.join(OT_HOME, 'skills');

async function list() {
  const skills = await getAllSkills();
  for (const s of skills) {
    console.log(`${s.name} [${s.scope}] - ${s.description || '(sin descripción)'}`);
  }
}

async function addSkill(name?: string) {
  if (!name) {
    console.error('Uso: npm run cli -- add-skill <nombre>');
    process.exit(1);
  }
  const filePath = path.join(SKILLS_DIR, `${name}.md`);
  try {
    await fs.access(filePath);
    console.error(`Ya existe: ${filePath}`);
    process.exit(1);
  } catch {
    // no existe, seguimos
  }
  await fs.mkdir(SKILLS_DIR, { recursive: true });
  const template = `---
name: ${name}
description: TODO
tags: []
scope: global
---

TODO
`;
  await fs.writeFile(filePath, template);
  console.log(`Creado: ${filePath}`);
}

const SYNC_MARKER = '<!-- OT sync: generado desde ~/.ot, no editar a mano -->';

// Sincroniza el catálogo a los directorios de skills nativos de cada cliente
// (formato SKILL.md: Claude Code, y las CLIs que lo adoptaron) según
// ot-config.json → syncTargets.skillDirs. Solo sobreescribe archivos con el
// marcador OT, nunca skills creadas a mano por el usuario.
async function sync() {
  let config: { syncTargets?: { skillDirs?: string[] } } = {};
  try {
    const configPath = new URL('../ot-config.json', import.meta.url);
    config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
  } catch { /* sin config, usamos default */ }

  const dirs = (config.syncTargets?.skillDirs || ['~/.claude/skills'])
    .map(d => d.replace(/^~/, os.homedir()));

  const skills = (await getAllSkills()).filter(s => s.scope === 'global');

  for (const dir of dirs) {
    let written = 0;
    for (const s of skills) {
      const skillDir = path.join(dir, s.name);
      const skillFile = path.join(skillDir, 'SKILL.md');
      try {
        const existing = await fs.readFile(skillFile, 'utf-8');
        if (!existing.includes(SYNC_MARKER)) {
          console.log(`[skip] ${skillFile} existe y no es de OT`);
          continue;
        }
      } catch { /* no existe, se crea */ }

      await fs.mkdir(skillDir, { recursive: true });
      const frontmatter = `---\nname: ${s.name}\ndescription: ${JSON.stringify(s.description || s.name)}\n---\n`;
      await fs.writeFile(skillFile, `${frontmatter}${SYNC_MARKER}\n\n${s.content}\n`);
      written++;
    }
    console.log(`[OK] ${written}/${skills.length} skills sincronizadas en ${dir}`);
  }
}

const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case 'list':
    await list();
    break;
  case 'add-skill':
    await addSkill(args[0]);
    break;
  case 'sync':
    await sync();
    break;
  default:
    console.log('Uso: npm run cli -- <list|add-skill NOMBRE|sync>');
}

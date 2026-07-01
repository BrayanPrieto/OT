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

const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case 'list':
    await list();
    break;
  case 'add-skill':
    await addSkill(args[0]);
    break;
  default:
    console.log('Uso: npm run cli -- <list|add-skill NOMBRE>');
}

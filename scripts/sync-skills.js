import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const OT_HOME = process.env.OT_HOME || path.join(os.homedir(), '.ot');
const CONFIG_FILE = path.resolve(process.cwd(), 'ot-config.json');
const REMOTE_SKILLS_DIR = path.join(OT_HOME, 'remote-skills');

async function syncSkills() {
  try {
    let configContent;
    try {
      configContent = await fs.readFile(CONFIG_FILE, 'utf-8');
    } catch (err) {
      console.log('No se encontró ot-config.json, omitiendo sincronización.');
      return;
    }

    const config = JSON.parse(configContent);
    const remoteSkills = config.remoteSkills || [];

    if (remoteSkills.length === 0) {
      console.log('No hay skills remotas configuradas.');
      return;
    }

    await fs.mkdir(REMOTE_SKILLS_DIR, { recursive: true });

    for (const skill of remoteSkills) {
      if (!skill.name || !skill.url) {
        console.warn('Skill remota configurada incorrectamente:', skill);
        continue;
      }

      const targetDir = path.join(REMOTE_SKILLS_DIR, skill.name);
      
      try {
        const stat = await fs.stat(targetDir);
        if (stat.isDirectory()) {
          console.log(`Actualizando ${skill.name} desde ${skill.url}...`);
          await execAsync(`git -C ${targetDir} pull`);
          console.log(`[OK] ${skill.name} actualizado.`);
        }
      } catch (err) {
        console.log(`Clonando ${skill.name} desde ${skill.url}...`);
        await execAsync(`git clone ${skill.url} ${targetDir}`);
        console.log(`[OK] ${skill.name} clonado.`);
      }
    }
  } catch (error) {
    console.error('Error sincronizando skills:', error);
    process.exit(1);
  }
}

syncSkills();

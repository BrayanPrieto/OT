import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import matter from 'gray-matter';

export interface Skill {
  name: string;
  description: string;
  tags: string[];
  scope: string;
  content: string;
}

// ponytail: fuente única de verdad fija (~/.ot), no cwd - así el catálogo
// no depende de desde dónde se lance `npm start`. Ver OT-arquitectura.md 5.2.
const OT_HOME = process.env.OT_HOME || path.join(os.homedir(), '.ot');
const LOCAL_SKILLS_DIR = path.join(OT_HOME, 'skills');
const REMOTE_SKILLS_DIR = path.join(OT_HOME, 'remote-skills');

async function getFilesRecursively(dir: string): Promise<string[]> {
  try {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? getFilesRecursively(res) : res;
    }));
    return Array.prototype.concat(...files);
  } catch (error) {
    return [];
  }
}

export async function getAllSkills(): Promise<Skill[]> {
  const skills: Skill[] = [];

  const localFiles = await getFilesRecursively(LOCAL_SKILLS_DIR);
  const remoteFiles = await getFilesRecursively(REMOTE_SKILLS_DIR);
  
  const allFiles = [...localFiles, ...remoteFiles];

  for (const filePath of allFiles) {
    const fileName = path.basename(filePath);
    
    if (!filePath.endsWith('.md')) continue;
    
    // Ignorar READMEs, changelogs y archivos no relacionados
    if (fileName.toLowerCase().includes('readme') || fileName.toLowerCase() === 'changelog.md') continue;
    // Ignorar archivos en carpetas como .github o hooks
    if (filePath.includes('.github/') || filePath.includes('hooks/')) continue;

    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      // Manejo especial para AGENTS.md
      if (fileName === 'AGENTS.md') {
        const repoName = path.basename(path.dirname(filePath));
        skills.push({
          name: `${repoName}-agents`,
          description: `Instrucciones globales de ${repoName}`,
          tags: ['global', 'agents', repoName],
          scope: 'global',
          content: fileContent.trim()
        });
        continue;
      }

      const parsed = matter(fileContent);
      
      let defaultName = fileName.replace('.md', '');
      if (fileName === 'SKILL.md') {
        defaultName = path.basename(path.dirname(filePath));
      }

      skills.push({
        name: parsed.data.name || defaultName,
        description: parsed.data.description || '',
        tags: parsed.data.tags || [],
        scope: parsed.data.scope || 'global',
        content: parsed.content.trim(),
      });

    } catch (err) {
      console.warn(`No se pudo procesar el archivo ${filePath}:`, err);
    }
  }

  return skills;
}

export async function getSkillByName(name: string): Promise<Skill | undefined> {
  const skills = await getAllSkills();
  return skills.find(s => s.name === name);
}

export async function searchSkills(query: string): Promise<Skill[]> {
  const skills = await getAllSkills();
  const lowerQuery = query.toLowerCase();
  
  return skills.filter(s => 
    s.name.toLowerCase().includes(lowerQuery) ||
    s.description.toLowerCase().includes(lowerQuery) ||
    s.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
    s.content.toLowerCase().includes(lowerQuery)
  );
}

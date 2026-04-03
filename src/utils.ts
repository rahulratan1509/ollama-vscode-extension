import * as fs from 'fs';
import * as path from 'path';

const MAX_DEPTH = 3;
const MAX_FILES = 100;
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'out', 'build', '.vscode', 'coverage', '.cache', '__pycache__'];
const EXCLUDE_EXTENSIONS = ['.log', '.lock', '.map', '.min.js', '.min.css'];

export function getProjectStructure(rootPath: string): string {
  const structure: string[] = [];
  let fileCount = 0;

  function shouldExclude(name: string, isDir: boolean): boolean {
    if (isDir) {
      return EXCLUDE_DIRS.includes(name);
    }
    const ext = path.extname(name).toLowerCase();
    return EXCLUDE_EXTENSIONS.includes(ext);
  }

  function scanDir(dirPath: string, depth: number, prefix: string = ''): void {
    if (depth > MAX_DEPTH || fileCount >= MAX_FILES) return;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      const dirs: string[] = [];
      const files: string[] = [];

      for (const entry of entries) {
        if (shouldExclude(entry.name, entry.isDirectory())) continue;
        
        if (entry.isDirectory()) {
          dirs.push(entry.name);
        } else {
          files.push(entry.name);
          fileCount++;
        }
      }

      for (const dir of dirs) {
        structure.push(`${prefix}📁 ${dir}/`);
        scanDir(path.join(dirPath, dir), depth + 1, prefix + '  ');
      }

      for (const file of files) {
        structure.push(`${prefix}📄 ${file}`);
      }
    } catch (error) {
      structure.push(`${prefix}[Error: Cannot read directory]`);
    }
  }

  structure.push(`📁 ${path.basename(rootPath)}/`);
  scanDir(rootPath, 1, '');

  return structure.slice(0, MAX_FILES).join('\n');
}
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const MAX_DEPTH = 4;
const MAX_FILES = 150;
const MAX_FILE_SIZE = 50 * 1024;
const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'out', 'build', '.vscode',
  'coverage', '.cache', '__pycache__', '.next', '.nuxt',
  'vendor', 'target', 'bin', 'obj', '.idea', '.vs'
]);

const EXCLUDE_EXTENSIONS = new Set([
  '.log', '.lock', '.map', '.min.js', '.min.css',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot',
  '.exe', '.dll', '.so', '.dylib',
  '.zip', '.tar', '.gz', '.rar',
  '.pyc', '.pyo', '.class',
  '.db', '.sqlite', '.sqlite3'
]);

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.kt', '.kts',
  '.go', '.rs', '.rb', '.php', '.cs', '.cpp', '.c', '.h', '.hpp',
  '.swift', '.m', '.mm', '.scala', '.clj', '.hs', '.lua', '.r',
  '.R', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd',
  '.sql', '.graphql', '.proto', '.thrift',
  '.html', '.css', '.scss', '.sass', '.less',
  '.json', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
  '.xml', '.md', '.rst', '.txt',
  '.vue', '.svelte', '.astro',
  '.tf', '.hcl', '.dockerfile',
  '.dart', '.ex', '.exs', '.erl', '.hrl'
]);

export interface FileEntry {
  path: string;
  name: string;
  size: number;
  language: string;
}

export interface WorkspaceTree {
  name: string;
  children: WorkspaceTree[];
  isDir: boolean;
  path: string;
}

export interface ContextResult {
  projectName: string;
  selectedCode: string;
  activeFile: string;
  relevantFiles: FileEntry[];
  workspaceTree: string;
  totalTokens: number;
}

export class ContextEngine {
  private workspaceRoot: string | undefined;
  private treeCache: WorkspaceTree | null = null;
  private treeStringCache: string = '';
  private allFilesCache: FileEntry[] = [];
  private cacheValid = false;

  async initialize(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    this.workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;
    this.cacheValid = false;
  }

  invalidateCache(): void {
    this.cacheValid = false;
    this.treeCache = null;
    this.treeStringCache = '';
    this.allFilesCache = [];
  }

  async getWorkspaceTree(): Promise<string> {
    if (this.cacheValid && this.treeStringCache) {
      return this.treeStringCache;
    }

    if (!this.workspaceRoot) {
      return '(No workspace folder open)';
    }

    this.treeCache = this.buildTree(this.workspaceRoot, 0);
    this.treeStringCache = this.treeToString(this.treeCache, '', true);
    this.cacheValid = true;
    return this.treeStringCache;
  }

  async getAllFiles(): Promise<FileEntry[]> {
    if (this.cacheValid && this.allFilesCache.length > 0) {
      return this.allFilesCache;
    }

    if (!this.workspaceRoot) {
      return [];
    }

    this.allFilesCache = [];
    this.collectFiles(this.workspaceRoot, 0);
    return this.allFilesCache;
  }

  async getActiveFile(): Promise<string> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return '';
    }

    const doc = editor.document;
    const relativePath = this.getRelativePath(doc.uri.fsPath);
    const content = doc.getText();
    const trimmed = this.trimContent(content);

    return `## Active File: ${relativePath}\n\`\`\`${this.getLanguage(doc.languageId)}\n${trimmed}\n\`\`\``;
  }

  async getSelectedText(): Promise<string> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
      return '';
    }

    const doc = editor.document;
    const selection = doc.getText(editor.selection);
    const relativePath = this.getRelativePath(doc.uri.fsPath);
    const startLine = editor.selection.start.line + 1;
    const endLine = editor.selection.end.line + 1;

    return `## Selected Code: ${relativePath} (lines ${startLine}-${endLine})\n\`\`\`${this.getLanguage(doc.languageId)}\n${selection}\n\`\`\``;
  }

  async getProjectName(): Promise<string> {
    if (!this.workspaceRoot) {
      return 'unknown';
    }

    try {
      const pkgPath = path.join(this.workspaceRoot, 'package.json');
      const content = await fs.promises.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);
      if (pkg.name) return pkg.name;
    } catch { /* fall through */ }

    try {
      const pyPath = path.join(this.workspaceRoot, 'pyproject.toml');
      const content = await fs.promises.readFile(pyPath, 'utf-8');
      const match = content.match(/^name\s*=\s*"([^"]+)"/m);
      if (match) return match[1];
    } catch { /* fall through */ }

    try {
      const cargoPath = path.join(this.workspaceRoot, 'Cargo.toml');
      const content = await fs.promises.readFile(cargoPath, 'utf-8');
      const match = content.match(/^name\s*=\s*"([^"]+)"/m);
      if (match) return match[1];
    } catch { /* fall through */ }

    return path.basename(this.workspaceRoot);
  }

  async getRelevantFiles(query: string, maxFiles: number = 5): Promise<FileEntry[]> {
    const files = await this.getAllFiles();
    if (files.length === 0) {
      return [];
    }

    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (queryTerms.length === 0) {
      return files.slice(0, maxFiles);
    }

    const scored = files.map(file => {
      let score = 0;
      const nameLower = file.name.toLowerCase();
      const pathLower = file.path.toLowerCase();

      for (const term of queryTerms) {
        if (nameLower.includes(term)) {
          score += 10;
        }
        if (pathLower.includes(term)) {
          score += 5;
        }
        if (nameLower === term + path.extname(file.name).toLowerCase()) {
          score += 20;
        }
      }

      if (CODE_EXTENSIONS.has(path.extname(file.name).toLowerCase())) {
        score += 2;
      }

      try {
        if (file.size <= MAX_FILE_SIZE) {
          const content = fs.readFileSync(file.path, 'utf-8').toLowerCase();
          for (const term of queryTerms) {
            if (content.includes(term)) {
              score += 3;
            }
          }
        }
      } catch { /* skip unreadable files */ }

      return { file, score };
    });

    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxFiles)
      .map(s => s.file);
  }

  async readFilesContent(files: FileEntry[]): Promise<string> {
    if (files.length === 0) {
      return '';
    }

    const parts: string[] = [];
    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file.path, 'utf-8');
        const trimmed = this.trimContent(content);
        const relativePath = this.getRelativePath(file.path);
        parts.push(`## File: ${relativePath}\n\`\`\`${file.language}\n${trimmed}\n\`\`\``);
      } catch {
        continue;
      }
    }

    return parts.join('\n\n');
  }

  async buildContext(query: string): Promise<ContextResult> {
    const projectName = await this.getProjectName();
    const selectedCode = await this.getSelectedText();
    const activeFile = await this.getActiveFile();
    const relevantFiles = await this.getRelevantFiles(query);
    const workspaceTree = await this.getWorkspaceTree();

    let totalTokens = this.estimateTokens(workspaceTree);
    totalTokens += this.estimateTokens(selectedCode);
    totalTokens += this.estimateTokens(activeFile);

    for (const file of relevantFiles) {
      try {
        const content = await fs.promises.readFile(file.path, 'utf-8');
        totalTokens += this.estimateTokens(content);
      } catch {
        continue;
      }
    }

    return {
      projectName,
      selectedCode,
      activeFile,
      relevantFiles,
      workspaceTree,
      totalTokens
    };
  }

  private buildTree(dirPath: string, depth: number): WorkspaceTree {
    const name = path.basename(dirPath);
    const node: WorkspaceTree = {
      name,
      children: [],
      isDir: true,
      path: dirPath
    };

    if (depth > MAX_DEPTH) {
      return node;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      const dirs: WorkspaceTree[] = [];
      const files: WorkspaceTree[] = [];

      for (const entry of entries) {
        if (EXCLUDE_DIRS.has(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          dirs.push(this.buildTree(path.join(dirPath, entry.name), depth + 1));
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (!EXCLUDE_EXTENSIONS.has(ext)) {
            try {
              const stat = fs.statSync(path.join(dirPath, entry.name));
              files.push({
                name: entry.name,
                children: [],
                isDir: false,
                path: path.join(dirPath, entry.name)
              });
            } catch {
              continue;
            }
          }
        }
      }

      node.children = [...dirs.sort((a, b) => a.name.localeCompare(b.name)), ...files.sort((a, b) => a.name.localeCompare(b.name))];
    } catch {
      node.children = [];
    }

    return node;
  }

  private treeToString(node: WorkspaceTree, prefix: string, isLast: boolean): string {
    let result = '';
    const connector = isLast ? '└── ' : '├── ';
    const extension = isLast ? '    ' : '│   ';

    if (node.isDir) {
      result += `${prefix}${connector}📁 ${node.name}/\n`;
      const newPrefix = prefix + extension;

      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        const childIsLast = i === node.children.length - 1;
        result += this.treeToString(child, newPrefix, childIsLast);
      }
    } else {
      result += `${prefix}${connector}${node.name}\n`;
    }

    return result;
  }

  private collectFiles(dirPath: string, depth: number): void {
    if (depth > MAX_DEPTH || this.allFilesCache.length >= MAX_FILES) {
      return;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (EXCLUDE_DIRS.has(entry.name)) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          this.collectFiles(fullPath, depth + 1);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (!EXCLUDE_EXTENSIONS.has(ext)) {
            try {
              const stat = fs.statSync(fullPath);
              if (stat.size <= MAX_FILE_SIZE) {
                this.allFilesCache.push({
                  path: fullPath,
                  name: entry.name,
                  size: stat.size,
                  language: this.getLanguageFromExt(ext)
                });
              }
            } catch {
              continue;
            }
          }
        }

        if (this.allFilesCache.length >= MAX_FILES) {
          break;
        }
      }
    } catch {
      return;
    }
  }

  private getRelativePath(absolutePath: string): string {
    if (!this.workspaceRoot) {
      return absolutePath;
    }
    return path.relative(this.workspaceRoot, absolutePath);
  }

  private getLanguage(languageId: string): string {
    const map: Record<string, string> = {
      'typescript': 'typescript',
      'typescriptreact': 'tsx',
      'javascript': 'javascript',
      'javascriptreact': 'jsx',
      'python': 'python',
      'java': 'java',
      'go': 'go',
      'rust': 'rust',
      'ruby': 'ruby',
      'php': 'php',
      'csharp': 'csharp',
      'cpp': 'cpp',
      'c': 'c',
      'swift': 'swift',
      'kotlin': 'kotlin',
      'scala': 'scala',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'yaml': 'yaml',
      'xml': 'xml',
      'markdown': 'markdown',
      'shellscript': 'bash',
      'plaintext': 'text',
      'dockerfile': 'dockerfile',
      'lua': 'lua',
      'r': 'r',
      'sql': 'sql',
      'vue': 'vue',
      'svelte': 'svelte'
    };
    return map[languageId] || languageId;
  }

  private getLanguageFromExt(ext: string): string {
    const map: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'tsx',
      '.js': 'javascript',
      '.jsx': 'jsx',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.php': 'php',
      '.cs': 'csharp',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.md': 'markdown',
      '.sh': 'bash',
      '.bash': 'bash',
      '.lua': 'lua',
      '.sql': 'sql',
      '.vue': 'vue',
      '.svelte': 'svelte',
      '.dart': 'dart',
      '.ex': 'elixir',
      '.exs': 'elixir',
      '.tf': 'hcl',
      '.toml': 'toml'
    };
    return map[ext] || 'text';
  }

  private trimContent(content: string, maxChars: number = 8000): string {
    if (content.length <= maxChars) {
      return content;
    }

    const half = Math.floor(maxChars / 2);
    return content.substring(0, half) + '\n\n// ... [content truncated] ...\n\n' + content.substring(content.length - half);
  }

  private estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }
}

import * as vscode from 'vscode';

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

export interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class OllamaClient {
  private baseUrl: string;
  private abortController: AbortController | null = null;

  constructor() {
    const config = vscode.workspace.getConfiguration('ollamaChat');
    this.baseUrl = config.get<string>('ollamaUrl', DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
  }

  updateUrl(): void {
    const config = vscode.workspace.getConfiguration('ollamaChat');
    this.baseUrl = config.get<string>('ollamaUrl', DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
  }

  async getModels(): Promise<OllamaModel[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { models: Array<{ name: string; size: number; digest: string; modified_at: string }> };
      return (data.models || []).map(m => ({
        name: m.name,
        size: m.size,
        digest: m.digest,
        modified_at: m.modified_at
      }));
    } finally {
      clearTimeout(timeout);
    }
  }

  abortCurrent(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async *sendMessage(
    model: string,
    messages: ChatMessage[],
    options?: { temperature?: number; keepAlive?: string }
  ): AsyncGenerator<string, boolean> {
    this.abortController = new AbortController();

    const payload: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      options: {
        temperature: options?.temperature ?? 0.7
      }
    };

    if (options?.keepAlive) {
      payload.keep_alive = options.keepAlive;
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: this.abortController.signal
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${body || response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body from Ollama');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line) as { message?: { content: string }; done?: boolean };
            if (data.message?.content) {
              yield data.message.content;
            }
            if (data.done) {
              return true;
            }
          } catch {
            continue;
          }
        }
      }
    } finally {
      reader.releaseLock();
      this.abortController = null;
    }

    return false;
  }

  async generateEmbedding(model: string, text: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as { embedding: number[] };
    return data.embedding || [];
  }

  async isRunning(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${this.baseUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }
}

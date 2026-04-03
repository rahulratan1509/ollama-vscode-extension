import * as vscode from 'vscode';
import { OllamaClient, ChatMessage, OllamaModel } from './ollamaClient';
import { ContextEngine } from './contextEngine';
import { PromptBuilder } from './promptBuilder';
import { getWebviewHtml } from './webview';

let ollamaClient: OllamaClient;
let contextEngine: ContextEngine;
let promptBuilder: PromptBuilder;
let chatPanel: vscode.WebviewPanel | undefined;
let conversationHistory: ChatMessage[] = [];
let currentModel: string = '';
let models: OllamaModel[] = [];
let isStreaming: boolean = false;

function getWebviewContent(extensionPath: string): string {
  return getWebviewHtml(extensionPath);
}

async function loadModels(context: vscode.ExtensionContext): Promise<void> {
  try {
    models = await ollamaClient.getModels();
    if (models.length > 0) {
      const savedModel = context.globalState.get<string>('selectedModel');
      const savedExists = savedModel && models.some(m => m.name === savedModel);
      currentModel = savedExists ? savedModel! : models[0].name;

      if (!savedExists && savedModel) {
        context.globalState.update('selectedModel', undefined);
      }

      chatPanel?.webview.postMessage({
        type: 'models',
        models: models.map(m => m.name),
        currentModel: currentModel
      });
    } else {
      chatPanel?.webview.postMessage({
        type: 'error',
        message: 'No Ollama models found. Run `ollama pull llama3.2` or similar to get started.'
      });
    }
  } catch (error) {
    chatPanel?.webview.postMessage({
      type: 'error',
      message: `Failed to connect to Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
}

async function handleUserMessage(content: string, mode: 'chat' | 'explain' | 'fix' = 'chat'): Promise<void> {
  if (!currentModel || isStreaming) return;

  chatPanel?.webview.postMessage({ type: 'addMessage', role: 'user', content });

  const ctx = await contextEngine.buildContext(content);
  const maxContextFiles = vscode.workspace.getConfiguration('ollamaChat').get<number>('maxContextFiles', 5);
  const relevantFileContents = await contextEngine.readFilesContent(ctx.relevantFiles.slice(0, maxContextFiles));

  const messages = promptBuilder.buildMessages(
    ctx,
    content,
    conversationHistory,
    mode,
    relevantFileContents
  );

  await streamResponse(messages);
}

async function streamResponse(messages: ChatMessage[]): Promise<void> {
  if (!currentModel) return;

  isStreaming = true;
  chatPanel?.webview.postMessage({ type: 'streamStart' });

  try {
    let fullResponse = '';
    const response = ollamaClient.sendMessage(currentModel, messages);

    for await (const chunk of response) {
      fullResponse += chunk;
      chatPanel?.webview.postMessage({ type: 'streamChunk', chunk });
    }

    conversationHistory.push(messages[messages.length - 1]);
    conversationHistory.push({ role: 'assistant', content: fullResponse });

    const maxHistory = 30;
    if (conversationHistory.length > maxHistory) {
      conversationHistory = conversationHistory.slice(-maxHistory);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      chatPanel?.webview.postMessage({ type: 'streamEnd' });
      return;
    }
    chatPanel?.webview.postMessage({
      type: 'error',
      message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }

  isStreaming = false;
  chatPanel?.webview.postMessage({ type: 'streamEnd' });
}

async function handleQuickAction(action: string): Promise<void> {
  const selectedCode = await contextEngine.getSelectedText();
  const activeFile = await contextEngine.getActiveFile();

  if (!selectedCode && !activeFile) {
    chatPanel?.webview.postMessage({
      type: 'error',
      message: 'No code selected. Select some code in the editor first.'
    });
    return;
  }

  let prompt: string;
  let mode: 'chat' | 'explain' | 'fix';

  switch (action) {
    case 'explain':
      prompt = 'Explain this code:';
      mode = 'explain';
      break;
    case 'fix':
      prompt = 'Fix any issues in this code:';
      mode = 'fix';
      break;
    case 'review':
      prompt = 'Review this code for potential issues, best practices, and improvements:';
      mode = 'chat';
      break;
    default:
      return;
  }

  await handleUserMessage(prompt, mode);
}

function openChatPanel(context: vscode.ExtensionContext): void {
  if (chatPanel) {
    chatPanel.reveal(vscode.ViewColumn.Two);
    return;
  }

  chatPanel = vscode.window.createWebviewPanel(
    'ollamaChatPanel',
    'LLM Chat',
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(context.extensionPath)]
    }
  );

  chatPanel.webview.html = getWebviewContent(context.extensionPath);

  chatPanel.onDidDispose(() => {
    chatPanel = undefined;
  });

  chatPanel.webview.onDidReceiveMessage(async (message) => {
    switch (message.type) {
      case 'init':
        ollamaClient.updateUrl();
        await contextEngine.initialize();
        const connected = await ollamaClient.isRunning();
        chatPanel?.webview.postMessage({ type: 'status', connected });
        if (connected) {
          await loadModels(context);
        }
        break;
      case 'sendMessage':
        await handleUserMessage(message.content, 'chat');
        break;
      case 'quickAction':
        await handleQuickAction(message.action);
        break;
      case 'switchModel':
        currentModel = message.model;
        await context.globalState.update('selectedModel', message.model);
        break;
      case 'getModels':
        await loadModels(context);
        break;
      case 'clearChat':
        conversationHistory = [];
        break;
      case 'stopGeneration':
        ollamaClient.abortCurrent();
        break;
    }
  });
}

export function activate(context: vscode.ExtensionContext) {
  ollamaClient = new OllamaClient();
  contextEngine = new ContextEngine();
  promptBuilder = new PromptBuilder();

  context.subscriptions.push(
    vscode.commands.registerCommand('ollamaChat.openInPanel', () => {
      openChatPanel(context);
    }),
    vscode.commands.registerCommand('ollamaChat.explainSelected', async () => {
      openChatPanel(context);
      const selected = await contextEngine.getSelectedText();
      if (!selected) {
        vscode.window.showInformationMessage('No code selected. Select some code first.');
        return;
      }
      setTimeout(async () => {
        await handleUserMessage('Explain this selected code:\n\n' + selected, 'explain');
      }, 500);
    }),
    vscode.commands.registerCommand('ollamaChat.fixSelected', async () => {
      openChatPanel(context);
      const selected = await contextEngine.getSelectedText();
      if (!selected) {
        vscode.window.showInformationMessage('No code selected. Select some code first.');
        return;
      }
      setTimeout(async () => {
        await handleUserMessage('Fix any issues in this selected code:\n\n' + selected, 'fix');
      }, 500);
    }),
    vscode.commands.registerCommand('ollamaChat.explainFile', async () => {
      openChatPanel(context);
      const activeFile = await contextEngine.getActiveFile();
      if (!activeFile) {
        vscode.window.showInformationMessage('No file is currently open.');
        return;
      }
      setTimeout(async () => {
        await handleUserMessage('Explain this file:\n\n' + activeFile, 'explain');
      }, 500);
    }),
    vscode.commands.registerCommand('ollamaChat.refreshModels', async () => {
      if (chatPanel) {
        await loadModels(context);
      } else {
        vscode.window.showInformationMessage('Open the LLM Chat panel first.');
      }
    }),
    vscode.commands.registerCommand('ollamaChat.newChat', async () => {
      conversationHistory = [];
      chatPanel?.webview.postMessage({ type: 'clearChat' });
    }),
    vscode.commands.registerCommand('ollamaChat.askAboutCode', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('No file is currently open.');
        return;
      }
      openChatPanel(context);
      const question = await vscode.window.showInputBox({
        prompt: 'What would you like to know about this code?',
        placeHolder: 'e.g., How does this function work?'
      });
      if (question) {
        const activeFile = await contextEngine.getActiveFile();
        setTimeout(async () => {
          await handleUserMessage(question + '\n\n' + activeFile, 'chat');
        }, 500);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('ollamaChat')) {
        ollamaClient.updateUrl();
      }
    }),
    vscode.workspace.onDidSaveTextDocument(() => {
      contextEngine.invalidateCache();
    }),
    vscode.workspace.onDidOpenTextDocument(() => {
      contextEngine.invalidateCache();
    })
  );
}

export function deactivate() {
  ollamaClient.abortCurrent();
  chatPanel?.dispose();
}

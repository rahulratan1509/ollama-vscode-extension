import { ChatMessage } from './ollamaClient';
import { ContextResult } from './contextEngine';

const SYSTEM_PROMPT = `You are an expert programming assistant running inside VS Code as a local extension.
You help developers understand, write, debug, and improve code.
You are aware of the current project structure and context.
Always be concise, accurate, and practical.
When showing code, use proper markdown code blocks with language tags.
Prefer explaining concepts clearly over being verbose.`;

const PROJECT_CONTEXT_HEADER = `# Project Context

## Workspace Structure
{workspaceTree}

## Active File
{activeFile}

## Selected Code
{selectedCode}

## Relevant Files
{relevantFiles}`;

export class PromptBuilder {
  buildInitialPrompt(projectTree: string): ChatMessage[] {
    return [
      {
        role: 'system',
        content: `${SYSTEM_PROMPT}\n\nYou are currently working with the following project:\n\n${projectTree}\n\nPlease acknowledge that you understand this project structure and are ready to help.`
      },
      {
        role: 'user',
        content: `I've opened a project with the structure shown above. Please briefly acknowledge what you see and let me know you're ready to help. Keep it brief (2-3 sentences max).`
      }
    ];
  }

  buildMessages(
    context: ContextResult,
    userMessage: string,
    conversationHistory: ChatMessage[],
    mode: 'chat' | 'explain' | 'fix' = 'chat'
  ): ChatMessage[] {
    const contextParts: string[] = [];

    if (context.selectedCode) {
      contextParts.push(context.selectedCode);
    }

    if (context.activeFile && !contextParts.some(p => p.includes('Active File'))) {
      contextParts.push(context.activeFile);
    }

    const contextBlock = contextParts.length > 0
      ? PROJECT_CONTEXT_HEADER
          .replace('{workspaceTree}', context.workspaceTree)
          .replace('{activeFile}', contextParts.find(p => p.includes('Active File')) || '(none)')
          .replace('{selectedCode}', contextParts.find(p => p.includes('Selected Code')) || '(none)')
          .replace('{relevantFiles}', '(loaded on demand)')
      : '';

    const systemMessage: ChatMessage = {
      role: 'system',
      content: this.buildSystemMessage(mode, contextBlock)
    };

    const messages: ChatMessage[] = [systemMessage];

    const maxHistoryLength = 20;
    const recentHistory = conversationHistory.slice(-maxHistoryLength);
    messages.push(...recentHistory);

    if (mode === 'explain' && context.selectedCode) {
      messages.push({
        role: 'user',
        content: `Please explain this selected code:\n\n${context.selectedCode}\n\nProvide a clear explanation of what it does, how it works, and any notable patterns or potential issues.`
      });
    } else if (mode === 'fix' && context.selectedCode) {
      messages.push({
        role: 'user',
        content: `Please fix any issues in this selected code:\n\n${context.selectedCode}\n\nExplain what was wrong and show the corrected version.`
      });
    } else {
      messages.push({
        role: 'user',
        content: userMessage
      });
    }

    return messages;
  }

  buildSystemMessage(mode: string, contextBlock: string): string {
    let base = SYSTEM_PROMPT;

    if (contextBlock) {
      base += `\n\n${contextBlock}`;
    }

    switch (mode) {
      case 'explain':
        base += '\n\nYou are in CODE EXPLAIN mode. Focus on explaining the selected code clearly, including its purpose, logic, and any patterns used.';
        break;
      case 'fix':
        base += '\n\nYou are in CODE FIX mode. Identify issues in the selected code and provide corrected versions. Explain what was wrong and why the fix works.';
        break;
      default:
        base += '\n\nYou are in CHAT mode. Answer questions helpfully and provide code examples when relevant.';
    }

    return base;
  }

  buildQuickPrompt(context: ContextResult, userMessage: string): ChatMessage[] {
    const parts: string[] = [SYSTEM_PROMPT];

    if (context.workspaceTree) {
      parts.push(`\n\n## Project Structure\n${context.workspaceTree}`);
    }

    if (context.selectedCode) {
      parts.push(`\n\n## Selected Code\n${context.selectedCode}`);
    } else if (context.activeFile) {
      parts.push(`\n\n## Current File\n${context.activeFile}`);
    }

    return [
      { role: 'system', content: parts.join('') },
      { role: 'user', content: userMessage }
    ];
  }
}

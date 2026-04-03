# LLM Chat - VS Code Extension

Chat with local Ollama models directly inside VS Code. Get AI-powered code explanations, fixes, and reviews without sending your code to external services.

## Features

- **Local & Private** - All inference runs on your machine via Ollama. Your code never leaves your computer.
- **Context-Aware** - Automatically includes your selected code, active file, and relevant project files in the prompt.
- **Streaming Responses** - See AI responses in real-time as they're generated.
- **Quick Actions** - Explain, fix, or review selected code with one click.
- **Model Switching** - Change models on the fly without restarting.
- **Multi-Model Support** - Works with any model available in your local Ollama instance.

## Installation

### Prerequisites

1. **Install Ollama** - [https://ollama.com](https://ollama.com)
2. **Pull a model**:
   ```bash
   ollama pull llama3.2
   ```
3. Make sure Ollama is running (`ollama list` should show your models).

### Install the Extension

#### From VSIX (Recommended)

1. Download the latest `.vsix` file from the [Releases](https://github.com/Retro/ollama-vscode-extension/releases) page.
2. Open VS Code.
3. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
4. Run **Extensions: Install from VSIX...**
5. Select the downloaded `.vsix` file.
6. Reload VS Code when prompted.

#### From Source

```bash
git clone https://github.com/Retro/ollama-vscode-extension.git
cd ollama-vscode-extension
npm install
npm run compile
```

Then press `F5` in VS Code to launch the Extension Host, or run:

```bash
npx vsce package
code --install-extension ollama-vscode-extension-*.vsix
```

## How to Use

### Open the Chat Panel

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
2. Type **LLM Chat** and press Enter.
3. The chat panel opens in a new editor tab.

### Chat

Type any question in the input box and press Enter. The extension will automatically include relevant context from your project.

### Quick Actions

Select code in your editor, then use one of the quick action buttons at the bottom of the chat panel:

| Button | What it does |
|--------|-------------|
| **Explain** | Explains what the selected code does |
| **Fix** | Identifies and fixes issues in the selected code |
| **Review** | Provides a code review with suggestions |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+E` (`Cmd+Shift+E` on Mac) | Explain selected code |
| `Ctrl+Shift+F` (`Cmd+Shift+F` on Mac) | Fix selected code |

### All Commands

Open the Command Palette (`Ctrl+Shift+P`) and search for:

| Command | Description |
|---------|-------------|
| **LLM Chat** | Open the chat panel |
| **LLM Chat: New Chat** | Clear the conversation and start fresh |
| **LLM Chat: Refresh Models** | Reload the list of available Ollama models |
| **LLM Chat: Explain Selected Code** | Explain the code you have selected |
| **LLM Chat: Fix Selected Code** | Fix issues in the code you have selected |
| **LLM Chat: Explain Current File** | Explain the currently open file |
| **LLM Chat: Ask About Current Code** | Ask a custom question about the open file |

### Settings

Configure the extension in VS Code Settings (`Ctrl+,`):

| Setting | Default | Description |
|---------|---------|-------------|
| `ollamaChat.ollamaUrl` | `http://localhost:11434` | URL of your Ollama API server |
| `ollamaChat.defaultModel` | *(empty)* | Default model to use (uses first available if empty) |
| `ollamaChat.temperature` | `0.7` | Response creativity (0 = deterministic, 1 = creative) |
| `ollamaChat.maxContextFiles` | `5` | Max relevant files to include in context |

## Supported Operating Systems

Works anywhere VS Code and Ollama run:

| OS | Supported |
|----|-----------|
| **Windows** | Yes |
| **macOS** | Yes |
| **Linux** | Yes |

## Why Use This Extension?

- **Privacy** - Your code stays on your machine. No API keys, no cloud uploads, no telemetry.
- **Free** - No subscription fees. Use any open-weight model from Ollama.
- **Offline** - Works without an internet connection once models are pulled.
- **Project-Aware** - Understands your codebase structure and includes relevant files in context.
- **Fast** - Local inference means no rate limits or queue times.

## Building from Source

```bash
git clone https://github.com/Retro/ollama-vscode-extension.git
cd ollama-vscode-extension
npm install
npm run compile
npx vsce package
```

## License

MIT

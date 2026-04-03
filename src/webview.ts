import * as vscode from 'vscode';

export function getWebviewHtml(extensionPath: string): string {
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src https: data:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
${getCSS()}
</style>
</head>
<body>
<div id="app">
  <div id="header">
    <div id="header-left">
      <span id="status-dot" class="status-dot disconnected"></span>
      <span id="status-text">Connecting...</span>
    </div>
    <div id="header-right">
      <select id="model-select" title="Select model">
        <option value="">Loading...</option>
      </select>
      <button id="refresh-models" title="Refresh models" class="icon-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2"/></svg>
      </button>
      <button id="clear-chat" title="Clear chat" class="icon-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
      </button>
    </div>
  </div>
  <div id="chat-container"></div>
  <div id="typing-indicator" class="hidden">
    <div class="typing-dots">
      <span></span><span></span><span></span>
    </div>
    <span class="typing-text">Thinking...</span>
  </div>
  <div id="input-area">
    <div id="quick-actions">
      <button class="quick-action" data-action="explain" title="Explain selected code">Explain</button>
      <button class="quick-action" data-action="fix" title="Fix selected code">Fix</button>
      <button class="quick-action" data-action="review" title="Code review">Review</button>
    </div>
    <div id="input-row">
      <textarea id="message-input" placeholder="Ask anything... (Enter to send, Shift+Enter for new line)" rows="1"></textarea>
      <button id="send-btn" title="Send message">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
      <button id="stop-btn" class="hidden" title="Stop generation">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
      </button>
    </div>
  </div>
</div>
<script nonce="${nonce}">
${getClientScript()}
</script>
</body>
</html>`;
}

function getCSS(): string {
  return `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-tertiary: #2d2d2d;
  --bg-input: #3c3c3c;
  --border: #3e3e42;
  --text-primary: #d4d4d4;
  --text-secondary: #808080;
  --text-muted: #606060;
  --accent: #10a37f;
  --accent-hover: #0e8c6d;
  --user-bubble: #2b5a3e;
  --assistant-bubble: #2d2d2d;
  --code-bg: #1a1a1a;
  --code-header-bg: #2a2a2a;
  --error-bg: #3c1f1f;
  --error-border: #5c2f2f;
  --error-text: #f88;
  --scrollbar-thumb: #424242;
  --scrollbar-hover: #555;
  --code-keyword: #c586c0;
  --code-string: #ce9178;
  --code-comment: #6a9955;
  --code-function: #dcdcaa;
  --code-number: #b5cea8;
  --code-type: #4ec9b0;
  --code-variable: #9cdcfe;
  --code-operator: #d4d4d4;
}

html, body {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  line-height: 1.5;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }

/* Header */
#header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  gap: 8px;
  flex-shrink: 0;
}

#header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.connected { background: #4caf50; box-shadow: 0 0 4px #4caf50; }
.status-dot.disconnected { background: #f44336; }

#status-text {
  font-size: 11px;
  color: var(--text-secondary);
}

#header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

#model-select {
  max-width: 160px;
  padding: 4px 8px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}
#model-select:hover { border-color: var(--accent); }

.icon-btn {
  padding: 4px 6px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }

/* Chat */
#chat-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}
.welcome h2 {
  font-size: 22px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 12px;
}
.welcome p {
  font-size: 13px;
  max-width: 320px;
  line-height: 1.6;
}

/* Messages */
.message {
  display: flex;
  gap: 12px;
  max-width: 100%;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.message.user { flex-direction: row-reverse; }

.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
}
.message.user .avatar { background: var(--accent); color: #fff; }
.message.assistant .avatar { background: var(--bg-tertiary); border: 1px solid var(--border); color: var(--text-secondary); }

.bubble {
  padding: 12px 16px;
  border-radius: 12px;
  max-width: calc(100% - 50px);
  word-wrap: break-word;
  overflow-wrap: break-word;
  line-height: 1.6;
}
.message.user .bubble {
  background: var(--user-bubble);
  color: #e8e8e8;
  border-bottom-right-radius: 4px;
}
.message.assistant .bubble {
  background: var(--assistant-bubble);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
}

.bubble p { margin: 0.6em 0; }
.bubble p:first-child { margin-top: 0; }
.bubble p:last-child { margin-bottom: 0; }

.bubble code {
  background: var(--code-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace;
  font-size: 12.5px;
  border: 1px solid var(--border);
  color: #d4d4d4;
}

.bubble pre {
  background: var(--code-bg);
  padding: 0;
  border-radius: 8px;
  overflow: hidden;
  margin: 10px 0;
  border: 1px solid var(--border);
}

.bubble pre code {
  display: block;
  padding: 14px 16px;
  overflow-x: auto;
  background: transparent;
  border: none;
  font-size: 13px;
  line-height: 1.55;
  color: #d4d4d4;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 14px;
  background: var(--code-header-bg);
  border-bottom: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-secondary);
  font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace;
}

.code-header .lang {
  font-weight: 500;
  text-transform: lowercase;
}

.copy-btn {
  padding: 3px 10px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 11px;
  font-family: inherit;
  transition: all 0.15s;
}
.copy-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); border-color: var(--text-secondary); }

.bubble ul, .bubble ol {
  padding-left: 24px;
  margin: 0.6em 0;
}
.bubble li { margin: 0.3em 0; }

.bubble strong, .bubble b { color: #fff; font-weight: 600; }
.bubble em, .bubble i { color: var(--text-secondary); }

.bubble h1, .bubble h2, .bubble h3, .bubble h4 {
  margin: 1em 0 0.5em;
  font-weight: 600;
  color: #fff;
  line-height: 1.3;
}
.bubble h1 { font-size: 18px; }
.bubble h2 { font-size: 16px; }
.bubble h3 { font-size: 15px; }
.bubble h4 { font-size: 14px; }

.bubble blockquote {
  border-left: 3px solid var(--accent);
  padding-left: 14px;
  margin: 10px 0;
  color: var(--text-secondary);
}

.bubble table {
  border-collapse: collapse;
  margin: 10px 0;
  width: 100%;
}
.bubble th, .bubble td {
  border: 1px solid var(--border);
  padding: 8px 12px;
  text-align: left;
  font-size: 12px;
}
.bubble th { background: var(--bg-tertiary); font-weight: 600; }

.bubble hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 12px 0;
}

.bubble a {
  color: var(--accent);
  text-decoration: none;
}
.bubble a:hover { text-decoration: underline; }

/* Error */
.message.error .bubble {
  background: var(--error-bg);
  border: 1px solid var(--error-border);
  color: var(--error-text);
}

/* System message */
.message.system .bubble {
  background: transparent;
  border: 1px dashed var(--border);
  color: var(--text-muted);
  font-size: 11px;
  font-style: italic;
}
.message.system .avatar { display: none; }

/* Typing indicator */
#typing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  color: var(--text-secondary);
  font-size: 12px;
}
#typing-indicator.hidden { display: none !important; }

.typing-dots {
  display: flex;
  gap: 3px;
}
.typing-dots span {
  width: 6px;
  height: 6px;
  background: var(--accent);
  border-radius: 50%;
  animation: bounce 1.4s infinite;
}
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}

/* Input area */
#input-area {
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
  padding: 10px 16px;
  flex-shrink: 0;
}

#quick-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.quick-action {
  padding: 4px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 14px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.quick-action:hover {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

#input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

#message-input {
  flex: 1;
  padding: 12px 14px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  resize: none;
  min-height: 44px;
  max-height: 150px;
  line-height: 1.4;
}
#message-input:focus { outline: none; border-color: var(--accent); }
#message-input::placeholder { color: var(--text-muted); }

#send-btn, #stop-btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}

#send-btn {
  background: var(--accent);
  color: #fff;
}
#send-btn:hover { background: var(--accent-hover); }
#send-btn:disabled { background: var(--bg-tertiary); color: var(--text-muted); cursor: not-allowed; }

#stop-btn {
  background: #c0392b;
  color: #fff;
}
#stop-btn:hover { background: #a93226; }
#stop-btn.hidden { display: none !important; }

.hidden { display: none !important; }
`;
}

function getClientScript(): string {
  const BT = String.fromCodePoint(96);
  const BT3 = BT + BT + BT;

  return `
const vscode = acquireVsCodeApi();

const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const stopBtn = document.getElementById('stop-btn');
const modelSelect = document.getElementById('model-select');
const refreshModelsBtn = document.getElementById('refresh-models');
const clearChatBtn = document.getElementById('clear-chat');
const typingIndicator = document.getElementById('typing-indicator');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

let isStreaming = false;
let currentBubble = null;
let fullAssistantText = '';

function setStatus(connected) {
  statusDot.className = 'status-dot ' + (connected ? 'connected' : 'disconnected');
  statusText.textContent = connected ? 'Ollama' : 'Disconnected';
}

function showWelcome() {
  chatContainer.innerHTML = '<div class="welcome"><h2>LLM Chat</h2><p>Ask questions about your code, get explanations, or request fixes. Select code in your editor for context-aware responses.</p></div>';
}

function addMessage(role, content, isSystem) {
  if (chatContainer.querySelector('.welcome')) {
    chatContainer.innerHTML = '';
  }

  const msg = document.createElement('div');
  msg.className = 'message ' + (isSystem ? 'system' : role);

  if (!isSystem) {
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = role === 'user' ? 'U' : 'AI';
    msg.appendChild(avatar);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = renderMarkdown(content);
  msg.appendChild(bubble);

  chatContainer.appendChild(msg);
  scrollToBottom();

  if (role === 'assistant') {
    currentBubble = bubble;
  }

  return bubble;
}

function appendToBubble(chunk) {
  if (currentBubble) {
    fullAssistantText += chunk;
    currentBubble.innerHTML = renderMarkdown(fullAssistantText);
    scrollToBottom();
  }
}

function renderMarkdown(text) {
  if (!text) return '';

  var codeBlocks = [];
  var BT = String.fromCodePoint(96);
  var BT3 = BT + BT + BT;

  var codeRegex = new RegExp(BT3 + '(\\\\w*)\\\\s*([\\\\s\\\\S]*?)' + BT3, 'g');
  text = text.replace(codeRegex, function(match, lang, code) {
    var idx = codeBlocks.length;
    codeBlocks.push({ lang: lang || '', code: code.replace(/\\n$/, '') });
    return '\\x00CODEBLOCK_' + idx + '\\x00';
  });

  text = text.replace(/&/g, '&amp;');
  text = text.replace(/</g, '&lt;');
  text = text.replace(/>/g, '&gt;');

  var inlineCodeRegex = new RegExp(BT + '([^' + BT + '\\\\n]+?)' + BT, 'g');
  text = text.replace(inlineCodeRegex, '<code>$1</code>');

  text = text.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  text = text.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  text = text.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  text = text.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  text = text.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
  text = text.replace(/\\*(.+?)\\*/g, '<em>$1</em>');

  text = text.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  text = text.replace(/^---$/gm, '<hr>');

  text = text.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank">$1</a>');

  text = text.replace(/^[\\-\\*] (.+)$/gm, '<li>$1</li>');
  text = text.replace(/^(\\d+)\\. (.+)$/gm, '<li>$2</li>');
  text = text.replace(/((?:<li>.*<\\/li>\\s*)+)/g, '<ul>$1</ul>');

  text = text.replace(/\\n\\n/g, '\\x01');
  text = text.replace(/\\n/g, '<br>');
  text = text.replace(/\\x01/g, '</p><p>');
  text = '<p>' + text + '</p>';
  text = text.replace(/<p><\\/p>/g, '');
  text = text.replace(/<p>(<h[1234]>)/g, '$1');
  text = text.replace(/(<\\/h[1234]>)<\\/p>/g, '$1');
  text = text.replace(/<p>(<ul>)/g, '$1');
  text = text.replace(/(<\\/ul>)<\\/p>/g, '$1');
  text = text.replace(/<p>(<blockquote>)/g, '$1');
  text = text.replace(/(<\\/blockquote>)<\\/p>/g, '$1');
  text = text.replace(/<p>(<hr>)<\\/p>/g, '$1');

  for (var i = 0; i < codeBlocks.length; i++) {
    var item = codeBlocks[i];
    var displayLang = item.lang || 'code';
    var headerHtml = '<div class="code-header"><span class="lang">' + displayLang + '</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>';
    var codeHtml = '<pre>' + headerHtml + '<code>' + item.code + '</code></pre>';
    text = text.replace('\\x00CODEBLOCK_' + i + '\\x00', codeHtml);
  }

  return text;
}

window.copyCode = function(btn) {
  var pre = btn.closest('.code-header').nextElementSibling;
  var code = pre.textContent;
  navigator.clipboard.writeText(code).then(function() {
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy'; }, 1500);
  });
};

function scrollToBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function setStreaming(active) {
  isStreaming = active;
  typingIndicator.classList.toggle('hidden', !active);
  sendBtn.classList.toggle('hidden', active);
  stopBtn.classList.toggle('hidden', !active);
  messageInput.disabled = active;
}

function handleSend() {
  var content = messageInput.value.trim();
  if (!content || isStreaming) return;
  vscode.postMessage({ type: 'sendMessage', content });
  messageInput.value = '';
  messageInput.style.height = 'auto';
}

sendBtn.addEventListener('click', handleSend);

stopBtn.addEventListener('click', function() {
  vscode.postMessage({ type: 'stopGeneration' });
  setStreaming(false);
});

messageInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

messageInput.addEventListener('input', function() {
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
});

modelSelect.addEventListener('change', function(e) {
  if (e.target.value) {
    vscode.postMessage({ type: 'switchModel', model: e.target.value });
  }
});

refreshModelsBtn.addEventListener('click', function() {
  vscode.postMessage({ type: 'getModels' });
});

clearChatBtn.addEventListener('click', function() {
  vscode.postMessage({ type: 'clearChat' });
  showWelcome();
});

document.querySelectorAll('.quick-action').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var action = btn.dataset.action;
    vscode.postMessage({ type: 'quickAction', action });
  });
});

window.addEventListener('message', function(event) {
  var data = event.data;
  switch (data.type) {
    case 'models':
      modelSelect.innerHTML = data.models.map(function(m) {
        return '<option value="' + m + '"' + (m === data.currentModel ? ' selected' : '') + '>' + m + '</option>';
      }).join('');
      break;
    case 'status':
      setStatus(data.connected);
      break;
    case 'addMessage':
      fullAssistantText = '';
      addMessage(data.role, data.content, data.isSystem);
      break;
    case 'streamStart':
      setStreaming(true);
      fullAssistantText = '';
      addMessage('assistant', '', false);
      break;
    case 'streamChunk':
      appendToBubble(data.chunk);
      break;
    case 'streamEnd':
      setStreaming(false);
      currentBubble = null;
      fullAssistantText = '';
      break;
    case 'error':
      addMessage('error', data.message, false);
      setStreaming(false);
      currentBubble = null;
      fullAssistantText = '';
      break;
    case 'clearChat':
      showWelcome();
      break;
    case 'setInput':
      messageInput.value = data.value || '';
      messageInput.focus();
      break;
  }
});

vscode.postMessage({ type: 'init' });
`;
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

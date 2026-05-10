<template>
  <div class="ai-page">
    <!-- Left: chat -->
    <div class="chat-area panel">
      <div class="panel-header">
        <span class="panel-title">AI Synthesis Engine</span>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="badge" :class="store.ollamaLive ? 'badge-green' : 'badge-purple'">
            {{ store.ollamaLive ? '● Ollama live' : store.model }}
          </span>
          <span v-if="store.generating" class="gen-indicator">
            <span></span><span></span><span></span>
          </span>
          <button v-if="store.generating" class="btn btn-stop" @click="store.stopGenerating()">Stop</button>
          <button class="btn" style="padding:4px 10px;font-size:11px" @click="store.clearMessages()">Clear</button>
        </div>
      </div>

      <!-- Messages -->
      <div class="messages-area" ref="messagesEl">
        <div v-if="!store.messages.length" class="ai-welcome">
          <div class="welcome-logo">
            <svg width="48" height="48" viewBox="0 0 28 28" fill="none">
              <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" fill="none" stroke="#b877d9" stroke-width="1.5"/>
              <polygon points="14,7 21,11 21,17 14,21 7,17 7,11" fill="rgba(184,119,217,0.15)" stroke="#b877d9" stroke-width="1"/>
              <circle cx="14" cy="14" r="3" fill="#b877d9"/>
            </svg>
          </div>
          <h2 style="font-size:18px;font-weight:600;color:var(--text-primary)">Prism AI Workbench</h2>
          <p class="text-secondary" style="font-size:13px;text-align:center;max-width:360px;line-height:1.6">
            Ask questions about your graph topology, matrix analytics, vector embeddings, or NVMe performance.
            {{ store.ollamaLive ? 'Powered by local Ollama — responses stream in real-time.' : 'Connect Ollama for live LLM inference.' }}
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px">
            <button v-for="s in suggestions" :key="s" class="suggestion-btn" @click="useSuggestion(s)">{{ s }}</button>
          </div>
        </div>

        <div v-else class="messages-list">
          <div v-for="msg in store.messages" :key="msg.id" class="message-wrapper" :class="msg.role">
            <div class="msg-avatar" :class="msg.role">
              <span v-if="msg.role === 'user'">U</span>
              <svg v-else width="14" height="14" viewBox="0 0 28 28" fill="none">
                <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" fill="none" stroke="#b877d9" stroke-width="2"/>
                <circle cx="14" cy="14" r="3" fill="#b877d9"/>
              </svg>
            </div>
            <div class="msg-bubble" :class="msg.role">
              <div v-if="msg.streaming && !msg.content" class="thinking-dots">
                <span></span><span></span><span></span>
              </div>
              <div v-else class="msg-body" v-html="renderMsg(msg.content)"></div>
              <span v-if="msg.streaming" class="cursor-blink">▋</span>
              <div v-if="msg.role === 'assistant' && !msg.streaming" class="msg-footer">
                <span class="text-muted" style="font-size:10px">{{ formatTime(msg.timestamp) }}</span>
                <span v-if="msg.tokens" class="tag" style="font-size:10px">{{ msg.tokens }} tokens</span>
                <div v-if="msg.sources?.length" style="display:flex;gap:4px;flex-wrap:wrap">
                  <span
                    v-for="s in msg.sources"
                    :key="s"
                    class="tag source-tag"
                    style="font-size:10px"
                    @click="navigateToSource(s)"
                  >{{ s }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="input-area">
        <div class="input-row">
          <textarea
            v-model="store.prompt"
            class="prompt-input"
            placeholder="Ask Prism AI to analyze your graph, matrix, vectors, or NVMe performance…"
            rows="3"
            :disabled="store.generating"
            @keydown.enter.ctrl="submit"
            @keydown.enter.meta="submit"
          ></textarea>
          <button class="send-btn" :disabled="store.generating || !store.prompt.trim()" @click="submit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <div class="input-footer">
          <span class="text-muted" style="font-size:11px">Ctrl+Enter to send</span>
          <span class="text-muted" style="font-size:11px">
            Context: <span class="text-purple">{{ store.contextMode }}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Right: config + context -->
    <div class="ai-sidebar">
      <!-- Model config -->
      <div class="panel">
        <div class="panel-header"><span class="panel-title">Model Config</span></div>
        <div style="padding:12px;display:flex;flex-direction:column;gap:10px">
          <div>
            <div class="field-label">Model</div>
            <select v-model="store.model" class="field-select">
              <option v-for="m in store.models" :key="m" :value="m">{{ m }}</option>
            </select>
            <div v-if="!store.ollamaLive" class="ollama-hint">
              Ollama not detected — start it to enable local LLM inference
            </div>
          </div>
          <div>
            <div class="field-label">Context Mode</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              <button
                v-for="mode in ['graph','matrix','vector','full']" :key="mode"
                class="mode-btn"
                :class="{ active: store.contextMode === mode }"
                @click="store.contextMode = mode as any"
              >{{ mode }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- System prompt preview -->
      <div class="panel">
        <div class="panel-header"><span class="panel-title">System Prompt</span></div>
        <div style="padding:10px 12px">
          <p style="font-size:12px;color:var(--text-secondary);line-height:1.55">
            {{ store.systemPrompts[store.contextMode] }}
          </p>
          <p style="font-size:11px;color:var(--text-muted);margin-top:6px;line-height:1.4">
            Live engine state (graph topology, matrix summary, vector clusters) is injected automatically.
            Relevant embeddings are retrieved via RAG.
          </p>
        </div>
      </div>

      <!-- PrismQL shortcuts -->
      <div class="panel" style="flex:1">
        <div class="panel-header"><span class="panel-title">PrismQL Templates</span></div>
        <div style="padding:8px 12px;display:flex;flex-direction:column;gap:6px;overflow-y:auto">
          <div v-for="q in queries" :key="q.label" class="query-item" @click="store.prompt = q.query">
            <div style="font-size:12px;font-weight:500;color:var(--text-primary)">{{ q.label }}</div>
            <div style="font-size:10px;font-family:var(--font-mono);color:var(--accent-cyan);margin-top:2px">
              {{ q.query }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAIStore } from '@/stores/aiStore'

const store = useAIStore()
const router = useRouter()
const messagesEl = ref<HTMLElement | null>(null)

const suggestions = [
  'Analyze graph dependency risks',
  'Explain P&L variance drivers',
  'Find vector embedding clusters',
  'Optimize NVMe queue depth',
]

const queries = [
  { label: 'Graph Critical Path',  query: 'GRAPH MATCH (a)-[DEPENDS_ON]->(b) WHERE risk > 0.8 RETURN path' },
  { label: 'Vector Top-K Search',  query: 'VECTOR SIMILARITY id=customer_42 TOP 10 USING cosine' },
  { label: 'Matrix P&L',           query: 'MATRIX APPLY op="pnl" ON dataset=financials_fy2025' },
  { label: 'AI Risk Synthesis',    query: 'AI SYNTHESIZE context=graph+matrix PROMPT "identify top 3 risks"' },
  { label: 'NVMe Latency',         query: 'SELECT p99_latency FROM nvme_stats WHERE device="nvme0n1"' },
]

onMounted(() => {
  store.fetchModels()
})

// Auto-scroll to bottom when messages change or content updates
watch(
  () => store.messages.map(m => m.content).join(''),
  async () => {
    await nextTick()
    if (messagesEl.value) {
      messagesEl.value.scrollTop = messagesEl.value.scrollHeight
    }
  },
)

function submit() {
  if (!store.prompt.trim() || store.generating) return
  store.sendMessage(store.prompt)
}

function useSuggestion(s: string) {
  store.prompt = s
  store.sendMessage(s)
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Map a source citation like "graph/api-gw" to the corresponding explorer route. */
function navigateToSource(source: string) {
  const [engine] = source.split('/')
  const routeMap: Record<string, string> = {
    graph:  '/graph',
    matrix: '/matrix',
    vector: '/vector',
    nvme:   '/',
    bi:     '/',
  }
  const route = routeMap[engine]
  if (route) router.push(route)
}

function renderMsg(text: string) {
  return text
    .replace(/```([\s\S]*?)```/g, '<pre class="code-block"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^\|(.+)\|$/gm, (_: string, row: string) => {
      const cells = row.split('|').map((c: string) => `<td>${c.trim()}</td>`).join('')
      return `<tr>${cells}</tr>`
    })
    .replace(/(<tr>[\s\S]*?<\/tr>)+/g, (m: string) => `<table>${m}</table>`)
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)+/g, (m: string) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>')
}
</script>

<style scoped>
.ai-page {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 12px;
  height: calc(100vh - var(--header-height) - 28px);
}

.chat-area {
  display: flex; flex-direction: column; height: 100%; overflow: hidden;
}

.messages-area {
  flex: 1; overflow-y: auto; padding: 16px;
}

.ai-welcome {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; gap: 14px;
}

.messages-list { display: flex; flex-direction: column; gap: 16px; }

.message-wrapper {
  display: flex; gap: 10px; align-items: flex-start;
}
.message-wrapper.user { flex-direction: row-reverse; }

.msg-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 12px; font-weight: 600;
}
.msg-avatar.user { background: rgba(87,148,242,0.2); color: var(--accent-blue); border: 1px solid rgba(87,148,242,0.3); }
.msg-avatar.assistant { background: rgba(184,119,217,0.15); border: 1px solid rgba(184,119,217,0.3); }

.msg-bubble {
  max-width: 80%; padding: 10px 12px; border-radius: 8px; font-size: 13px; line-height: 1.6;
}
.msg-bubble.user { background: rgba(87,148,242,0.1); border: 1px solid rgba(87,148,242,0.2); border-radius: 8px 2px 8px 8px; }
.msg-bubble.assistant { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 2px 8px 8px 8px; }

.msg-body :deep(strong) { color: var(--text-primary); font-weight: 600; }
.msg-body :deep(code) { font-family: var(--font-mono); background: var(--bg-primary); padding: 1px 5px; border-radius: 3px; font-size: 12px; color: var(--accent-cyan); }
.msg-body :deep(pre.code-block) { background: var(--bg-primary); border: 1px solid var(--border); border-radius: 4px; padding: 10px 12px; margin: 8px 0; overflow-x: auto; font-size: 12px; font-family: var(--font-mono); color: var(--accent-green); }
.msg-body :deep(table) { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 12px; }
.msg-body :deep(td) { border: 1px solid var(--border); padding: 4px 8px; }
.msg-body :deep(tr:first-child td) { background: var(--bg-panel); font-weight: 600; }
.msg-body :deep(ul) { padding-left: 16px; margin: 6px 0; }
.msg-body :deep(li) { margin: 3px 0; }

.msg-footer { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 6px; }

.source-tag {
  cursor: pointer; transition: all 0.15s;
}
.source-tag:hover { background: rgba(25,221,226,0.15) !important; color: var(--accent-cyan) !important; }

.cursor-blink {
  display: inline-block; color: var(--accent-purple);
  animation: blink 1s step-start infinite;
}
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }

.thinking-dots { display: flex; gap: 5px; align-items: center; height: 20px; padding: 2px 0; }
.thinking-dots span { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-purple); animation: bounce 1s ease-in-out infinite; }
.thinking-dots span:nth-child(2) { animation-delay: 0.15s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.3s; }
@keyframes bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }

.input-area { border-top: 1px solid var(--border); padding: 12px; flex-shrink: 0; }
.input-row { display: flex; gap: 8px; align-items: flex-end; }
.prompt-input {
  flex: 1; background: var(--bg-secondary); border: 1px solid var(--border);
  color: var(--text-primary); padding: 10px 12px; border-radius: 6px;
  font-size: 13px; font-family: inherit; outline: none; resize: none;
  line-height: 1.5; transition: border-color 0.15s;
}
.prompt-input:focus { border-color: var(--accent-purple); }
.prompt-input:disabled { opacity: 0.6; }
.send-btn {
  width: 40px; height: 40px; border-radius: 6px;
  background: var(--accent-purple); border: none; color: #fff;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: opacity 0.15s; flex-shrink: 0;
}
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.send-btn:not(:disabled):hover { opacity: 0.85; }
.input-footer { display: flex; justify-content: space-between; margin-top: 6px; }

.btn-stop {
  padding: 4px 10px; font-size: 11px;
  background: rgba(255,80,80,0.15); border-color: rgba(255,80,80,0.4);
  color: #ff6060;
}
.btn-stop:hover { background: rgba(255,80,80,0.25); }

.badge-green { background: rgba(25,221,100,0.15) !important; color: #19dc64 !important; border-color: rgba(25,221,100,0.3) !important; }

.ollama-hint {
  font-size: 11px; color: var(--text-muted); margin-top: 5px; line-height: 1.4;
}

.ai-sidebar { display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.field-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
.field-select {
  width: 100%; background: var(--bg-secondary); border: 1px solid var(--border);
  color: var(--text-primary); padding: 6px 10px; border-radius: 4px; font-size: 12px; outline: none;
}
.mode-btn {
  padding: 4px 10px; border-radius: 4px; border: 1px solid var(--border);
  background: var(--bg-secondary); color: var(--text-secondary); font-size: 11px;
  cursor: pointer; transition: all 0.15s; text-transform: capitalize;
}
.mode-btn.active { background: rgba(184,119,217,0.15); border-color: var(--accent-purple); color: var(--accent-purple); }
.mode-btn:hover:not(.active) { border-color: var(--border-hover); color: var(--text-primary); }

.suggestion-btn {
  padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border);
  background: var(--bg-secondary); color: var(--text-secondary); font-size: 12px;
  cursor: pointer; transition: all 0.15s;
}
.suggestion-btn:hover { border-color: var(--accent-purple); color: var(--accent-purple); background: rgba(184,119,217,0.08); }

.query-item {
  padding: 8px 10px; border: 1px solid var(--border); border-radius: 4px;
  cursor: pointer; transition: all 0.15s;
}
.query-item:hover { border-color: var(--accent-cyan); background: rgba(25,221,226,0.05); }

.gen-indicator { display: flex; gap: 3px; align-items: center; }
.gen-indicator span { width: 4px; height: 4px; border-radius: 50%; background: var(--accent-purple); animation: bounce 1s ease-in-out infinite; }
.gen-indicator span:nth-child(2) { animation-delay: 0.15s; }
.gen-indicator span:nth-child(3) { animation-delay: 0.3s; }
</style>

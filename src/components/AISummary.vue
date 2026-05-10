<template>
  <div class="panel ai-panel">
    <div class="panel-header">
      <span class="panel-title">AI Synthesis</span>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="badge badge-purple">{{ store.model }}</span>
        <span v-if="store.generating" class="generating-dot"></span>
      </div>
    </div>
    <div class="panel-body ai-body">
      <div v-if="!store.messages.length" class="ai-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6b6b6b" stroke-width="1.5">
          <path d="M12 2a7 7 0 0 1 7 7 7 7 0 0 1-4 6.32V17a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1.68A7 7 0 0 1 5 9a7 7 0 0 1 7-7z"/>
          <line x1="10" y1="21" x2="14" y2="21"/>
        </svg>
        <span class="text-muted" style="font-size:12px">Ask the AI to analyze your data</span>
      </div>
      <div v-else class="messages">
        <div v-for="msg in store.messages.slice(-4)" :key="msg.id" class="message" :class="msg.role">
          <div class="msg-content" v-html="renderMsg(msg.content)"></div>
          <div v-if="msg.role === 'assistant' && msg.sources" class="msg-sources">
            <span v-for="s in msg.sources" :key="s" class="tag" style="font-size:10px">{{ s }}</span>
          </div>
        </div>
        <div v-if="store.generating" class="message assistant">
          <div class="msg-content thinking">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    </div>
    <div class="ai-input">
      <input
        v-model="draft"
        class="ai-input-field"
        placeholder="Ask Prism AI…"
        @keydown.enter="submit"
      />
      <button class="btn btn-primary" style="padding:6px 10px;flex-shrink:0" @click="submit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAIStore } from '@/stores/aiStore'

const store = useAIStore()
const draft = ref('')

function submit() {
  if (!draft.value.trim() || store.generating) return
  store.sendMessage(draft.value)
  draft.value = ''
}

function renderMsg(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>')
}
</script>

<style scoped>
.ai-panel { height: 100%; display: flex; flex-direction: column; }
.ai-body { flex: 1; overflow-y: auto; padding: 12px; }
.ai-empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
.messages { display: flex; flex-direction: column; gap: 8px; }
.message { padding: 8px 10px; border-radius: 6px; font-size: 12px; line-height: 1.55; }
.message.user { background: rgba(87,148,242,0.1); border: 1px solid rgba(87,148,242,0.2); color: var(--text-primary); align-self: flex-end; max-width: 90%; }
.message.assistant { background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-primary); }
.msg-content :deep(code) { font-family: var(--font-mono); background: var(--bg-primary); padding: 1px 4px; border-radius: 3px; font-size: 11px; color: var(--accent-cyan); }
.msg-sources { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px; }
.thinking { display: flex; gap: 5px; align-items: center; height: 20px; }
.thinking span { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-purple); animation: bounce 1s ease-in-out infinite; }
.thinking span:nth-child(2) { animation-delay: 0.15s; }
.thinking span:nth-child(3) { animation-delay: 0.3s; }
@keyframes bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
.generating-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-purple); animation: pulse 1s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
.ai-input { display: flex; gap: 6px; padding: 8px 12px; border-top: 1px solid var(--border); flex-shrink: 0; }
.ai-input-field {
  flex: 1; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 4px;
  color: var(--text-primary); padding: 6px 10px; font-size: 12px; outline: none;
  font-family: inherit; transition: border-color 0.15s;
}
.ai-input-field:focus { border-color: var(--accent-purple); }
</style>

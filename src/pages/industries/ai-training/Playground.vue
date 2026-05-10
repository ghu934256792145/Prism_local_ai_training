<template>
  <div class="pg-page">

    <!-- ── Left column: config panel ─────────────────────────────────────────── -->
    <div class="pg-config">

      <!-- Model select -->
      <div class="config-section">
        <label class="field-label">Model</label>
        <div v-if="loadingModels" class="input input--loading">
          <span class="spinner spinner--sm"></span> Loading models…
        </div>
        <select v-else v-model="selectedModel" class="input select-input" @change="onModelChange">
          <option value="">Select a model…</option>
          <optgroup v-if="registryModels.length" label="Trained Models">
            <option v-for="m in registryModels" :key="m.id" :value="m.id">
              {{ m.name }}
            </option>
          </optgroup>
          <optgroup v-if="ollamaModels.length" label="Ollama">
            <option v-for="m in ollamaModels" :key="`ollama:${m}`" :value="`ollama:${m}`">
              Ollama: {{ m }}
            </option>
          </optgroup>
        </select>
      </div>

      <!-- Model info card (trained models only) -->
      <Transition name="slide-down">
        <div v-if="selectedRegistryModel" class="model-info-card">
          <div class="mic-row">
            <span class="mic-label">Base</span>
            <span class="mic-val">{{ selectedRegistryModel.base_model }}</span>
          </div>
          <div class="mic-row">
            <span class="mic-label">Approach</span>
            <span class="mic-val">
              <span class="approach-chip">{{ selectedRegistryModel.approach }}</span>
            </span>
          </div>
          <div class="mic-row">
            <span class="mic-label">Final Loss</span>
            <span class="mic-val mic-val--mono">{{ selectedRegistryModel.final_loss.toFixed(4) }}</span>
          </div>
          <div class="mic-row">
            <span class="mic-label">Epochs</span>
            <span class="mic-val mic-val--mono">{{ selectedRegistryModel.epochs }}</span>
          </div>
        </div>
      </Transition>

      <!-- System prompt -->
      <div class="config-section">
        <label class="field-label">System Prompt</label>
        <textarea
          v-model="systemPrompt"
          class="input textarea"
          rows="3"
          placeholder="You are a helpful assistant."
        ></textarea>
      </div>

      <!-- Temperature slider -->
      <div class="config-section">
        <div class="field-label-row">
          <label class="field-label">Temperature</label>
          <span class="field-value-badge">{{ temperature.toFixed(1) }}</span>
        </div>
        <input
          v-model.number="temperature"
          type="range"
          min="0"
          max="2"
          step="0.1"
          class="range-input"
        />
        <div class="range-ticks">
          <span>0</span><span>0.5</span><span>1.0</span><span>1.5</span><span>2.0</span>
        </div>
      </div>

      <!-- Max tokens -->
      <div class="config-section">
        <label class="field-label">Max Tokens</label>
        <input
          v-model.number="maxTokens"
          class="input"
          type="number"
          min="64"
          max="8192"
          step="64"
        />
      </div>

      <!-- Context mode -->
      <div class="config-section">
        <label class="field-label">Context Mode</label>
        <select v-model="contextMode" class="input select-input">
          <option value="full">Full</option>
          <option value="graph">Graph</option>
          <option value="local">Local</option>
          <option value="none">None</option>
        </select>
      </div>

      <!-- Clear chat -->
      <div class="config-section config-section--bottom">
        <button class="btn btn-clear" @click="clearChat">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
          Clear Chat
        </button>
      </div>

    </div>

    <!-- ── Right column: chat area ────────────────────────────────────────────── -->
    <div class="pg-chat">

      <!-- Quick prompts row -->
      <div class="quick-prompts">
        <button
          v-for="qp in QUICK_PROMPTS"
          :key="qp"
          class="qp-chip"
          @click="insertQuickPrompt(qp)"
        >{{ qp }}</button>
      </div>

      <!-- Message list -->
      <div ref="messagesEl" class="chat-messages">

        <!-- Empty state -->
        <div v-if="messages.length === 0" class="chat-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#484f58" stroke-width="1.4">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <p>Send a message to get started</p>
        </div>

        <!-- Messages -->
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="chat-message"
          :class="msg.role === 'user' ? 'chat-message--user' : 'chat-message--assistant'"
        >
          <div class="msg-meta">
            <span class="msg-sender">{{ msg.role === 'user' ? 'You' : 'Assistant' }}</span>
            <span class="msg-time">{{ formatTime(msg.timestamp) }}</span>
          </div>
          <div class="msg-bubble" :class="msg.role === 'user' ? 'msg-bubble--user' : 'msg-bubble--assistant'">
            <span class="msg-text">{{ msg.content }}</span><span
              v-if="msg.streaming"
              class="msg-cursor"
            >▋</span>
          </div>
        </div>

      </div>

      <!-- Input area -->
      <div class="chat-input-area">
        <textarea
          ref="inputEl"
          v-model="inputText"
          class="chat-input"
          :disabled="streaming"
          placeholder="Type a message…"
          rows="2"
          @keydown.enter.exact.prevent="sendMessage"
          @keydown.enter.shift.exact="() => {}"
        ></textarea>
        <button
          class="btn btn-send"
          :disabled="streaming || !inputText.trim() || !selectedModel"
          @click="sendMessage"
        >
          <span v-if="streaming" class="spinner"></span>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          {{ streaming ? 'Streaming…' : 'Send' }}
        </button>
      </div>

    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { usePrismAPI } from '@/composables/usePrismAPI'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrainedModel {
  id: string
  name: string
  base_model: string
  final_loss: number
  epochs: number
  approach: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  streaming?: boolean
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const api   = usePrismAPI()
const route = useRoute()

// ── Quick prompts ─────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  'Explain this architecture',
  'What components are critical path?',
  'Generate training data from this graph',
  'Summarize the pipeline design',
]

// ── State ─────────────────────────────────────────────────────────────────────

const loadingModels    = ref(true)
const registryModels   = ref<TrainedModel[]>([])
const ollamaModels     = ref<string[]>([])
const selectedModel    = ref('')

const systemPrompt     = ref('You are a helpful assistant.')
const temperature      = ref(0.7)
const maxTokens        = ref(512)
const contextMode      = ref<'full' | 'graph' | 'local' | 'none'>('full')

const messages         = ref<ChatMessage[]>([])
const inputText        = ref('')
const streaming        = ref(false)

const messagesEl       = ref<HTMLElement | null>(null)
const inputEl          = ref<HTMLTextAreaElement | null>(null)

let   abortCtrl: AbortController | null = null

// ── Computed ──────────────────────────────────────────────────────────────────

const selectedRegistryModel = computed(() =>
  registryModels.value.find(m => m.id === selectedModel.value) ?? null
)

/** Resolve model name to pass to the API: strip "ollama:" prefix for ollama models */
const resolvedModel = computed(() => {
  if (selectedModel.value.startsWith('ollama:')) {
    return selectedModel.value.slice(7)
  }
  return selectedModel.value
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

async function scrollToBottom() {
  await nextTick()
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadModels() {
  loadingModels.value = true

  const [registryRes, ollamaRes] = await Promise.all([
    api.get<{ models: TrainedModel[] }>('/train/models'),
    api.get<{ models: string[]; ollama: boolean }>('/ai/models'),
  ])

  if (registryRes?.models) registryModels.value = registryRes.models
  if (ollamaRes?.models)   ollamaModels.value   = ollamaRes.models

  // Pre-select model_id from query param if present
  const qid = route.query.model_id as string | undefined
  if (qid && registryModels.value.find(m => m.id === qid)) {
    selectedModel.value = qid
  } else if (ollamaModels.value.length) {
    selectedModel.value = `ollama:${ollamaModels.value[0]}`
  } else if (registryModels.value.length) {
    selectedModel.value = registryModels.value[0].id
  }

  loadingModels.value = false
}

function onModelChange() {
  // nothing extra needed — computed handles the info card
}

// ── Chat actions ──────────────────────────────────────────────────────────────

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || !selectedModel.value || streaming.value) return

  inputText.value = ''

  messages.value.push({
    role: 'user',
    content: text,
    timestamp: new Date(),
  })

  const assistantMsg: ChatMessage = {
    role: 'assistant',
    content: '',
    timestamp: new Date(),
    streaming: true,
  }
  messages.value.push(assistantMsg)
  await scrollToBottom()

  streaming.value = true
  abortCtrl = new AbortController()

  const fullPrompt = systemPrompt.value
    ? `${systemPrompt.value}\n\n${text}`
    : text

  try {
    await api.streamAI(
      fullPrompt,
      { model: resolvedModel.value, contextMode: contextMode.value },
      abortCtrl.signal,
      (token: string) => {
        assistantMsg.content += token
        // trigger reactivity
        messages.value = [...messages.value]
        scrollToBottom()
      },
      (_sources: string[]) => {
        assistantMsg.streaming = false
        messages.value = [...messages.value]
        streaming.value = false
        abortCtrl = null
        scrollToBottom()
      },
    )
  } catch {
    assistantMsg.streaming = false
    assistantMsg.content += '\n[Stream interrupted]'
    messages.value = [...messages.value]
    streaming.value = false
    abortCtrl = null
  }

  await nextTick()
  inputEl.value?.focus()
}

function clearChat() {
  if (streaming.value) {
    abortCtrl?.abort()
    streaming.value = false
    abortCtrl = null
  }
  messages.value = []
}

function insertQuickPrompt(prompt: string) {
  inputText.value = prompt
  inputEl.value?.focus()
}

// ── Watch route query to pre-select model ─────────────────────────────────────

watch(
  () => route.query.model_id,
  (id) => {
    if (id && typeof id === 'string' && registryModels.value.find(m => m.id === id)) {
      selectedModel.value = id
    }
  },
)

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(loadModels)

onUnmounted(() => {
  abortCtrl?.abort()
})
</script>

<style scoped>
/* ── Page shell ──────────────────────────────────────────────────────────── */
.pg-page {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: #0d1117;
  color: #e6edf3;
  font-size: 13px;
}

/* ── Config panel ────────────────────────────────────────────────────────── */
.pg-config {
  width: 320px;
  min-width: 320px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #30363d;
  overflow-y: auto;
  padding: 16px;
  gap: 0;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 16px;
  margin-bottom: 4px;
  border-bottom: 1px solid rgba(48,54,61,0.5);
}

.config-section:last-child,
.config-section--bottom {
  border-bottom: none;
  margin-top: auto;
  padding-top: 8px;
}

/* ── Field labels ────────────────────────────────────────────────────────── */
.field-label {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #8b949e;
}

.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field-value-badge {
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #3b82f6;
  background: rgba(59,130,246,0.1);
  border: 1px solid rgba(59,130,246,0.25);
  border-radius: 6px;
  padding: 1px 7px;
}

/* ── Model info card ─────────────────────────────────────────────────────── */
.model-info-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 7px;
  padding: 4px 0;
  margin-bottom: 4px;
  overflow: hidden;
}

.mic-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px;
  border-bottom: 1px solid rgba(48,54,61,0.4);
}

.mic-row:last-child {
  border-bottom: none;
}

.mic-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #484f58;
}

.mic-val {
  font-size: 12px;
  color: #c9d1d9;
}

.mic-val--mono {
  font-family: 'Consolas', 'Fira Mono', monospace;
  font-variant-numeric: tabular-nums;
}

/* ── Approach chip ───────────────────────────────────────────────────────── */
.approach-chip {
  display: inline-flex;
  padding: 1px 7px;
  border-radius: 8px;
  font-size: 10.5px;
  font-weight: 600;
  background: rgba(59,130,246,0.1);
  border: 1px solid rgba(59,130,246,0.25);
  color: #3b82f6;
}

/* ── Range slider ────────────────────────────────────────────────────────── */
.range-input {
  width: 100%;
  accent-color: #3b82f6;
  cursor: pointer;
  margin: 2px 0 0;
}

.range-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 9.5px;
  color: #484f58;
  margin-top: 2px;
}

/* ── Form elements ───────────────────────────────────────────────────────── */
.input {
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #e6edf3;
  font-size: 13px;
  padding: 7px 10px;
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
  font-family: inherit;
}

.input:focus    { border-color: #3b82f6; }
.input::placeholder { color: #484f58; }

.input--loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #484f58;
  font-size: 12px;
  pointer-events: none;
}

.select-input {
  cursor: pointer;
}

.textarea {
  resize: vertical;
  min-height: 60px;
  line-height: 1.5;
}

/* ── Chat column ─────────────────────────────────────────────────────────── */
.pg-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Quick prompts ───────────────────────────────────────────────────────── */
.quick-prompts {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 12px 16px;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;
}

.qp-chip {
  display: inline-flex;
  align-items: center;
  padding: 5px 11px;
  border-radius: 14px;
  font-size: 11.5px;
  border: 1px solid #30363d;
  background: rgba(48,54,61,0.4);
  color: #8b949e;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.qp-chip:hover {
  border-color: #3b82f6;
  color: #c9d1d9;
  background: rgba(59,130,246,0.06);
}

/* ── Messages list ───────────────────────────────────────────────────────── */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #484f58;
  font-size: 13px;
}

/* ── Message item ────────────────────────────────────────────────────────── */
.chat-message {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 75%;
}

.chat-message--user {
  align-self: flex-end;
  align-items: flex-end;
}

.chat-message--assistant {
  align-self: flex-start;
  align-items: flex-start;
}

.msg-meta {
  display: flex;
  align-items: center;
  gap: 7px;
}

.msg-sender {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #484f58;
}

.msg-time {
  font-size: 10px;
  color: #484f58;
}

.msg-bubble {
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  line-height: 1.55;
  word-break: break-word;
}

.msg-bubble--user {
  background: #3b82f6;
  color: #fff;
  border-bottom-right-radius: 3px;
}

.msg-bubble--assistant {
  background: #161b22;
  border: 1px solid #30363d;
  color: #e6edf3;
  border-bottom-left-radius: 3px;
}

.msg-text {
  white-space: pre-wrap;
}

.msg-cursor {
  display: inline-block;
  color: #3b82f6;
  font-weight: 700;
  animation: blink 0.8s step-end infinite;
  margin-left: 1px;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

/* ── Input area ──────────────────────────────────────────────────────────── */
.chat-input-area {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid #30363d;
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  color: #e6edf3;
  font-size: 13px;
  padding: 10px 12px;
  outline: none;
  resize: none;
  transition: border-color 0.15s;
  font-family: inherit;
  line-height: 1.5;
  max-height: 160px;
  overflow-y: auto;
}

.chat-input:focus { border-color: #3b82f6; }
.chat-input::placeholder { color: #484f58; }
.chat-input:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #30363d;
  background: transparent;
  color: #8b949e;
  transition: all 0.15s;
  flex-shrink: 0;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-send {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
  font-weight: 600;
  padding: 10px 20px;
  align-self: flex-end;
}

.btn-send:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
}

.btn-clear {
  border-color: rgba(239,68,68,0.3);
  color: #ef4444;
  width: 100%;
  justify-content: center;
}

.btn-clear:hover {
  background: rgba(239,68,68,0.08);
  border-color: #ef4444;
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */
.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255,255,255,0.25);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
  flex-shrink: 0;
}

.spinner--sm {
  width: 11px;
  height: 11px;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Slide-down transition ───────────────────────────────────────────────── */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: max-height 0.25s ease, opacity 0.2s ease;
  overflow: hidden;
  max-height: 200px;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>

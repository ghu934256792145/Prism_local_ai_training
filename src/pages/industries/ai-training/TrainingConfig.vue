<template>
  <div class="tc-page">

    <!-- ── Page header ─────────────────────────────────────────────────────── -->
    <div class="tc-header">
      <div>
        <h1 class="tc-title">Training Run Configuration</h1>
        <p class="tc-subtitle">Configure and launch a model fine-tuning or embedding training run.</p>
      </div>
    </div>

    <!-- ── Success toast ───────────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="toast-slide">
        <div v-if="showToast" class="toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Training run launched successfully!
        </div>
      </Transition>
    </Teleport>

    <div class="form-body">

      <!-- ╔══ Section: Run Identity ══════════════════════════════════════════ -->
      <div class="form-section panel">
        <div class="section-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
          Run Identity
        </div>
        <div class="section-body">
          <div class="row-2">
            <div class="field-group">
              <label class="field-label">Run Name</label>
              <input v-model="runName" class="input" type="text" :placeholder="runNamePlaceholder" />
            </div>
            <div class="field-group">
              <label class="field-label">Tags <span class="label-hint">(comma-separated)</span></label>
              <input v-model="tagsRaw" class="input" type="text" placeholder="experiment, lora, v2…" />
            </div>
          </div>
        </div>
      </div>

      <!-- ╔══ Section: Model ════════════════════════════════════════════════ -->
      <div class="form-section panel">
        <div class="section-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
          Model
        </div>
        <div class="section-body">

          <!-- Model type radio cards -->
          <div class="field-group">
            <label class="field-label">Model Type</label>
            <div class="radio-cards">
              <label
                v-for="mt in MODEL_TYPES"
                :key="mt.value"
                class="radio-card"
                :class="{ 'radio-card--active': modelType === mt.value }"
              >
                <input v-model="modelType" type="radio" :value="mt.value" class="hidden-radio" />
                <span v-html="mt.icon" class="radio-card-icon"></span>
                <span class="radio-card-label">{{ mt.label }}</span>
              </label>
            </div>
          </div>

          <!-- Base model input depending on type -->
          <div class="field-group" style="margin-top:4px">
            <label class="field-label">Base Model</label>

            <!-- LLM: select from fetched Ollama models -->
            <template v-if="modelType === 'llm'">
              <select v-if="ollamaModels.length > 0" v-model="baseModel" class="input select-input">
                <option v-for="m in ollamaModels" :key="m" :value="m">{{ m }}</option>
              </select>
              <input v-else v-model="baseModel" class="input" type="text" placeholder="e.g. llama3:latest" />
              <p v-if="ollamaModels.length === 0" class="hint-text" style="margin-top:4px">
                Could not fetch Ollama models — enter model name manually.
              </p>
            </template>

            <!-- Graph: pre-filled read-only -->
            <input v-else-if="modelType === 'graph'" class="input input--readonly" type="text" value="prism-graph-v1" readonly />

            <!-- Classification: pre-filled read-only -->
            <input v-else class="input input--readonly" type="text" value="prism-classifier-v1" readonly />
          </div>

          <!-- HuggingFace model ID (only when backend = huggingface) -->
          <Transition name="expand-down">
            <div v-if="backend === 'huggingface'" class="field-group" style="margin-top:4px">
              <label class="field-label">HuggingFace Model ID</label>
              <input v-model="hfModelId" class="input" type="text" placeholder="e.g. meta-llama/Llama-2-7b-hf" />
            </div>
          </Transition>

        </div>
      </div>

      <!-- ╔══ Section: Dataset ══════════════════════════════════════════════ -->
      <div class="form-section panel">
        <div class="section-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
            <path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9"/>
            <path d="M3 13v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4"/>
          </svg>
          Dataset
        </div>
        <div class="section-body">
          <div class="row-2">
            <div class="field-group">
              <label class="field-label">Training Dataset</label>
              <select v-if="!datasetsLoading" v-model="selectedDatasetId" class="input select-input">
                <option value="" disabled>Select a dataset…</option>
                <option v-for="ds in datasets" :key="ds.id" :value="ds.id">
                  {{ ds.name }}  ({{ ds.examples?.length ?? 0 }} examples)
                </option>
              </select>
              <div v-else class="input input--loading">
                <span class="spinner spinner--sm"></span> Loading datasets…
              </div>
            </div>
            <div class="field-group" style="justify-content:flex-end;padding-bottom:1px">
              <router-link to="/ai-training/datasets/new" class="link-btn">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Generate new dataset
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- ╔══ Section: Approach ═════════════════════════════════════════════ -->
      <div class="form-section panel">
        <div class="section-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          Approach
        </div>
        <div class="section-body">
          <div class="radio-cards radio-cards--2col">
            <label
              v-for="ap in APPROACHES"
              :key="ap.value"
              class="radio-card radio-card--desc"
              :class="{ 'radio-card--active': approach === ap.value }"
            >
              <input v-model="approach" type="radio" :value="ap.value" class="hidden-radio" />
              <div class="radio-card-top">
                <span class="radio-card-label">{{ ap.label }}</span>
                <span class="radio-card-dot" :class="{ 'radio-card-dot--on': approach === ap.value }"></span>
              </div>
              <p class="radio-card-desc">{{ ap.desc }}</p>
            </label>
          </div>
        </div>
      </div>

      <!-- ╔══ Section: Hyperparameters (collapsible) ════════════════════════ -->
      <div class="form-section panel">
        <button class="section-header section-header--btn" @click="hyperOpen = !hyperOpen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="4" y1="21" x2="4" y2="14"/>
            <line x1="4" y1="10" x2="4" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12" y2="3"/>
            <line x1="20" y1="21" x2="20" y2="16"/>
            <line x1="20" y1="12" x2="20" y2="3"/>
            <line x1="1" y1="14" x2="7" y2="14"/>
            <line x1="9" y1="8" x2="15" y2="8"/>
            <line x1="17" y1="16" x2="23" y2="16"/>
          </svg>
          Hyperparameters
          <span class="collapse-hint">{{ hyperOpen ? 'collapse' : 'expand' }}</span>
          <svg
            class="chevron"
            :class="{ 'chevron--open': hyperOpen }"
            width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2.5"
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <Transition name="expand-down">
          <div v-if="hyperOpen" class="section-body">
            <div class="row-4">
              <div class="field-group">
                <label class="field-label">Epochs</label>
                <input v-model.number="epochs" class="input" type="number" min="1" max="50" />
              </div>
              <div class="field-group">
                <label class="field-label">Batch Size</label>
                <input v-model.number="batchSize" class="input" type="number" min="1" max="64" />
              </div>
              <div class="field-group">
                <label class="field-label">Learning Rate</label>
                <input v-model="learningRate" class="input" type="text" placeholder="2e-5" />
              </div>
              <div class="field-group">
                <label class="field-label">Warmup Steps</label>
                <input v-model.number="warmupSteps" class="input" type="number" min="0" />
              </div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- ╔══ Section: Backend ══════════════════════════════════════════════ -->
      <div class="form-section panel">
        <div class="section-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
            <line x1="6" y1="6" x2="6.01" y2="6"/>
            <line x1="6" y1="18" x2="6.01" y2="18"/>
          </svg>
          Backend
        </div>
        <div class="section-body">
          <div class="radio-cards">
            <label
              v-for="be in BACKENDS"
              :key="be.value"
              class="radio-card"
              :class="{ 'radio-card--active': backend === be.value }"
            >
              <input v-model="backend" type="radio" :value="be.value" class="hidden-radio" />
              <span v-html="be.icon" class="radio-card-icon"></span>
              <span class="radio-card-label">{{ be.label }}</span>
            </label>
          </div>

          <!-- HuggingFace API key -->
          <Transition name="expand-down">
            <div v-if="backend === 'huggingface'" class="field-group" style="margin-top:12px">
              <label class="field-label">HuggingFace API Key</label>
              <input v-model="hfApiKey" class="input" type="password" placeholder="hf_…" autocomplete="off" />
            </div>
          </Transition>
        </div>
      </div>

      <!-- ╔══ Section: Launch ═══════════════════════════════════════════════ -->
      <div class="launch-bar panel">
        <div v-if="launchError" class="error-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {{ launchError }}
        </div>

        <div class="launch-inner">
          <div class="launch-summary">
            <span class="launch-pill">{{ modelTypeLabel }}</span>
            <span class="launch-pill">{{ approachLabel }}</span>
            <span class="launch-pill">{{ backendLabel }}</span>
            <span v-if="selectedDatasetId" class="launch-pill launch-pill--blue">dataset selected</span>
          </div>
          <button
            class="btn btn-launch"
            :disabled="launching || !selectedDatasetId || !runName.trim()"
            @click="launchRun"
          >
            <span v-if="launching" class="spinner"></span>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            {{ launching ? 'Launching…' : 'Launch Training Run' }}
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePrismAPI } from '@/composables/usePrismAPI'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Dataset {
  id: string
  name: string
  examples?: any[]
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const router = useRouter()
const api    = usePrismAPI()

// ── Static config ─────────────────────────────────────────────────────────────

const MODEL_TYPES = [
  {
    value: 'llm',
    label: 'LLM Fine-tune',
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  },
  {
    value: 'graph',
    label: 'Graph Embedding',
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
  },
  {
    value: 'classification',
    label: 'General Classification',
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
  },
]

const APPROACHES = [
  { value: 'lora',      label: 'LoRA',           desc: 'Efficient parameter-efficient fine-tuning, 10x less VRAM' },
  { value: 'qlora',     label: 'QLoRA',          desc: '4-bit quantized LoRA, runs on consumer GPU' },
  { value: 'full',      label: 'Full Fine-tune',  desc: 'All weights updated, highest quality' },
  { value: 'embedding', label: 'Embedding Only',  desc: 'Train only embeddings layer' },
]

const BACKENDS = [
  {
    value: 'ollama',
    label: 'Ollama (local)',
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
  },
  {
    value: 'huggingface',
    label: 'HuggingFace API',
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  },
  {
    value: 'mock',
    label: 'Mock (simulate)',
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
  },
]

// ── Run Identity ──────────────────────────────────────────────────────────────

const runName           = ref('')
const runNamePlaceholder = `run-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-001`
const tagsRaw           = ref('')

// ── Model ─────────────────────────────────────────────────────────────────────

const modelType    = ref<'llm' | 'graph' | 'classification'>('llm')
const baseModel    = ref('llama3:latest')
const hfModelId    = ref('')
const ollamaModels = ref<string[]>([])

// ── Dataset ───────────────────────────────────────────────────────────────────

const datasets          = ref<Dataset[]>([])
const datasetsLoading   = ref(true)
const selectedDatasetId = ref('')

// ── Approach ──────────────────────────────────────────────────────────────────

const approach = ref<'lora' | 'qlora' | 'full' | 'embedding'>('lora')

// ── Hyperparameters ───────────────────────────────────────────────────────────

const hyperOpen    = ref(false)
const epochs       = ref(3)
const batchSize    = ref(8)
const learningRate = ref('2e-5')
const warmupSteps  = ref(100)

// ── Backend ───────────────────────────────────────────────────────────────────

const backend  = ref<'ollama' | 'huggingface' | 'mock'>('ollama')
const hfApiKey = ref('')

// ── Launch state ──────────────────────────────────────────────────────────────

const launching   = ref(false)
const launchError = ref('')
const showToast   = ref(false)

// ── Computed labels (for launch summary pills) ────────────────────────────────

const modelTypeLabel = computed(() =>
  MODEL_TYPES.find(m => m.value === modelType.value)?.label ?? modelType.value
)

const approachLabel = computed(() =>
  APPROACHES.find(a => a.value === approach.value)?.label ?? approach.value
)

const backendLabel = computed(() =>
  BACKENDS.find(b => b.value === backend.value)?.label ?? backend.value
)

// ── Data loading ──────────────────────────────────────────────────────────────

async function fetchModels() {
  const res = await api.get<{ models: string[]; ollama: boolean }>('/ai/models')
  if (res?.models?.length) {
    ollamaModels.value = res.models
    baseModel.value    = res.models[0]
  }
}

async function fetchDatasets() {
  const res = await api.get<{ datasets: Dataset[] }>('/train/datasets')
  if (res?.datasets) {
    datasets.value = res.datasets
  }
  datasetsLoading.value = false
}

// ── Launch training run ────────────────────────────────────────────────────────

async function launchRun() {
  launchError.value = ''
  launching.value   = true

  const tags = tagsRaw.value
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)

  const payload: Record<string, unknown> = {
    name:          runName.value.trim() || runNamePlaceholder,
    tags,
    model_type:    modelType.value,
    base_model:    modelType.value === 'llm' ? baseModel.value
                 : modelType.value === 'graph' ? 'prism-graph-v1'
                 : 'prism-classifier-v1',
    dataset_id:    selectedDatasetId.value,
    approach:      approach.value,
    backend:       backend.value,
    hyperparameters: {
      epochs:        epochs.value,
      batch_size:    batchSize.value,
      learning_rate: learningRate.value,
      warmup_steps:  warmupSteps.value,
    },
  }

  if (backend.value === 'huggingface') {
    payload.hf_model_id = hfModelId.value
    if (hfApiKey.value) payload.hf_api_key = hfApiKey.value
  }

  const res = await api.post<{ id?: string; ok?: boolean }>('/train/runs', payload)
  launching.value = false

  if (res) {
    showToast.value = true
    setTimeout(() => {
      showToast.value = false
      router.push('/ai-training/monitor')
    }, 1800)
  } else {
    launchError.value = 'Failed to launch training run. Check the API connection and try again.'
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(() => {
  fetchModels()
  fetchDatasets()
})
</script>

<style scoped>
/* ── Page shell ──────────────────────────────────────────────────────────── */
.tc-page {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 20px 24px 32px;
  height: 100%;
  overflow-y: auto;
  background: #0d1117;
  color: #e6edf3;
  font-size: 13px;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.tc-header {
  margin-bottom: 16px;
}

.tc-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #e6edf3;
}

.tc-subtitle {
  font-size: 12px;
  color: #8b949e;
  margin-top: 3px;
}

/* ── Form body ───────────────────────────────────────────────────────────── */
.form-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Shared panel ────────────────────────────────────────────────────────── */
.panel {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  overflow: hidden;
}

/* ── Section header ──────────────────────────────────────────────────────── */
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #8b949e;
  border-bottom: 1px solid #30363d;
}

.section-header--btn {
  width: 100%;
  background: none;
  border: none;
  border-bottom: 1px solid #30363d;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.section-header--btn:hover {
  background: rgba(255, 255, 255, 0.02);
}

.collapse-hint {
  font-size: 10px;
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: #484f58;
  margin-left: auto;
  margin-right: 4px;
}

.chevron {
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.chevron--open {
  transform: rotate(180deg);
}

/* ── Section body ────────────────────────────────────────────────────────── */
.section-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Grid helpers ────────────────────────────────────────────────────────── */
.row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  align-items: end;
}

.row-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

/* ── Form primitives ─────────────────────────────────────────────────────── */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #8b949e;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 4px;
}

.label-hint {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  color: #484f58;
}

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
}

.input:focus {
  border-color: #3b82f6;
}

.input::placeholder {
  color: #484f58;
}

.input--readonly {
  color: #8b949e;
  cursor: default;
}

.input--loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #484f58;
  font-size: 12px;
}

.select-input {
  cursor: pointer;
}

/* ── Radio cards ─────────────────────────────────────────────────────────── */
.radio-cards {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.radio-cards--2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.radio-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid #30363d;
  border-radius: 7px;
  cursor: pointer;
  background: transparent;
  transition: all 0.15s;
  min-width: 0;
}

.radio-card:hover {
  border-color: #484f58;
  background: rgba(255, 255, 255, 0.02);
}

.radio-card--active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.08);
}

.radio-card--desc {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  padding: 12px 14px;
}

.radio-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.radio-card-icon {
  display: flex;
  align-items: center;
  color: #8b949e;
  flex-shrink: 0;
}

.radio-card--active .radio-card-icon {
  color: #3b82f6;
}

.radio-card-label {
  font-size: 12px;
  font-weight: 600;
  color: #c9d1d9;
  white-space: nowrap;
}

.radio-card--active .radio-card-label {
  color: #e6edf3;
}

.radio-card-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid #30363d;
  flex-shrink: 0;
  transition: all 0.15s;
}

.radio-card-dot--on {
  border-color: #3b82f6;
  background: #3b82f6;
}

.radio-card-desc {
  font-size: 11px;
  color: #8b949e;
  line-height: 1.4;
  margin: 0;
}

.radio-card--active .radio-card-desc {
  color: #c9d1d9;
}

.hidden-radio {
  display: none;
}

/* ── Link button ─────────────────────────────────────────────────────────── */
.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #3b82f6;
  text-decoration: none;
  padding: 5px 0;
  transition: opacity 0.15s;
}

.link-btn:hover {
  opacity: 0.75;
}

/* ── Expand-down transition ──────────────────────────────────────────────── */
.expand-down-enter-active,
.expand-down-leave-active {
  transition: max-height 0.25s ease, opacity 0.2s ease;
  overflow: hidden;
  max-height: 200px;
}

.expand-down-enter-from,
.expand-down-leave-to {
  max-height: 0;
  opacity: 0;
}

/* ── Launch bar ──────────────────────────────────────────────────────────── */
.launch-bar {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: visible;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(239, 68, 68, 0.08);
  border-bottom: 1px solid rgba(239, 68, 68, 0.2);
  font-size: 12px;
  color: #ef4444;
}

.launch-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  flex-wrap: wrap;
}

.launch-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.launch-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  background: rgba(48, 54, 61, 0.6);
  border: 1px solid #30363d;
  color: #8b949e;
}

.launch-pill--blue {
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 18px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #30363d;
  background: transparent;
  color: #8b949e;
  transition: all 0.15s;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-launch {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
  padding: 9px 22px;
  font-size: 14px;
  font-weight: 600;
}

.btn-launch:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
}

/* ── Hint text ───────────────────────────────────────────────────────────── */
.hint-text {
  font-size: 11px;
  color: #484f58;
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */
.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  flex-shrink: 0;
}

.spinner--sm {
  width: 11px;
  height: 11px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Toast ───────────────────────────────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 28px;
  right: 28px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  background: #161b22;
  border: 1px solid rgba(34, 197, 94, 0.35);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #e6edf3;
  z-index: 9999;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.toast-slide-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.toast-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-slide-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>

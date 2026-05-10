<template>
  <div class="db-page">

    <!-- ── Page header ─────────────────────────────────────────────────────── -->
    <div class="db-header">
      <div>
        <h1 class="db-title">Dataset Builder</h1>
        <p class="db-subtitle">Stage examples from multiple sources, then save as a named dataset.</p>
      </div>
      <span class="example-badge">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        {{ stagedExamples.length }} staged
      </span>
    </div>

    <!-- ── Top identity section ─────────────────────────────────────────────── -->
    <div class="panel identity-panel">
      <div class="identity-grid">
        <div class="field-group">
          <label class="field-label">Dataset Name</label>
          <input v-model="datasetName" class="input" type="text" placeholder="my-training-set-v1" />
        </div>
        <div class="field-group">
          <label class="field-label">Description</label>
          <input v-model="description" class="input" type="text" placeholder="Brief description of what this dataset contains" />
        </div>
        <div class="field-group field-group--narrow">
          <label class="field-label">Type</label>
          <select v-model="datasetType" class="input select-input">
            <option value="llm_sft">llm_sft</option>
            <option value="graph_embed">graph_embed</option>
            <option value="classification">classification</option>
          </select>
        </div>
      </div>
    </div>

    <!-- ── Tabs ─────────────────────────────────────────────────────────────── -->
    <div class="panel tab-panel">
      <div class="tab-bar">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <span v-html="tab.icon" class="tab-icon"></span>
          {{ tab.label }}
        </button>
      </div>

      <div class="tab-content">

        <!-- ── Tab 1: Generate from Graph ─────────────────────────────────── -->
        <div v-if="activeTab === 'graph'" class="tab-pane">
          <div class="tab-row">
            <div class="field-group">
              <label class="field-label">Source Dataset</label>
              <select v-model="graphSource" class="input select-input">
                <option value="default">Microservices (default)</option>
                <option value="k8s">Kubernetes</option>
                <option value="erp">ERP System</option>
                <option value="network-sec">Network Security</option>
                <option value="scaffold-ringlock">scaffold-ringlock</option>
                <option value="scaffold-cuplock">scaffold-cuplock</option>
                <option value="mfg-bicycle">mfg-bicycle</option>
                <option value="mfg-pump">mfg-pump</option>
                <option value="mfg-electronics">mfg-electronics</option>
                <option value="pipeline-water">pipeline-water</option>
                <option value="pipeline-process">pipeline-process</option>
              </select>
            </div>
            <div class="field-group field-group--narrow">
              <label class="field-label">Count</label>
              <input v-model.number="graphCount" class="input" type="number" min="1" max="100" />
            </div>
          </div>

          <div class="checkbox-row">
            <label class="checkbox-label">
              <input v-model="graphSaveAs" type="checkbox" class="checkbox" />
              <span>Save as dataset too</span>
            </label>
            <Transition name="expand-x">
              <input
                v-if="graphSaveAs"
                v-model="graphSaveName"
                class="input input--inline"
                type="text"
                placeholder="Dataset name to save as..."
              />
            </Transition>
          </div>

          <button class="btn btn-primary" :disabled="graphLoading" @click="generateFromGraph">
            <svg v-if="!graphLoading" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span v-if="graphLoading" class="spinner"></span>
            {{ graphLoading ? 'Generating…' : 'Generate' }}
          </button>

          <template v-if="graphPreviews.length > 0">
            <div class="preview-label-row">
              <span class="section-label">Preview — {{ graphPreviews.length }} examples</span>
              <button class="btn btn-ghost btn-sm" @click="addGraphToStaged">Add all to staged examples</button>
            </div>
            <div class="example-list">
              <div v-for="(ex, i) in graphPreviews" :key="i" class="example-row">
                <span class="ex-index">{{ i + 1 }}</span>
                <div class="ex-fields">
                  <div class="ex-field">
                    <span class="ex-label">IN</span>
                    <span class="ex-value">{{ truncate(ex.input, 100) }}</span>
                  </div>
                  <div class="ex-field">
                    <span class="ex-label ex-label--out">OUT</span>
                    <span class="ex-value">{{ truncate(ex.output, 100) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- ── Tab 2: Upload File ──────────────────────────────────────────── -->
        <div v-if="activeTab === 'upload'" class="tab-pane">
          <div
            class="dropzone"
            :class="{ 'dropzone--over': isDragging, 'dropzone--has-file': uploadFile !== null }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
            @click="fileInputRef?.click()"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept=".jsonl,.csv,.txt"
              class="hidden-input"
              @change="handleFileSelect"
            />
            <template v-if="!uploadFile">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span class="dropzone-text">Drag &amp; drop or click to browse</span>
              <span class="dropzone-hint">.jsonl &nbsp;·&nbsp; .csv &nbsp;·&nbsp; .txt</span>
            </template>
            <template v-else>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span class="dropzone-text" style="color:#3b82f6">{{ uploadFile.name }}</span>
              <span class="dropzone-hint">{{ formatBytes(uploadFile.size) }} — click to change</span>
            </template>
          </div>

          <template v-if="parsedExamples.length > 0">
            <div class="preview-label-row">
              <span class="section-label">Parse preview — {{ parsedExamples.length }} examples</span>
              <button class="btn btn-ghost btn-sm" @click="addParsedToStaged">Add parsed examples</button>
            </div>
            <div class="example-list">
              <div v-for="(ex, i) in parsedExamples.slice(0, 5)" :key="i" class="example-row">
                <span class="ex-index">{{ i + 1 }}</span>
                <div class="ex-fields">
                  <div class="ex-field">
                    <span class="ex-label">IN</span>
                    <span class="ex-value">{{ truncate(ex.input, 100) }}</span>
                  </div>
                  <div class="ex-field">
                    <span class="ex-label ex-label--out">OUT</span>
                    <span class="ex-value">{{ truncate(ex.output, 100) }}</span>
                  </div>
                </div>
              </div>
            </div>
            <p v-if="parsedExamples.length > 5" class="hint-text">…and {{ parsedExamples.length - 5 }} more</p>
          </template>
        </div>

        <!-- ── Tab 3: Manual Annotation ───────────────────────────────────── -->
        <div v-if="activeTab === 'manual'" class="tab-pane">
          <div class="annotation-table">
            <div class="annotation-header">
              <span>Input</span>
              <span>Output</span>
              <span></span>
            </div>
            <div v-for="(row, i) in annotationRows" :key="row.id" class="annotation-row">
              <textarea
                v-model="row.input"
                class="input textarea"
                rows="2"
                placeholder="User message / instruction…"
              ></textarea>
              <textarea
                v-model="row.output"
                class="input textarea"
                rows="2"
                placeholder="Assistant / target response…"
              ></textarea>
              <button class="icon-btn icon-btn--danger" @click="removeAnnotationRow(i)" title="Delete row">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="annotation-actions">
            <button class="btn btn-ghost btn-sm" @click="addAnnotationRow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Row
            </button>
            <button class="btn btn-primary btn-sm" @click="addAnnotationToStaged">Add all rows to staged</button>
          </div>
        </div>

        <!-- ── Tab 4: Synthetic via Ollama ────────────────────────────────── -->
        <div v-if="activeTab === 'synthetic'" class="tab-pane">
          <div class="tab-row tab-row--stack">
            <div class="field-group field-group--full">
              <label class="field-label">Seed Prompt</label>
              <textarea
                v-model="synthSeed"
                class="input textarea textarea--tall"
                rows="4"
                placeholder="Write a Q&A pair about Kubernetes pod scheduling..."
              ></textarea>
            </div>
          </div>
          <div class="tab-row">
            <div class="field-group">
              <label class="field-label">Model</label>
              <select v-model="synthModel" class="input select-input">
                <option value="llama3:latest">llama3:latest</option>
                <option value="mistral:latest">mistral:latest</option>
                <option value="llama2:latest">llama2:latest</option>
              </select>
            </div>
            <div class="field-group field-group--narrow">
              <label class="field-label">Generate N more</label>
              <input v-model.number="synthCount" class="input" type="number" min="1" max="50" />
            </div>
          </div>

          <button class="btn btn-primary" :disabled="synthLoading" @click="generateSynthetic">
            <svg v-if="!synthLoading" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
              <path d="M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
            <span v-if="synthLoading" class="spinner"></span>
            {{ synthLoading ? 'Generating…' : 'Generate' }}
          </button>

          <p v-if="synthError" class="error-text">{{ synthError }}</p>

          <template v-if="synthPreviews.length > 0">
            <div class="preview-label-row">
              <span class="section-label">Preview — {{ synthPreviews.length }} examples</span>
              <button class="btn btn-ghost btn-sm" @click="addSynthToStaged">Add to staged</button>
            </div>
            <div class="example-list">
              <div v-for="(ex, i) in synthPreviews" :key="i" class="example-row">
                <span class="ex-index">{{ i + 1 }}</span>
                <div class="ex-fields">
                  <div class="ex-field">
                    <span class="ex-label">IN</span>
                    <span class="ex-value">{{ truncate(ex.input, 100) }}</span>
                  </div>
                  <div class="ex-field">
                    <span class="ex-label ex-label--out">OUT</span>
                    <span class="ex-value">{{ truncate(ex.output, 100) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>

      </div>
    </div>

    <!-- ── Staged examples summary ───────────────────────────────────────────── -->
    <div class="panel staged-panel">
      <div class="staged-header">
        <span class="section-label">Staged Examples</span>
        <span class="example-badge">{{ stagedExamples.length }}</span>
        <button
          v-if="stagedExamples.length > 0"
          class="btn btn-ghost btn-sm"
          style="margin-left:auto"
          @click="stagedExamples = []"
        >Clear all</button>
      </div>

      <template v-if="stagedExamples.length === 0">
        <p class="hint-text" style="padding:12px 0">No examples staged yet. Use the tabs above to add examples.</p>
      </template>
      <template v-else>
        <div class="example-list example-list--staged">
          <div v-for="(ex, i) in stagedExamples.slice(0, 10)" :key="i" class="example-row">
            <span class="ex-index">{{ i + 1 }}</span>
            <div class="ex-fields">
              <div class="ex-field">
                <span class="ex-label">IN</span>
                <span class="ex-value">{{ truncate(ex.input, 80) }}</span>
              </div>
              <div class="ex-field">
                <span class="ex-label ex-label--out">OUT</span>
                <span class="ex-value">{{ truncate(ex.output, 80) }}</span>
              </div>
            </div>
            <button class="icon-btn" @click="stagedExamples.splice(i, 1)" title="Remove">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <p v-if="stagedExamples.length > 10" class="hint-text" style="padding:8px 0">
            …and {{ stagedExamples.length - 10 }} more
          </p>
        </div>
      </template>
    </div>

    <!-- ── Save bar ──────────────────────────────────────────────────────────── -->
    <div class="save-bar">
      <p v-if="saveError" class="error-text">{{ saveError }}</p>
      <div class="save-bar-inner">
        <span class="hint-text">{{ stagedExamples.length }} example{{ stagedExamples.length !== 1 ? 's' : '' }} will be saved</span>
        <button
          class="btn btn-primary btn-save"
          :disabled="saving || !datasetName.trim() || stagedExamples.length === 0"
          @click="saveDataset"
        >
          <span v-if="saving" class="spinner"></span>
          {{ saving ? 'Saving…' : 'Save Dataset' }}
        </button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { usePrismAPI } from '@/composables/usePrismAPI'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Example {
  input: string
  output: string
}

interface AnnotationRow {
  id: number
  input: string
  output: string
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const router = useRouter()
const api = usePrismAPI()

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'graph',     label: 'Generate from Graph', icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' },
  { id: 'upload',    label: 'Upload File',          icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' },
  { id: 'manual',    label: 'Manual Annotation',    icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' },
  { id: 'synthetic', label: 'Synthetic (Ollama)',   icon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>' },
]

const activeTab = ref<'graph' | 'upload' | 'manual' | 'synthetic'>('graph')

// ── Top-level form ─────────────────────────────────────────────────────────────

const datasetName  = ref('')
const description  = ref('')
const datasetType  = ref<'llm_sft' | 'graph_embed' | 'classification'>('llm_sft')
const stagedExamples = ref<Example[]>([])

// ── Tab 1: Graph generation ────────────────────────────────────────────────────

const graphSource   = ref('default')
const graphCount    = ref(24)
const graphSaveAs   = ref(false)
const graphSaveName = ref('')
const graphLoading  = ref(false)
const graphPreviews = ref<Example[]>([])

async function generateFromGraph() {
  graphLoading.value = true
  graphPreviews.value = []
  const body: Record<string, unknown> = {
    dataset: graphSource.value,
    count: graphCount.value,
  }
  if (graphSaveAs.value && graphSaveName.value.trim()) {
    body.save_as = graphSaveName.value.trim()
  }
  const res = await api.post<{ examples: Example[] }>('/train/generate', body)
  if (res?.examples) {
    graphPreviews.value = res.examples
  }
  graphLoading.value = false
}

function addGraphToStaged() {
  stagedExamples.value.push(...graphPreviews.value)
  graphPreviews.value = []
}

// ── Tab 2: File upload & parse ─────────────────────────────────────────────────

const fileInputRef   = ref<HTMLInputElement | null>(null)
const isDragging     = ref(false)
const uploadFile     = ref<File | null>(null)
const parsedExamples = ref<Example[]>([])

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) processFile(file)
}

function handleFileSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) processFile(file)
}

function processFile(file: File) {
  uploadFile.value = file
  parsedExamples.value = []
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = (e.target?.result as string) ?? ''
    const ext  = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'jsonl')      parsedExamples.value = parseJSONL(text)
    else if (ext === 'csv')   parsedExamples.value = parseCSV(text)
    else                      parsedExamples.value = parseTXT(text)
  }
  reader.readAsText(file)
}

function parseJSONL(text: string): Example[] {
  const results: Example[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const obj = JSON.parse(trimmed)
      // Support {"messages": [...]} format
      if (Array.isArray(obj.messages)) {
        const userMsg  = obj.messages.find((m: any) => m.role === 'user')
        const assistMsg = obj.messages.find((m: any) => m.role === 'assistant')
        if (userMsg || assistMsg) {
          results.push({ input: userMsg?.content ?? '', output: assistMsg?.content ?? '' })
          continue
        }
      }
      // Fallback: input/output keys
      results.push({ input: obj.input ?? obj.prompt ?? '', output: obj.output ?? obj.response ?? '' })
    } catch {
      // skip malformed lines
    }
  }
  return results
}

function parseCSV(text: string): Example[] {
  const results: Example[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    // simple split — handles quoted values naively
    const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim())
    if (cols.length >= 2) results.push({ input: cols[0], output: cols[1] })
  }
  return results
}

function parseTXT(text: string): Example[] {
  const results: Example[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  for (let i = 0; i + 1 < lines.length; i += 2) {
    results.push({ input: lines[i], output: lines[i + 1] })
  }
  return results
}

function addParsedToStaged() {
  stagedExamples.value.push(...parsedExamples.value)
  parsedExamples.value = []
  uploadFile.value = null
}

// ── Tab 3: Manual annotation ───────────────────────────────────────────────────

let rowIdCounter = 3
const annotationRows = ref<AnnotationRow[]>([
  { id: 0, input: '', output: '' },
  { id: 1, input: '', output: '' },
  { id: 2, input: '', output: '' },
])

function addAnnotationRow() {
  annotationRows.value.push({ id: rowIdCounter++, input: '', output: '' })
}

function removeAnnotationRow(i: number) {
  annotationRows.value.splice(i, 1)
}

function addAnnotationToStaged() {
  const filled = annotationRows.value.filter(r => r.input.trim() || r.output.trim())
  stagedExamples.value.push(...filled.map(r => ({ input: r.input, output: r.output })))
  // reset rows
  annotationRows.value = [
    { id: rowIdCounter++, input: '', output: '' },
    { id: rowIdCounter++, input: '', output: '' },
    { id: rowIdCounter++, input: '', output: '' },
  ]
}

// ── Tab 4: Synthetic ───────────────────────────────────────────────────────────

const synthSeed     = ref('')
const synthModel    = ref('llama3:latest')
const synthCount    = ref(8)
const synthLoading  = ref(false)
const synthError    = ref('')
const synthPreviews = ref<Example[]>([])

async function generateSynthetic() {
  synthLoading.value = true
  synthError.value   = ''
  synthPreviews.value = []
  const prompt = `Generate ${synthCount.value} diverse Q&A pairs in JSON format [{input, output}, ...] about this topic: ${synthSeed.value}`
  const res = await api.post<{ response?: string; text?: string }>('/ai/synthesize', { prompt })
  const raw = res?.response ?? res?.text ?? ''
  try {
    // extract JSON array from the response (may be wrapped in prose)
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array found in response')
    const parsed: any[] = JSON.parse(match[0])
    synthPreviews.value = parsed.map((p: any) => ({
      input:  p.input  ?? p.question ?? p.prompt ?? '',
      output: p.output ?? p.answer   ?? p.response ?? '',
    }))
  } catch (err: any) {
    synthError.value = `Could not parse model response as JSON array. ${err.message}`
  }
  synthLoading.value = false
}

function addSynthToStaged() {
  stagedExamples.value.push(...synthPreviews.value)
  synthPreviews.value = []
}

// ── Save dataset ───────────────────────────────────────────────────────────────

const saving    = ref(false)
const saveError = ref('')

async function saveDataset() {
  saveError.value = ''
  saving.value    = true
  const res = await api.post<{ id?: string; ok?: boolean }>('/train/datasets', {
    name:         datasetName.value.trim(),
    description:  description.value.trim(),
    dataset_type: datasetType.value,
    examples:     stagedExamples.value,
  })
  saving.value = false
  if (res) {
    router.push('/ai-training/datasets')
  } else {
    saveError.value = 'Failed to save dataset. Check the API and try again.'
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function truncate(str: string, max: number): string {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped>
/* ── Page shell ──────────────────────────────────────────────────────────── */
.db-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 24px 32px;
  height: 100%;
  overflow-y: auto;
  background: #0d1117;
  color: #e6edf3;
  font-size: 13px;
}

/* ── Page header ─────────────────────────────────────────────────────────── */
.db-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.db-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #e6edf3;
}

.db-subtitle {
  font-size: 12px;
  color: #8b949e;
  margin-top: 3px;
}

/* ── Shared panel ────────────────────────────────────────────────────────── */
.panel {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
}

/* ── Identity panel ──────────────────────────────────────────────────────── */
.identity-panel {
  padding: 16px;
}

.identity-grid {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 12px;
  align-items: end;
}

/* ── Form primitives ─────────────────────────────────────────────────────── */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-group--narrow {
  min-width: 120px;
  max-width: 160px;
}

.field-group--full {
  width: 100%;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #8b949e;
  text-transform: uppercase;
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

.select-input {
  cursor: pointer;
}

.textarea {
  resize: vertical;
  font-family: inherit;
  line-height: 1.5;
}

.textarea--tall {
  min-height: 90px;
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
.tab-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-bar {
  display: flex;
  border-bottom: 1px solid #30363d;
  overflow-x: auto;
  scrollbar-width: none;
}

.tab-bar::-webkit-scrollbar { display: none; }

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 500;
  color: #8b949e;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
}

.tab-btn:hover {
  color: #e6edf3;
}

.tab-btn--active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.tab-icon {
  display: flex;
  align-items: center;
  opacity: 0.75;
}

.tab-content {
  padding: 16px;
}

.tab-pane {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tab-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.tab-row--stack {
  flex-direction: column;
}

/* ── Checkbox row ────────────────────────────────────────────────────────── */
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  font-size: 12px;
  color: #8b949e;
  user-select: none;
}

.checkbox {
  width: 14px;
  height: 14px;
  accent-color: #3b82f6;
  cursor: pointer;
}

.input--inline {
  width: 220px;
  padding: 6px 10px;
  font-size: 12px;
}

/* expand transition */
.expand-x-enter-active, .expand-x-leave-active {
  transition: opacity 0.18s ease, max-width 0.2s ease;
  overflow: hidden;
  max-width: 260px;
}
.expand-x-enter-from, .expand-x-leave-to {
  opacity: 0;
  max-width: 0;
}

/* ── Dropzone ────────────────────────────────────────────────────────────── */
.dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 20px;
  border: 2px dashed #30363d;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  color: #8b949e;
  text-align: center;
}

.dropzone:hover, .dropzone--over {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.04);
}

.dropzone--has-file {
  border-style: solid;
  border-color: rgba(59, 130, 246, 0.4);
  background: rgba(59, 130, 246, 0.04);
}

.dropzone-text {
  font-size: 13px;
  font-weight: 500;
  color: #e6edf3;
}

.dropzone-hint {
  font-size: 11px;
  color: #484f58;
}

.hidden-input {
  display: none;
}

/* ── Example list ────────────────────────────────────────────────────────── */
.example-list {
  display: flex;
  flex-direction: column;
  border: 1px solid #30363d;
  border-radius: 6px;
  overflow: hidden;
}

.example-list--staged {
  max-height: 280px;
  overflow-y: auto;
}

.example-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 9px 12px;
  border-bottom: 1px solid rgba(48, 54, 61, 0.5);
}

.example-row:last-child {
  border-bottom: none;
}

.ex-index {
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: #484f58;
  min-width: 18px;
  padding-top: 2px;
  flex-shrink: 0;
}

.ex-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.ex-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ex-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #484f58;
}

.ex-label--out {
  color: rgba(59, 130, 246, 0.6);
}

.ex-value {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  color: #8b949e;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Annotation table ────────────────────────────────────────────────────── */
.annotation-table {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid #30363d;
  border-radius: 6px;
  overflow: hidden;
}

.annotation-header {
  display: grid;
  grid-template-columns: 1fr 1fr 36px;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid #30363d;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #484f58;
}

.annotation-row {
  display: grid;
  grid-template-columns: 1fr 1fr 36px;
  gap: 8px;
  align-items: start;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(48, 54, 61, 0.4);
}

.annotation-row:last-child {
  border-bottom: none;
}

.annotation-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Buttons ──────────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #30363d;
  background: transparent;
  color: #8b949e;
  transition: all 0.15s;
}

.btn:hover:not(:disabled) {
  border-color: #484f58;
  color: #e6edf3;
  background: rgba(255, 255, 255, 0.04);
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}

.btn-ghost {
  border-color: transparent;
  background: transparent;
  color: #8b949e;
}

.btn-ghost:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  color: #e6edf3;
  border-color: transparent;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 11px;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 5px;
  border: 1px solid transparent;
  background: transparent;
  color: #484f58;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.icon-btn:hover {
  color: #8b949e;
  background: rgba(255, 255, 255, 0.05);
}

.icon-btn--danger:hover {
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.08);
}

/* ── Section labels / badges ─────────────────────────────────────────────── */
.preview-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: #484f58;
}

.example-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 10px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.hint-text {
  font-size: 11px;
  color: #484f58;
}

.error-text {
  font-size: 12px;
  color: #ef4444;
}

/* ── Staged panel ────────────────────────────────────────────────────────── */
.staged-panel {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.staged-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Save bar ─────────────────────────────────────────────────────────────── */
.save-bar {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.save-bar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
}

.btn-save {
  padding: 8px 20px;
  font-size: 13px;
}

/* ── Spinner ──────────────────────────────────────────────────────────────── */
.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  flex-shrink: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

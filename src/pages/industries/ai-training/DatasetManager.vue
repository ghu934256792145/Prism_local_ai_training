<template>
  <div class="dm-page">

    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <div class="dm-header">
      <div>
        <h1 class="dm-title">Datasets</h1>
        <p class="dm-subtitle">Training datasets for fine-tuning and embedding tasks</p>
      </div>
      <button class="btn btn-primary" @click="router.push('/ai-training/datasets/new')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        New Dataset
      </button>
    </div>

    <!-- ── Loading skeleton ────────────────────────────────────────────────── -->
    <template v-if="loading">
      <div v-for="i in 3" :key="i" class="dataset-card panel skeleton-card">
        <div class="sk-line sk-title"></div>
        <div class="sk-line sk-meta" style="width:55%"></div>
        <div class="sk-line sk-meta" style="width:35%;margin-top:4px"></div>
      </div>
    </template>

    <!-- ── Empty state ─────────────────────────────────────────────────────── -->
    <div v-else-if="datasets.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
          <path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9"/>
          <path d="M3 13v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4"/>
        </svg>
      </div>
      <p class="empty-title">No datasets yet</p>
      <p class="empty-desc">Create a dataset from graph data, upload a file, or annotate samples manually.</p>
      <button class="btn btn-primary" @click="router.push('/ai-training/datasets/new')">
        Create your first dataset
      </button>
    </div>

    <!-- ── Dataset cards ───────────────────────────────────────────────────── -->
    <template v-else>
      <div v-for="ds in datasets" :key="ds.id" class="dataset-card panel">

        <!-- Card header -->
        <div class="ds-card-header">
          <div class="ds-card-header-left">
            <span class="ds-name">{{ ds.name }}</span>
            <span class="type-badge" :class="typeBadgeClass(ds.type)">{{ ds.type ?? 'unknown' }}</span>
          </div>
          <div class="ds-actions">
            <button
              class="ds-btn"
              :class="{ 'ds-btn--active': expandedPreviews.has(ds.id) }"
              @click="togglePreview(ds.id)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Preview
            </button>
            <button class="ds-btn" @click="exportDataset(ds.id)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export JSONL
            </button>
            <button
              class="ds-btn ds-btn--danger"
              :disabled="deletingIds.has(ds.id)"
              @click="confirmDelete(ds)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
              {{ deletingIds.has(ds.id) ? 'Deleting…' : 'Delete' }}
            </button>
          </div>
        </div>

        <!-- Card meta row -->
        <div class="ds-meta-row">
          <span class="ds-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            {{ (ds.examples?.length ?? 0).toLocaleString() }} examples
          </span>
          <span v-if="ds.source_dataset" class="ds-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Source: {{ ds.source_dataset }}
          </span>
          <span v-if="ds.created_at" class="ds-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {{ formatDate(ds.created_at) }}
          </span>
        </div>

        <!-- Preview panel (collapsible) -->
        <Transition name="preview-slide">
          <div v-if="expandedPreviews.has(ds.id)" class="preview-panel">
            <div class="preview-header">
              <span class="preview-label">Sample preview</span>
              <span class="text-muted" style="font-size:11px">
                showing {{ Math.min(5, ds.examples?.length ?? 0) }} of {{ ds.examples?.length ?? 0 }}
              </span>
            </div>
            <div
              v-if="!ds.examples || ds.examples.length === 0"
              class="preview-empty text-secondary"
            >
              No examples in this dataset.
            </div>
            <div v-else class="preview-examples">
              <div
                v-for="(ex, idx) in ds.examples.slice(0, 5)"
                :key="idx"
                class="preview-row"
              >
                <div class="preview-index text-muted">{{ idx + 1 }}</div>
                <div class="preview-fields">
                  <div class="preview-field">
                    <span class="preview-field-label">Input</span>
                    <span class="preview-field-value">{{ truncate(ex.input ?? ex.prompt ?? ex.instruction ?? JSON.stringify(ex), 120) }}</span>
                  </div>
                  <div class="preview-field">
                    <span class="preview-field-label preview-field-label--output">Output</span>
                    <span class="preview-field-value">{{ truncate(ex.output ?? ex.response ?? ex.completion ?? '—', 120) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>

      </div>
    </template>

    <!-- ── Delete confirm dialog ───────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="deleteTarget" class="modal-backdrop" @click.self="deleteTarget = null">
          <div class="modal-box">
            <div class="modal-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 class="modal-title">Delete dataset?</h3>
            <p class="modal-desc">
              "<strong>{{ deleteTarget.name }}</strong>" and all {{ (deleteTarget.examples?.length ?? 0).toLocaleString() }} examples will be permanently removed.
              This cannot be undone.
            </p>
            <div class="modal-actions">
              <button class="btn" @click="deleteTarget = null">Cancel</button>
              <button class="btn btn-danger" @click="deleteDataset(deleteTarget)">Delete</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePrismAPI } from '@/composables/usePrismAPI'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Dataset {
  id: string
  name: string
  type?: string
  examples: any[]
  source_dataset?: string
  created_at?: number  // unix timestamp
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const router = useRouter()
const api = usePrismAPI()

// ── State ─────────────────────────────────────────────────────────────────────

const datasets = ref<Dataset[]>([])
const loading = ref(true)

const expandedPreviews = ref<Set<string>>(new Set())
const deletingIds = ref<Set<string>>(new Set())
const deleteTarget = ref<Dataset | null>(null)

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchDatasets() {
  const res = await api.get<{ datasets: Dataset[] }>('/train/datasets')
  if (res) {
    datasets.value = res.datasets
  }
  loading.value = false
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function typeBadgeClass(type?: string): string {
  switch (type) {
    case 'llm_sft':       return 'type-blue'
    case 'graph_embed':   return 'type-purple'
    case 'classification': return 'type-orange'
    default:              return 'type-default'
  }
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function truncate(str: string, max: number): string {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}

// ── Actions ───────────────────────────────────────────────────────────────────

function togglePreview(id: string) {
  if (expandedPreviews.value.has(id)) {
    expandedPreviews.value.delete(id)
  } else {
    expandedPreviews.value.add(id)
  }
  // trigger reactivity for Sets
  expandedPreviews.value = new Set(expandedPreviews.value)
}

function exportDataset(id: string) {
  window.open(`/api/train/datasets/${id}/export`)
}

function confirmDelete(ds: Dataset) {
  deleteTarget.value = ds
}

async function deleteDataset(ds: Dataset) {
  deleteTarget.value = null
  deletingIds.value.add(ds.id)
  deletingIds.value = new Set(deletingIds.value)

  const res = await api.get<{ ok: boolean }>(`/train/datasets/${ds.id}/delete`)
  // Note: uses the del method exposed through the generic get wrapper;
  // the composable does not expose del() directly, so we call it via post or
  // fall back to a direct fetch for DELETE semantics.
  await deleteViaFetch(ds.id)

  deletingIds.value.delete(ds.id)
  deletingIds.value = new Set(deletingIds.value)
}

async function deleteViaFetch(id: string) {
  try {
    const res = await fetch(`/api/train/datasets/${id}`, { method: 'DELETE' })
    if (res.ok) {
      datasets.value = datasets.value.filter(d => d.id !== id)
    }
  } catch {
    // silent — dataset stays in list if delete fails
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(fetchDatasets)
</script>

<style scoped>
.dm-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px 24px;
  height: 100%;
  overflow-y: auto;
  background: #0d1117;
  color: var(--text-primary);
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.dm-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.dm-title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.dm-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 3px;
}

/* ── Dataset card ────────────────────────────────────────────────────────── */
.dataset-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  overflow: visible;
  display: flex;
  flex-direction: column;
  gap: 0;
  flex-shrink: 0;
}

.ds-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(48, 54, 61, 0.6);
}

.ds-card-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.ds-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Type badges */
.type-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
  flex-shrink: 0;
}

.type-blue    { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.type-purple  { background: rgba(184, 119, 217, 0.15); color: var(--accent-purple); }
.type-orange  { background: rgba(255, 152, 48, 0.15);  color: var(--accent-orange); }
.type-default { background: rgba(107, 114, 128, 0.15); color: #9ca3af; }

/* Action buttons */
.ds-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.ds-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #30363d;
  background: transparent;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.ds-btn:hover:not(:disabled) {
  border-color: var(--border-hover);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
}

.ds-btn--active {
  border-color: rgba(59, 130, 246, 0.5);
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.ds-btn--danger:hover:not(:disabled) {
  border-color: rgba(239, 68, 68, 0.5);
  background: rgba(239, 68, 68, 0.08);
  color: #ef4444;
}

.ds-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Meta row */
.ds-meta-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  flex-wrap: wrap;
}

.ds-meta-item {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-secondary);
}

/* ── Preview panel ───────────────────────────────────────────────────────── */
.preview-panel {
  border-top: 1px solid rgba(48, 54, 61, 0.6);
  background: rgba(0, 0, 0, 0.2);
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid rgba(48, 54, 61, 0.4);
}

.preview-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
}

.preview-empty {
  padding: 14px 16px;
  font-size: 12px;
}

.preview-examples {
  display: flex;
  flex-direction: column;
}

.preview-row {
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(48, 54, 61, 0.3);
}

.preview-row:last-child {
  border-bottom: none;
}

.preview-index {
  font-size: 10px;
  font-family: var(--font-mono);
  width: 18px;
  flex-shrink: 0;
  padding-top: 2px;
}

.preview-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.preview-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.preview-field-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.preview-field-label--output {
  color: rgba(87, 148, 242, 0.7);
}

.preview-field-value {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Preview transition */
.preview-slide-enter-active,
.preview-slide-leave-active {
  transition: max-height 0.25s ease, opacity 0.2s ease;
  overflow: hidden;
  max-height: 400px;
}

.preview-slide-enter-from,
.preview-slide-leave-to {
  max-height: 0;
  opacity: 0;
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */
.skeleton-card {
  padding: 16px;
  gap: 10px;
  display: flex;
  flex-direction: column;
}

.sk-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg, #161b22 25%, #1f2937 50%, #161b22 75%);
  background-size: 200% 100%;
  animation: skeleton-sweep 1.4s ease-in-out infinite;
}

.sk-title { width: 40%; height: 16px; }
.sk-meta  { width: 60%; }

@keyframes skeleton-sweep {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 24px;
  text-align: center;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 16px;
  background: rgba(48, 54, 61, 0.4);
  color: var(--text-muted);
  margin-bottom: 4px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-desc {
  font-size: 13px;
  color: var(--text-secondary);
  max-width: 360px;
  line-height: 1.5;
}

/* ── Delete modal ────────────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-box {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 10px;
  padding: 28px 28px 24px;
  max-width: 400px;
  width: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.modal-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.modal-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.modal-desc strong {
  color: var(--text-primary);
}

.modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
  width: 100%;
  justify-content: center;
}

.btn-danger {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.18);
  border-color: #ef4444;
}

/* Fade transition for modal */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from,  .fade-leave-to      { opacity: 0; }
</style>

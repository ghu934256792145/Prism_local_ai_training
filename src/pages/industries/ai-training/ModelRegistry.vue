<template>
  <div class="mr-page">

    <!-- ── Header ────────────────────────────────────────────────────────────── -->
    <div class="mr-header">
      <div class="mr-header-left">
        <h1 class="mr-title">Model Registry</h1>
        <span class="mr-count" v-if="!loading">{{ models.length }} model{{ models.length !== 1 ? 's' : '' }}</span>
      </div>
      <button
        class="btn btn-secondary"
        :class="{ 'btn-secondary--active': compareMode }"
        @click="toggleCompareMode"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="18" rx="1"/>
          <rect x="14" y="3" width="7" height="18" rx="1"/>
        </svg>
        {{ compareMode ? 'Exit Compare' : 'Compare Mode' }}
      </button>
    </div>

    <!-- ── Loading skeleton ───────────────────────────────────────────────────── -->
    <div v-if="loading" class="skeleton-list">
      <div v-for="i in 4" :key="i" class="skeleton-row">
        <div class="skel skel--name"></div>
        <div class="skel skel--chip"></div>
        <div class="skel skel--chip"></div>
        <div class="skel skel--num"></div>
        <div class="skel skel--num"></div>
        <div class="skel skel--num"></div>
        <div class="skel skel--date"></div>
        <div class="skel skel--wide"></div>
        <div class="skel skel--actions"></div>
      </div>
    </div>

    <!-- ── Compare mode ───────────────────────────────────────────────────────── -->
    <template v-else-if="compareMode">
      <div class="compare-selectors">
        <div class="compare-selector-group">
          <label class="field-label">Model A</label>
          <select v-model="compareIdA" class="input select-input">
            <option value="">Select model A…</option>
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
        <div class="compare-vs">VS</div>
        <div class="compare-selector-group">
          <label class="field-label">Model B</label>
          <select v-model="compareIdB" class="input select-input">
            <option value="">Select model B…</option>
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
      </div>

      <div class="compare-cards">
        <!-- Model A card -->
        <div class="compare-card panel" :class="{ 'compare-card--dim': !compareModelA }">
          <div class="compare-card-header">
            <span class="compare-card-label">Model A</span>
            <span v-if="compareModelA" class="model-name-badge">{{ compareModelA.name }}</span>
          </div>
          <template v-if="compareModelA">
            <div class="compare-field">
              <span class="compare-field-label">Base Model</span>
              <span class="compare-field-val">{{ compareModelA.base_model }}</span>
            </div>
            <div class="compare-field">
              <span class="compare-field-label">Approach</span>
              <span class="compare-field-val">{{ compareModelA.approach }}</span>
            </div>
            <div class="compare-field">
              <span class="compare-field-label">Final Loss</span>
              <span
                class="compare-field-val compare-field-val--mono"
                :class="lossWinner === 'A' ? 'compare-winner' : lossWinner === 'B' ? 'compare-loser' : ''"
              >{{ compareModelA.final_loss.toFixed(4) }}</span>
            </div>
            <div class="compare-field">
              <span class="compare-field-label">Epochs</span>
              <span class="compare-field-val compare-field-val--mono">{{ compareModelA.epochs }}</span>
            </div>
            <div class="compare-field">
              <span class="compare-field-label">Dataset Size</span>
              <span class="compare-field-val compare-field-val--mono">{{ compareModelA.dataset_size.toLocaleString() }}</span>
            </div>
            <div class="compare-field">
              <span class="compare-field-label">Created</span>
              <span class="compare-field-val">{{ formatDate(compareModelA.created_at) }}</span>
            </div>
            <div class="compare-field compare-field--tags">
              <span class="compare-field-label">Tags</span>
              <div class="tag-list">
                <span v-if="compareModelA.tags.length === 0" class="tag-empty">—</span>
                <span v-for="t in compareModelA.tags" :key="t" class="tag-chip">{{ t }}</span>
              </div>
            </div>
          </template>
          <div v-else class="compare-placeholder">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#484f58" stroke-width="1.5">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <span>Select a model</span>
          </div>
        </div>

        <!-- Model B card -->
        <div class="compare-card panel" :class="{ 'compare-card--dim': !compareModelB }">
          <div class="compare-card-header">
            <span class="compare-card-label">Model B</span>
            <span v-if="compareModelB" class="model-name-badge">{{ compareModelB.name }}</span>
          </div>
          <template v-if="compareModelB">
            <div class="compare-field">
              <span class="compare-field-label">Base Model</span>
              <span class="compare-field-val">{{ compareModelB.base_model }}</span>
            </div>
            <div class="compare-field">
              <span class="compare-field-label">Approach</span>
              <span class="compare-field-val">{{ compareModelB.approach }}</span>
            </div>
            <div class="compare-field">
              <span class="compare-field-label">Final Loss</span>
              <span
                class="compare-field-val compare-field-val--mono"
                :class="lossWinner === 'B' ? 'compare-winner' : lossWinner === 'A' ? 'compare-loser' : ''"
              >{{ compareModelB.final_loss.toFixed(4) }}</span>
            </div>
            <div class="compare-field">
              <span class="compare-field-label">Epochs</span>
              <span class="compare-field-val compare-field-val--mono">{{ compareModelB.epochs }}</span>
            </div>
            <div class="compare-field">
              <span class="compare-field-label">Dataset Size</span>
              <span class="compare-field-val compare-field-val--mono">{{ compareModelB.dataset_size.toLocaleString() }}</span>
            </div>
            <div class="compare-field">
              <span class="compare-field-label">Created</span>
              <span class="compare-field-val">{{ formatDate(compareModelB.created_at) }}</span>
            </div>
            <div class="compare-field compare-field--tags">
              <span class="compare-field-label">Tags</span>
              <div class="tag-list">
                <span v-if="compareModelB.tags.length === 0" class="tag-empty">—</span>
                <span v-for="t in compareModelB.tags" :key="t" class="tag-chip">{{ t }}</span>
              </div>
            </div>
          </template>
          <div v-else class="compare-placeholder">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#484f58" stroke-width="1.5">
              <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <span>Select a model</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ── List view ──────────────────────────────────────────────────────────── -->
    <template v-else-if="models.length === 0">
      <div class="empty-state">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#484f58" stroke-width="1.3">
          <rect x="2" y="7" width="20" height="14" rx="2"/>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
        <p class="empty-state-title">No trained models yet.</p>
        <p class="empty-state-sub">Launch a training run to get started.</p>
        <router-link to="/ai-training/config" class="btn btn-primary">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Start Training
        </router-link>
      </div>
    </template>

    <template v-else>
      <!-- Error banner -->
      <div v-if="deleteError" class="error-banner">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {{ deleteError }}
      </div>

      <!-- Table wrapper -->
      <div class="table-wrapper">
        <table class="mr-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Base Model</th>
              <th>Approach</th>
              <th>Final Loss</th>
              <th>Epochs</th>
              <th>Dataset Size</th>
              <th>Created</th>
              <th>Tags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="model in models" :key="model.id" class="model-row">
              <td class="td-name">
                <span class="model-name">{{ model.name }}</span>
                <span class="model-id">{{ model.id.slice(0, 8) }}</span>
              </td>
              <td class="td-mono">{{ model.base_model }}</td>
              <td>
                <span class="approach-chip">{{ model.approach }}</span>
              </td>
              <td class="td-mono td-loss">{{ model.final_loss.toFixed(4) }}</td>
              <td class="td-mono td-center">{{ model.epochs }}</td>
              <td class="td-mono td-center">{{ model.dataset_size.toLocaleString() }}</td>
              <td class="td-date">{{ formatDate(model.created_at) }}</td>
              <td>
                <div class="tag-list">
                  <span v-if="model.tags.length === 0" style="color:#484f58">—</span>
                  <span v-for="t in model.tags" :key="t" class="tag-chip">{{ t }}</span>
                </div>
              </td>
              <td>
                <div class="action-btns">
                  <router-link
                    :to="`/ai-training/playground?model_id=${model.id}`"
                    class="btn btn-sm btn-test"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    Test
                  </router-link>
                  <button
                    class="btn btn-sm btn-delete"
                    :disabled="deletingId === model.id"
                    @click="confirmDelete(model)"
                  >
                    <span v-if="deletingId === model.id" class="spinner"></span>
                    <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                    </svg>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ── Confirm dialog ─────────────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="confirmModel" class="modal-overlay" @click.self="confirmModel = null">
          <div class="modal-box">
            <div class="modal-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3 class="modal-title">Delete Model</h3>
            <p class="modal-body">
              Are you sure you want to delete <strong>{{ confirmModel.name }}</strong>?
              This action cannot be undone.
            </p>
            <div class="modal-actions">
              <button class="btn btn-secondary" @click="confirmModel = null">Cancel</button>
              <button class="btn btn-danger" @click="deleteModel">Delete</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePrismAPI } from '@/composables/usePrismAPI'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrainedModel {
  id: string
  name: string
  base_model: string
  run_id: string
  final_loss: number
  epochs: number
  dataset_size: number
  approach: string
  created_at: string
  tags: string[]
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const api = usePrismAPI()

// ── State ─────────────────────────────────────────────────────────────────────

const models      = ref<TrainedModel[]>([])
const loading     = ref(true)
const deleteError = ref('')
const deletingId  = ref<string | null>(null)
const confirmModel = ref<TrainedModel | null>(null)

// compare
const compareMode = ref(false)
const compareIdA  = ref('')
const compareIdB  = ref('')

// ── Computed ──────────────────────────────────────────────────────────────────

const compareModelA = computed(() =>
  models.value.find(m => m.id === compareIdA.value) ?? null
)

const compareModelB = computed(() =>
  models.value.find(m => m.id === compareIdB.value) ?? null
)

/** Returns 'A' if A has lower loss (better), 'B' if B does, null if no difference or missing */
const lossWinner = computed<'A' | 'B' | null>(() => {
  const a = compareModelA.value
  const b = compareModelB.value
  if (!a || !b) return null
  const diff = Math.abs(a.final_loss - b.final_loss)
  const avg  = (a.final_loss + b.final_loss) / 2
  if (diff / avg < 0.05) return null          // < 5% difference — no highlight
  return a.final_loss < b.final_loss ? 'A' : 'B'
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function fetchModels() {
  loading.value = true
  const res = await api.get<{ models: TrainedModel[] }>('/train/models')
  if (res?.models) models.value = res.models
  loading.value = false
}

function toggleCompareMode() {
  compareMode.value = !compareMode.value
  if (!compareMode.value) {
    compareIdA.value = ''
    compareIdB.value = ''
  }
}

function confirmDelete(model: TrainedModel) {
  confirmModel.value = model
}

async function deleteModel() {
  const model = confirmModel.value
  if (!model) return
  confirmModel.value = null
  deletingId.value   = model.id
  deleteError.value  = ''

  const res = await api.post(`/train/models/${model.id}/delete`, {})
  deletingId.value = null

  if (res !== null) {
    models.value = models.value.filter(m => m.id !== model.id)
    if (compareIdA.value === model.id) compareIdA.value = ''
    if (compareIdB.value === model.id) compareIdB.value = ''
  } else {
    deleteError.value = `Failed to delete model "${model.name}". Try again.`
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(fetchModels)
</script>

<style scoped>
/* ── Page shell ──────────────────────────────────────────────────────────── */
.mr-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: #0d1117;
  color: #e6edf3;
  font-size: 13px;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.mr-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px 14px;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;
}

.mr-header-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.mr-title {
  font-size: 18px;
  font-weight: 700;
  color: #e6edf3;
  margin: 0;
  letter-spacing: -0.01em;
}

.mr-count {
  font-size: 12px;
  color: #484f58;
}

/* ── Table wrapper ───────────────────────────────────────────────────────── */
.table-wrapper {
  flex: 1;
  overflow: auto;
}

.mr-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}

.mr-table thead tr {
  border-bottom: 1px solid #30363d;
}

.mr-table th {
  padding: 10px 14px;
  text-align: left;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #484f58;
  white-space: nowrap;
  position: sticky;
  top: 0;
  background: #0d1117;
  z-index: 1;
}

.mr-table tbody tr {
  border-bottom: 1px solid rgba(48, 54, 61, 0.5);
  transition: background 0.1s;
}

.mr-table tbody tr:hover {
  background: rgba(255,255,255,0.02);
}

.mr-table td {
  padding: 11px 14px;
  vertical-align: middle;
}

.td-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.model-name {
  font-weight: 600;
  color: #c9d1d9;
}

.model-id {
  font-size: 10px;
  color: #484f58;
  font-family: 'Consolas', monospace;
}

.td-mono {
  font-family: 'Consolas', 'Fira Mono', monospace;
  font-variant-numeric: tabular-nums;
  color: #8b949e;
}

.td-loss {
  color: #e6edf3;
  font-weight: 600;
}

.td-center {
  text-align: center;
}

.td-date {
  color: #8b949e;
  white-space: nowrap;
}

/* ── Approach chip ───────────────────────────────────────────────────────── */
.approach-chip {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.03em;
  background: rgba(59,130,246,0.1);
  border: 1px solid rgba(59,130,246,0.25);
  color: #3b82f6;
}

/* ── Tag chip ────────────────────────────────────────────────────────────── */
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-chip {
  display: inline-flex;
  padding: 2px 7px;
  border-radius: 8px;
  font-size: 10.5px;
  background: rgba(48,54,61,0.7);
  border: 1px solid #30363d;
  color: #8b949e;
}

.tag-empty {
  color: #484f58;
}

/* ── Action buttons ──────────────────────────────────────────────────────── */
.action-btns {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #30363d;
  background: transparent;
  color: #8b949e;
  text-decoration: none;
  transition: all 0.15s;
  flex-shrink: 0;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-sm {
  padding: 5px 10px;
  font-size: 11px;
}

.btn-test {
  border-color: rgba(59,130,246,0.35);
  color: #3b82f6;
}

.btn-test:hover {
  background: rgba(59,130,246,0.1);
  border-color: #3b82f6;
}

.btn-delete {
  border-color: rgba(239,68,68,0.3);
  color: #ef4444;
}

.btn-delete:hover:not(:disabled) {
  background: rgba(239,68,68,0.08);
  border-color: #ef4444;
}

.btn-danger {
  background: rgba(239,68,68,0.1);
  border-color: rgba(239,68,68,0.4);
  color: #ef4444;
}

.btn-danger:hover {
  background: rgba(239,68,68,0.2);
}

.btn-secondary {
  border-color: #30363d;
  color: #8b949e;
}

.btn-secondary:hover {
  background: rgba(255,255,255,0.04);
  color: #c9d1d9;
}

.btn-secondary--active {
  border-color: rgba(59,130,246,0.4);
  color: #3b82f6;
  background: rgba(59,130,246,0.08);
}

.btn-primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
  font-weight: 600;
  padding: 9px 20px;
}

.btn-primary:hover {
  background: #2563eb;
}

/* ── Empty state ─────────────────────────────────────────────────────────── */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 24px;
  color: #484f58;
}

.empty-state-title {
  font-size: 15px;
  font-weight: 600;
  color: #8b949e;
  margin: 0;
}

.empty-state-sub {
  font-size: 12px;
  color: #484f58;
  margin: 0 0 10px;
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */
.skeleton-list {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 4px;
  border-bottom: 1px solid rgba(48,54,61,0.5);
}

.skel {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg, #161b22 25%, #21262d 50%, #161b22 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
  flex-shrink: 0;
}

.skel--name   { width: 130px; }
.skel--chip   { width: 70px; }
.skel--num    { width: 50px; }
.skel--date   { width: 90px; }
.skel--wide   { width: 100px; }
.skel--actions { width: 120px; }

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Error banner ────────────────────────────────────────────────────────── */
.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: rgba(239,68,68,0.06);
  border-bottom: 1px solid rgba(239,68,68,0.2);
  font-size: 12px;
  color: #ef4444;
  flex-shrink: 0;
}

/* ── Compare mode ────────────────────────────────────────────────────────── */
.compare-selectors {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px 14px;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;
}

.compare-selector-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.compare-vs {
  font-size: 12px;
  font-weight: 700;
  color: #484f58;
  letter-spacing: 0.06em;
  padding-top: 20px;
}

.compare-cards {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 16px 24px;
  overflow-y: auto;
}

.compare-card {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: opacity 0.2s;
}

.compare-card--dim {
  opacity: 0.6;
}

.compare-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #30363d;
}

.compare-card-label {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #484f58;
}

.model-name-badge {
  font-size: 12px;
  font-weight: 600;
  color: #c9d1d9;
}

.compare-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid rgba(48,54,61,0.4);
}

.compare-field:last-child {
  border-bottom: none;
}

.compare-field--tags {
  align-items: flex-start;
  padding-top: 10px;
  padding-bottom: 12px;
}

.compare-field-label {
  font-size: 11px;
  font-weight: 600;
  color: #484f58;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  min-width: 100px;
}

.compare-field-val {
  font-size: 12.5px;
  color: #c9d1d9;
  text-align: right;
}

.compare-field-val--mono {
  font-family: 'Consolas', 'Fira Mono', monospace;
  font-variant-numeric: tabular-nums;
}

.compare-winner {
  color: #22c55e;
  font-weight: 700;
}

.compare-loser {
  color: #8b949e;
}

.compare-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  color: #484f58;
  font-size: 12px;
}

/* ── Shared form elements ────────────────────────────────────────────────── */
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

.input:focus { border-color: #3b82f6; }

.select-input { cursor: pointer; }

/* ── Spinner ─────────────────────────────────────────────────────────────── */
.spinner {
  display: inline-block;
  width: 11px;
  height: 11px;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Modal ───────────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.modal-box {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 10px;
  padding: 28px;
  width: 380px;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

.modal-icon {
  margin-bottom: 4px;
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: #e6edf3;
  margin: 0;
  letter-spacing: -0.01em;
}

.modal-body {
  font-size: 13px;
  color: #8b949e;
  text-align: center;
  margin: 4px 0 10px;
  line-height: 1.5;
}

.modal-body strong {
  color: #e6edf3;
}

.modal-actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>

<template>
  <div class="hub-page">

    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <div class="hub-header">
      <div class="hub-header-left">
        <h1 class="hub-title">AI Training Lab</h1>
        <span class="beta-badge">Beta</span>
        <router-link to="/projects?industry=ai-training" class="projects-badge">Open in Projects →</router-link>
      </div>
      <p class="hub-tagline">Build, train, and evaluate models from your graph data</p>
    </div>

    <!-- ── Stat cards ──────────────────────────────────────────────────────── -->
    <div class="stats-row">
      <div class="stat-card panel">
        <div class="stat-icon stat-icon--blue">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
            <path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9"/>
            <path d="M3 13v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4"/>
          </svg>
        </div>
        <div>
          <div class="stat-value">{{ stats.datasets }}</div>
          <div class="stat-label">Total Datasets</div>
        </div>
      </div>

      <div class="stat-card panel">
        <div class="stat-icon stat-icon--green">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="10 8 16 12 10 16 10 8"/>
          </svg>
        </div>
        <div>
          <div class="stat-value">{{ stats.activeRuns }}</div>
          <div class="stat-label">Active Runs</div>
        </div>
      </div>

      <div class="stat-card panel">
        <div class="stat-icon stat-icon--purple">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <div>
          <div class="stat-value">{{ stats.completedRuns }}</div>
          <div class="stat-label">Completed Runs</div>
        </div>
      </div>

      <div class="stat-card panel">
        <div class="stat-icon stat-icon--orange">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
        </div>
        <div>
          <div class="stat-value">{{ stats.models }}</div>
          <div class="stat-label">Trained Models</div>
        </div>
      </div>
    </div>

    <!-- ── Feature nav cards ───────────────────────────────────────────────── -->
    <div class="nav-grid">
      <button class="nav-card panel" @click="router.push('/ai-training/datasets')">
        <div class="nav-card-icon nav-card-icon--blue">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
            <path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9"/>
            <path d="M3 13v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4"/>
          </svg>
        </div>
        <div class="nav-card-body">
          <div class="nav-card-title">Dataset Manager</div>
          <div class="nav-card-desc">Manage training datasets — generate from graph data, upload files, or annotate manually</div>
        </div>
        <svg class="nav-card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      <button class="nav-card panel" @click="router.push('/ai-training/train')">
        <div class="nav-card-icon nav-card-icon--green">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
        </div>
        <div class="nav-card-body">
          <div class="nav-card-title">Train Model</div>
          <div class="nav-card-desc">Configure and launch a training run with LoRA, QLoRA, or full fine-tuning</div>
        </div>
        <svg class="nav-card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      <button class="nav-card panel" @click="router.push('/ai-training/monitor')">
        <div class="nav-card-icon nav-card-icon--purple">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
        </div>
        <div class="nav-card-body">
          <div class="nav-card-title">Training Monitor</div>
          <div class="nav-card-desc">Live loss curves, throughput metrics, and console log for all training runs</div>
        </div>
        <svg class="nav-card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      <button class="nav-card panel" @click="router.push('/ai-training/models')">
        <div class="nav-card-icon nav-card-icon--orange">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
        </div>
        <div class="nav-card-body">
          <div class="nav-card-title">Model Registry</div>
          <div class="nav-card-desc">Browse trained models, compare metrics, and test in the playground</div>
        </div>
        <svg class="nav-card-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>

    <!-- ── Recent runs table ───────────────────────────────────────────────── -->
    <div class="panel runs-panel">
      <div class="panel-header">
        <span class="panel-title">Recent Runs</span>
        <span class="text-secondary" style="font-size:12px">{{ runs.length }} runs</span>
      </div>
      <div class="runs-table-wrap">
        <table class="runs-table">
          <thead>
            <tr>
              <th>Run ID</th>
              <th>Name</th>
              <th>Model</th>
              <th>Status</th>
              <th>Best Loss</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="runsLoading">
              <td colspan="6" class="runs-empty">
                <div class="skeleton-line" style="width:60%;margin:0 auto"></div>
              </td>
            </tr>
            <tr v-else-if="runs.length === 0">
              <td colspan="6" class="runs-empty text-secondary">No runs yet</td>
            </tr>
            <tr v-for="run in runs" :key="run.id" class="runs-row">
              <td class="run-id text-muted">{{ run.id.slice(0, 8) }}…</td>
              <td class="run-name">{{ run.name }}</td>
              <td class="run-model text-secondary">{{ run.config?.model ?? '—' }}</td>
              <td>
                <span class="status-badge" :style="statusStyle(run.status)">{{ run.status }}</span>
              </td>
              <td class="run-loss font-mono">{{ run.best_loss != null ? run.best_loss.toFixed(4) : '—' }}</td>
              <td class="run-duration text-secondary">{{ formatDuration(run.duration_secs) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Playground quick-link ───────────────────────────────────────────── -->
    <div class="playground-bar">
      <button class="playground-link" @click="router.push('/ai-training/playground')">
        Test a model in the playground
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </button>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePrismAPI } from '@/composables/usePrismAPI'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Dataset {
  id: string
  name: string
  examples: any[]
}

interface Run {
  id: string
  name: string
  config: { model: string }
  status: string
  best_loss: number | null
  duration_secs: number | null
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const router = useRouter()
const api = usePrismAPI()

// ── State ─────────────────────────────────────────────────────────────────────

const runs = ref<Run[]>([])
const runsLoading = ref(true)

const stats = ref({
  datasets: 0,
  activeRuns: 0,
  completedRuns: 0,
  models: 0,
})

let refreshTimer: ReturnType<typeof setInterval> | null = null

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchAll() {
  const [datasetsRes, runsRes, modelsRes] = await Promise.all([
    api.get<{ datasets: Dataset[] }>('/train/datasets'),
    api.get<{ runs: Run[] }>('/train/runs'),
    api.get<{ models: any[] }>('/train/models'),
  ])

  if (datasetsRes) {
    stats.value.datasets = datasetsRes.datasets.length
  }

  if (runsRes) {
    runs.value = runsRes.runs
    stats.value.activeRuns = runsRes.runs.filter(r => r.status === 'running').length
    stats.value.completedRuns = runsRes.runs.filter(r => r.status === 'completed').length
    runsLoading.value = false
  } else {
    runsLoading.value = false
  }

  if (modelsRes) {
    stats.value.models = modelsRes.models.length
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  running:   '#22c55e',
  completed: '#3b82f6',
  stopped:   '#6b7280',
  failed:    '#ef4444',
  pending:   '#f59e0b',
}

function statusStyle(status: string) {
  const color = STATUS_COLORS[status] ?? '#6b7280'
  return {
    color,
    background: color + '22',
    borderColor: color + '55',
  }
}

function formatDuration(secs: number | null): string {
  if (secs == null) return '—'
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${m}m`
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(() => {
  fetchAll()
  refreshTimer = setInterval(fetchAll, 10_000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<style scoped>
.hub-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px;
  height: 100%;
  overflow-y: auto;
  background: #0d1117;
  color: var(--text-primary);
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.hub-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hub-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.projects-badge {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: #6366f1;
  border: 1px solid rgba(99,102,241,0.5);
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s;
}
.projects-badge:hover { background: rgba(99,102,241,0.12); }

.hub-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.beta-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.hub-tagline {
  font-size: 13px;
  color: var(--text-secondary);
}

/* ── Stat cards ──────────────────────────────────────────────────────────── */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  flex-shrink: 0;
}

.stat-icon--blue   { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
.stat-icon--green  { background: rgba(34, 197, 94, 0.12);  color: #22c55e; }
.stat-icon--purple { background: rgba(184, 119, 217, 0.12); color: var(--accent-purple); }
.stat-icon--orange { background: rgba(255, 152, 48, 0.12);  color: var(--accent-orange); }

.stat-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  color: var(--text-primary);
}

.stat-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 4px;
}

/* ── Nav cards ───────────────────────────────────────────────────────────── */
.nav-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.nav-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
  width: 100%;
}

.nav-card:hover {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.04);
}

.nav-card:hover .nav-card-arrow {
  color: #3b82f6;
  transform: translateX(3px);
}

.nav-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 10px;
  flex-shrink: 0;
}

.nav-card-icon--blue   { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
.nav-card-icon--green  { background: rgba(34, 197, 94, 0.12);  color: #22c55e; }
.nav-card-icon--purple { background: rgba(184, 119, 217, 0.12); color: var(--accent-purple); }
.nav-card-icon--orange { background: rgba(255, 152, 48, 0.12);  color: var(--accent-orange); }

.nav-card-body {
  flex: 1;
  min-width: 0;
}

.nav-card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.nav-card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.nav-card-arrow {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: color 0.15s, transform 0.15s;
}

/* ── Runs panel ──────────────────────────────────────────────────────────── */
.runs-panel {
  background: #161b22;
  border: 1px solid #30363d;
  flex-shrink: 0;
}

.runs-table-wrap {
  overflow-x: auto;
}

.runs-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.runs-table thead th {
  padding: 8px 14px;
  text-align: left;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 1px solid #30363d;
  white-space: nowrap;
}

.runs-row {
  transition: background 0.1s;
}

.runs-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.runs-table tbody td {
  padding: 9px 14px;
  border-bottom: 1px solid rgba(48, 54, 61, 0.6);
}

.runs-row:last-child td {
  border-bottom: none;
}

.runs-empty {
  padding: 20px 14px;
  text-align: center;
  font-size: 12px;
}

.run-id {
  font-family: var(--font-mono);
  font-size: 11px;
}

.run-name {
  color: var(--text-primary);
  font-weight: 500;
}

.run-model {
  font-size: 11px;
}

.run-loss {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-primary);
}

.run-duration {
  font-size: 11px;
  white-space: nowrap;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: capitalize;
  border: 1px solid transparent;
}

.font-mono {
  font-family: var(--font-mono);
}

/* ── Playground bar ──────────────────────────────────────────────────────── */
.playground-bar {
  display: flex;
  justify-content: flex-end;
  padding-bottom: 8px;
}

.playground-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #3b82f6;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.playground-link:hover {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.06);
}

/* ── Skeleton ────────────────────────────────────────────────────────────── */
.skeleton-line {
  height: 12px;
  border-radius: 4px;
  background: linear-gradient(90deg, #161b22 25%, #1f2937 50%, #161b22 75%);
  background-size: 200% 100%;
  animation: skeleton-sweep 1.4s ease-in-out infinite;
}

@keyframes skeleton-sweep {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .nav-grid  { grid-template-columns: 1fr; }
}
</style>

<template>
  <div class="tm-page">

    <!-- ── Left panel: run list ──────────────────────────────────────────────── -->
    <div class="tm-sidebar">
      <div class="sidebar-header">
        <span class="sidebar-title">Runs</span>
        <button class="icon-btn" :class="{ spinning: loadingRuns }" @click="fetchRuns" title="Refresh">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      <div v-if="loadingRuns" class="run-list-loading">
        <span class="spinner spinner--sm"></span>
        <span>Loading runs…</span>
      </div>

      <div v-else-if="runs.length === 0" class="run-list-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#484f58" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/><polyline points="10 8 16 12 10 16 10 8"/>
        </svg>
        <p>No runs yet</p>
      </div>

      <div v-else class="run-list">
        <button
          v-for="run in runs"
          :key="run.id"
          class="run-item"
          :class="{ 'run-item--active': selectedId === run.id }"
          @click="selectRun(run.id)"
        >
          <div class="run-item-top">
            <span class="run-item-name" :title="run.name">{{ run.name }}</span>
            <span class="status-badge" :style="{ background: statusBg(run.status), color: statusColor(run.status) }">
              {{ run.status }}
            </span>
          </div>
          <div class="run-item-meta">
            <span class="run-item-model" :title="run.config?.model">{{ truncate(run.config?.model ?? '—', 22) }}</span>
            <span v-if="run.best_loss != null" class="run-item-loss">{{ run.best_loss.toFixed(4) }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- ── Right panel: detail ───────────────────────────────────────────────── -->
    <div class="tm-detail">

      <!-- Empty state -->
      <div v-if="!selectedId" class="detail-empty">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#484f58" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/>
        </svg>
        <p>Select a run to view details</p>
      </div>

      <!-- Run detail -->
      <template v-else-if="selectedRun">

        <!-- Run header -->
        <div class="detail-header">
          <div class="detail-header-left">
            <h2 class="detail-run-name">{{ selectedRun.name }}</h2>
            <span class="status-badge status-badge--lg" :style="{ background: statusBg(selectedRun.status), color: statusColor(selectedRun.status) }">
              <span v-if="selectedRun.status === 'running'" class="pulse-dot"></span>
              {{ selectedRun.status }}
            </span>
          </div>
          <div class="detail-header-meta">
            <span class="meta-chip">{{ selectedRun.config?.model ?? '—' }}</span>
            <span class="meta-chip">{{ selectedRun.config?.approach ?? '—' }}</span>
            <span class="meta-chip">{{ selectedRun.config?.backend ?? '—' }}</span>
          </div>
          <button
            v-if="selectedRun.status === 'running'"
            class="btn btn-danger"
            :disabled="stopping"
            @click="stopRun"
          >
            <span v-if="stopping" class="spinner"></span>
            <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            {{ stopping ? 'Stopping…' : 'Stop Run' }}
          </button>
        </div>

        <!-- KPI row -->
        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-label">Best Loss</div>
            <div class="kpi-value">{{ selectedRun.best_loss != null ? selectedRun.best_loss.toFixed(4) : '—' }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Current Epoch</div>
            <div class="kpi-value">{{ liveMetrics?.epoch ?? latestMetric?.epoch ?? '—' }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Steps</div>
            <div class="kpi-value">{{ liveMetrics?.step ?? latestMetric?.step ?? '—' }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Throughput</div>
            <div class="kpi-value">{{ throughputDisplay }}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">Duration</div>
            <div class="kpi-value">{{ formatDuration(selectedRun.duration_secs) }}</div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="tab-bar">
          <button class="tab-btn" :class="{ 'tab-btn--active': activeTab === 'charts' }" @click="activeTab = 'charts'">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            Charts
          </button>
          <button class="tab-btn" :class="{ 'tab-btn--active': activeTab === 'console' }" @click="activeTab = 'console'">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
            Console
          </button>
        </div>

        <!-- Charts tab -->
        <div v-show="activeTab === 'charts'" class="tab-content">
          <div class="chart-block">
            <div class="chart-label">Loss</div>
            <div ref="lossChartEl" class="chart-canvas" style="height:320px"></div>
          </div>
          <div class="chart-block" style="margin-top:12px">
            <div class="chart-label">Learning Rate</div>
            <div ref="lrChartEl" class="chart-canvas" style="height:180px"></div>
          </div>
        </div>

        <!-- Console tab -->
        <div v-show="activeTab === 'console'" class="tab-content">
          <div class="console-toolbar">
            <button class="icon-btn" @click="scrollConsoleToBottom">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              Scroll to bottom
            </button>
          </div>
          <div ref="consoleEl" class="console-body">
            <div v-if="!consoleLogs.length" class="console-empty">No log output yet.</div>
            <div v-for="(line, i) in consoleLogs" :key="i" class="console-line">{{ line }}</div>
          </div>
        </div>

      </template>

      <!-- Loading skeleton -->
      <div v-else-if="loadingDetail" class="detail-loading">
        <span class="spinner"></span>
        <span>Loading run…</span>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { usePrismAPI } from '@/composables/usePrismAPI'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RunMetric {
  step: number
  epoch?: number
  train_loss?: number
  val_loss?: number
  lr?: number
  throughput?: number
}

interface Run {
  id: string
  name: string
  config: { model: string; approach: string; backend: string }
  status: 'running' | 'completed' | 'stopped' | 'failed' | 'pending'
  metrics: RunMetric[]
  best_loss?: number
  duration_secs?: number
  created_at: string
  logs?: string[]
}

// ── Setup ─────────────────────────────────────────────────────────────────────

const api = usePrismAPI()

// ── State ─────────────────────────────────────────────────────────────────────

const runs          = ref<Run[]>([])
const loadingRuns   = ref(false)
const selectedId    = ref<string | null>(null)
const selectedRun   = ref<Run | null>(null)
const loadingDetail = ref(false)
const activeTab     = ref<'charts' | 'console'>('charts')
const liveMetrics   = ref<RunMetric | null>(null)
const stopping      = ref(false)

// chart elements
const lossChartEl = ref<HTMLElement | null>(null)
const lrChartEl   = ref<HTMLElement | null>(null)
let   lossChart:   echarts.ECharts | null = null
let   lrChart:     echarts.ECharts | null = null

// console
const consoleEl = ref<HTMLElement | null>(null)
const consoleLogs = ref<string[]>([])

// polling + SSE
let pollTimer:  ReturnType<typeof setInterval> | null = null
let eventSrc:   EventSource | null = null

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  running:   { bg: 'rgba(34,197,94,0.12)',   fg: '#22c55e' },
  completed: { bg: 'rgba(59,130,246,0.12)',  fg: '#3b82f6' },
  stopped:   { bg: 'rgba(107,114,128,0.12)', fg: '#6b7280' },
  failed:    { bg: 'rgba(239,68,68,0.12)',   fg: '#ef4444' },
  pending:   { bg: 'rgba(245,158,11,0.12)',  fg: '#f59e0b' },
}

function statusBg(s: string) { return STATUS_COLORS[s]?.bg ?? 'rgba(107,114,128,0.12)' }
function statusColor(s: string) { return STATUS_COLORS[s]?.fg ?? '#6b7280' }

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + '…' : s }

function formatDuration(secs?: number) {
  if (secs == null) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

const latestMetric = computed<RunMetric | null>(() => {
  const m = selectedRun.value?.metrics
  return m && m.length ? m[m.length - 1] : null
})

const throughputDisplay = computed(() => {
  const t = liveMetrics.value?.throughput ?? latestMetric.value?.throughput
  return t != null ? `${t.toFixed(1)} ex/s` : '—'
})

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchRuns() {
  loadingRuns.value = true
  const res = await api.get<{ runs: Run[] }>('/train/runs')
  if (res?.runs) runs.value = res.runs
  loadingRuns.value = false
}

async function fetchRunDetail(id: string) {
  loadingDetail.value = true
  const res = await api.get<Run>(`/train/runs/${id}`)
  loadingDetail.value = false
  if (res) {
    selectedRun.value = res
    consoleLogs.value = res.logs ?? []
  }
}

// ── Run selection ─────────────────────────────────────────────────────────────

async function selectRun(id: string) {
  if (selectedId.value === id) return
  teardown()
  selectedId.value   = id
  selectedRun.value  = null
  liveMetrics.value  = null
  consoleLogs.value  = []
  await fetchRunDetail(id)
  await nextTick()
  initCharts()
  if (selectedRun.value?.status === 'running') {
    openSSE(id)
  }
}

// ── Charts ────────────────────────────────────────────────────────────────────

const CHART_BG    = '#0d1117'
const CHART_GRID  = '#21262d'
const CHART_LABEL = '#8b949e'
const CHART_AXIS  = '#30363d'

function chartBase(): echarts.EChartsOption {
  return {
    backgroundColor: CHART_BG,
    animation: false,
    grid: { left: 52, right: 20, top: 36, bottom: 36 },
    xAxis: {
      type: 'value',
      axisLine:  { lineStyle: { color: CHART_AXIS } },
      axisLabel: { color: CHART_LABEL, fontSize: 11 },
      splitLine: { lineStyle: { color: CHART_GRID } },
    },
    yAxis: {
      type: 'value',
      axisLine:  { lineStyle: { color: CHART_AXIS } },
      axisLabel: { color: CHART_LABEL, fontSize: 11 },
      splitLine: { lineStyle: { color: CHART_GRID } },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#161b22',
      borderColor: '#30363d',
      textStyle: { color: '#e6edf3', fontSize: 12 },
    },
  }
}

function initCharts() {
  const metrics = selectedRun.value?.metrics ?? []

  // dispose old instances
  lossChart?.dispose()
  lrChart?.dispose()

  if (lossChartEl.value) {
    lossChart = echarts.init(lossChartEl.value, undefined, { renderer: 'canvas' })
    renderLossChart(metrics)
  }
  if (lrChartEl.value) {
    lrChart = echarts.init(lrChartEl.value, undefined, { renderer: 'canvas' })
    renderLrChart(metrics)
  }
}

function renderLossChart(metrics: RunMetric[]) {
  if (!lossChart) return
  const steps      = metrics.map(m => m.step)
  const trainLoss  = metrics.map(m => m.train_loss ?? null)
  const valLoss    = metrics.map(m => m.val_loss ?? null)

  lossChart.setOption({
    ...chartBase(),
    legend: {
      data: ['Train Loss', 'Val Loss'],
      top: 4,
      textStyle: { color: CHART_LABEL, fontSize: 11 },
      inactiveColor: '#484f58',
    },
    xAxis: { ...(chartBase().xAxis as object), data: steps },
    series: [
      {
        name: 'Train Loss',
        type: 'line',
        data: trainLoss,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#3b82f6', width: 2 },
        itemStyle: { color: '#3b82f6' },
      },
      {
        name: 'Val Loss',
        type: 'line',
        data: valLoss,
        smooth: true,
        showSymbol: false,
        lineStyle: { color: '#f97316', width: 2 },
        itemStyle: { color: '#f97316' },
      },
    ],
  } as echarts.EChartsOption, true)
}

function renderLrChart(metrics: RunMetric[]) {
  if (!lrChart) return
  const steps = metrics.map(m => m.step)
  const lrs   = metrics.map(m => m.lr ?? null)

  lrChart.setOption({
    ...chartBase(),
    grid: { left: 70, right: 20, top: 12, bottom: 36 },
    xAxis: { ...(chartBase().xAxis as object), data: steps },
    yAxis: {
      ...(chartBase().yAxis as object),
      axisLabel: {
        color: CHART_LABEL,
        fontSize: 10,
        formatter: (v: number) => v.toExponential(1),
      },
    },
    series: [
      {
        name: 'LR',
        type: 'line',
        data: lrs,
        smooth: false,
        showSymbol: false,
        lineStyle: { color: '#a78bfa', width: 1.5 },
        itemStyle: { color: '#a78bfa' },
      },
    ],
  } as echarts.EChartsOption, true)
}

// ── Polling (for chart updates every 2s when running) ─────────────────────────

function startPolling(id: string) {
  stopPolling()
  pollTimer = setInterval(async () => {
    const res = await api.get<Run>(`/train/runs/${id}`)
    if (!res) return
    selectedRun.value = res
    consoleLogs.value = res.logs ?? []
    renderLossChart(res.metrics)
    renderLrChart(res.metrics)
    if (res.status !== 'running') {
      stopPolling()
      closeSSE()
    }
    await scrollConsoleToBottom()
  }, 2000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

// ── SSE ───────────────────────────────────────────────────────────────────────

function openSSE(id: string) {
  closeSSE()
  const url = `/api/train/runs/${id}/stream`
  eventSrc = new EventSource(url)

  eventSrc.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data)
      if (data.type === 'metric') {
        liveMetrics.value = data.metric as RunMetric
        const metrics = selectedRun.value?.metrics ?? []
        metrics.push(data.metric as RunMetric)
        if (selectedRun.value) selectedRun.value.metrics = [...metrics]
        renderLossChart(metrics)
        renderLrChart(metrics)
      } else if (data.type === 'log') {
        consoleLogs.value.push(data.line as string)
        scrollConsoleToBottom()
      } else if (data.type === 'done') {
        closeSSE()
        fetchRunDetail(id)
        fetchRuns()
      }
    } catch { /* ignore malformed */ }
  }

  eventSrc.onerror = () => {
    closeSSE()
    // fall back to polling
    startPolling(id)
  }
}

function closeSSE() {
  if (eventSrc) { eventSrc.close(); eventSrc = null }
}

// ── Stop run ──────────────────────────────────────────────────────────────────

async function stopRun() {
  if (!selectedId.value) return
  stopping.value = true
  await api.post(`/train/runs/${selectedId.value}/stop`, {})
  stopping.value = false
  teardown()
  await fetchRunDetail(selectedId.value)
  await fetchRuns()
}

// ── Console scroll ────────────────────────────────────────────────────────────

async function scrollConsoleToBottom() {
  await nextTick()
  if (consoleEl.value) {
    consoleEl.value.scrollTop = consoleEl.value.scrollHeight
  }
}

// ── Teardown ──────────────────────────────────────────────────────────────────

function teardown() {
  closeSSE()
  stopPolling()
}

// ── Watchers ──────────────────────────────────────────────────────────────────

watch(activeTab, async (tab) => {
  if (tab === 'charts') {
    await nextTick()
    if (selectedRun.value) {
      initCharts()
    }
  } else if (tab === 'console') {
    await scrollConsoleToBottom()
  }
})

watch(consoleLogs, async () => {
  if (activeTab.value === 'console') {
    await scrollConsoleToBottom()
  }
}, { deep: true })

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(fetchRuns)

onUnmounted(() => {
  teardown()
  lossChart?.dispose()
  lrChart?.dispose()
})
</script>

<style scoped>
/* ── Page shell ──────────────────────────────────────────────────────────── */
.tm-page {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: #0d1117;
  color: #e6edf3;
  font-size: 13px;
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
.tm-sidebar {
  width: 280px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #30363d;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid #30363d;
}

.sidebar-title {
  font-size: 13px;
  font-weight: 700;
  color: #e6edf3;
  letter-spacing: -0.01em;
}

.run-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.run-list-loading,
.run-list-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 32px 16px;
  color: #484f58;
  font-size: 12px;
}

.run-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid transparent;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
  color: #e6edf3;
}

.run-item:hover {
  background: rgba(255,255,255,0.03);
  border-color: #30363d;
}

.run-item--active {
  background: rgba(59,130,246,0.08);
  border-color: rgba(59,130,246,0.3);
}

.run-item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.run-item-name {
  font-size: 12px;
  font-weight: 600;
  color: #c9d1d9;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.run-item--active .run-item-name {
  color: #e6edf3;
}

.run-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.run-item-model {
  font-size: 11px;
  color: #484f58;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.run-item-loss {
  font-size: 11px;
  color: #8b949e;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

/* ── Detail panel ────────────────────────────────────────────────────────── */
.tm-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-empty,
.detail-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #484f58;
  font-size: 13px;
}

/* ── Detail header ───────────────────────────────────────────────────────── */
.detail-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 20px 12px;
  border-bottom: 1px solid #30363d;
  flex-wrap: wrap;
}

.detail-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.detail-run-name {
  font-size: 16px;
  font-weight: 700;
  color: #e6edf3;
  margin: 0;
  letter-spacing: -0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-header-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* ── Status badge ────────────────────────────────────────────────────────── */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  flex-shrink: 0;
}

.status-badge--lg {
  font-size: 11px;
  padding: 3px 10px;
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.35; }
}

/* ── Meta chip ───────────────────────────────────────────────────────────── */
.meta-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  background: rgba(48,54,61,0.6);
  border: 1px solid #30363d;
  color: #8b949e;
}

/* ── KPI row ─────────────────────────────────────────────────────────────── */
.kpi-row {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #30363d;
}

.kpi-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 16px;
  border-right: 1px solid #30363d;
}

.kpi-card:last-child {
  border-right: none;
}

.kpi-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #484f58;
}

.kpi-value {
  font-size: 18px;
  font-weight: 700;
  color: #e6edf3;
  font-variant-numeric: tabular-nums;
}

/* ── Tab bar ─────────────────────────────────────────────────────────────── */
.tab-bar {
  display: flex;
  border-bottom: 1px solid #30363d;
  padding: 0 16px;
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 12px 8px;
  font-size: 12px;
  font-weight: 500;
  color: #8b949e;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: -1px;
}

.tab-btn:hover {
  color: #c9d1d9;
}

.tab-btn--active {
  color: #e6edf3;
  border-bottom-color: #3b82f6;
}

/* ── Tab content ─────────────────────────────────────────────────────────── */
.tab-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

/* ── Chart block ─────────────────────────────────────────────────────────── */
.chart-block {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  overflow: hidden;
}

.chart-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #8b949e;
  padding: 10px 14px 8px;
  border-bottom: 1px solid #30363d;
}

.chart-canvas {
  width: 100%;
}

/* ── Console ─────────────────────────────────────────────────────────────── */
.console-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.console-body {
  background: #010409;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 12px 14px;
  max-height: 400px;
  overflow-y: auto;
  font-family: 'Consolas', 'Fira Mono', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.console-empty {
  color: #484f58;
}

.console-line {
  color: #22c55e;
  white-space: pre-wrap;
  word-break: break-all;
}

/* ── Shared buttons ──────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
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

.btn-danger {
  border-color: rgba(239,68,68,0.4);
  color: #ef4444;
}

.btn-danger:hover:not(:disabled) {
  background: rgba(239,68,68,0.1);
  border-color: #ef4444;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border-radius: 5px;
  background: none;
  border: 1px solid transparent;
  color: #8b949e;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}

.icon-btn:hover {
  background: rgba(255,255,255,0.05);
  border-color: #30363d;
  color: #c9d1d9;
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */
.spinner {
  display: inline-block;
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
  flex-shrink: 0;
}

.spinner--sm {
  width: 11px;
  height: 11px;
}

.spinning svg {
  animation: spin 0.65s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>

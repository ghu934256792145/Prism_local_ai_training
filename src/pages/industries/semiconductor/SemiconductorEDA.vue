<template>
  <div class="eda-shell">
    <!-- Left sidebar -->
    <aside class="eda-sidebar">
      <div class="sidebar-header">
        <svg class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="7" y="7" width="10" height="10" rx="1" />
          <line x1="7" y1="10" x2="4" y2="10" /><line x1="7" y1="14" x2="4" y2="14" />
          <line x1="17" y1="10" x2="20" y2="10" /><line x1="17" y1="14" x2="20" y2="14" />
          <line x1="10" y1="7" x2="10" y2="4" /><line x1="14" y1="7" x2="14" y2="4" />
          <line x1="10" y1="17" x2="10" y2="20" /><line x1="14" y1="17" x2="14" y2="20" />
        </svg>
        <span class="sidebar-title">EDA Netlist Explorer</span>
      </div>

      <!-- Template selector -->
      <div class="section-label">Template</div>
      <div class="template-list">
        <label
          v-for="t in templates"
          :key="t"
          class="radio-card"
          :class="{ active: selectedTemplate === t }"
        >
          <input
            type="radio"
            :value="t"
            v-model="selectedTemplate"
            @change="fetchGraph"
            style="display:none"
          />
          <span class="radio-dot" :class="{ checked: selectedTemplate === t }"></span>
          <span class="radio-label">{{ templateLabels[t] }}</span>
        </label>
      </div>

      <!-- Category legend -->
      <div class="section-label" style="margin-top:14px">Categories</div>
      <div class="legend-list">
        <div
          v-for="(cat, i) in (graphData?.categories ?? [])"
          :key="i"
          class="legend-row"
        >
          <span class="legend-dot" :style="{ background: CAT_COLORS[i] ?? '#6b7280' }"></span>
          <span style="font-size:12px;color:#e2e8f0">{{ cat }}</span>
        </div>
        <div v-if="!graphData" style="font-size:11px;color:#64748b;padding:4px 0">Loading…</div>
      </div>

      <!-- Stats -->
      <div class="section-label" style="margin-top:14px">Stats</div>
      <div class="stats-block">
        <div class="stat-row">
          <span class="stat-label">Nodes</span>
          <span class="stat-val">{{ graphData?.nodes.length ?? '–' }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Edges</span>
          <span class="stat-val">{{ graphData?.edges.length ?? '–' }}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Categories</span>
          <span class="stat-val">{{ graphData?.categories.length ?? '–' }}</span>
        </div>
      </div>

      <!-- Load into Store -->
      <div style="padding:12px 12px 16px">
        <button class="load-btn" :disabled="loading || storeLoading" @click="loadIntoStore">
          <span v-if="storeLoading">Loading…</span>
          <span v-else>Load into Store</span>
        </button>
        <div v-if="storeMsg" class="store-msg" :class="storeMsg.ok ? 'ok' : 'err'">{{ storeMsg.text }}</div>
      </div>
    </aside>

    <!-- Right panel -->
    <div class="eda-main">
      <!-- Tab bar -->
      <div class="tab-bar">
        <button
          v-for="t in TABS"
          :key="t.key"
          class="tab-btn"
          :class="{ active: activeTab === t.key }"
          @click="switchTab(t.key)"
        >{{ t.label }}</button>
      </div>

      <!-- Loading / error overlay -->
      <div v-if="loading" class="overlay">
        <div class="spinner"></div>
        <span style="color:#94a3b8;font-size:13px;margin-top:10px">Loading netlist…</span>
      </div>
      <div v-else-if="error" class="overlay">
        <span style="color:#f87171;font-size:13px">{{ error }}</span>
      </div>

      <!-- Force Graph tab -->
      <div v-show="activeTab === 'graph'" class="tab-content">
        <div ref="graphEl" class="chart-fill"></div>
      </div>

      <!-- Vector Space tab -->
      <div v-show="activeTab === 'vector'" class="tab-content">
        <div ref="vectorEl" class="chart-fill"></div>
      </div>

      <!-- Timing Table tab -->
      <div v-show="activeTab === 'timing'" class="tab-content timing-content">
        <table class="timing-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Label</th>
              <th>Category</th>
              <th>Fanout</th>
              <th>Complexity</th>
              <th>Timing Slack</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in timingRows"
              :key="row.id"
              :class="{ 'slack-neg': row.slack < 0 }"
            >
              <td class="mono">{{ row.id }}</td>
              <td>{{ row.label }}</td>
              <td>
                <span
                  class="cat-badge"
                  :style="{
                    background: (CAT_COLORS[row.category] ?? '#6b7280') + '22',
                    color: CAT_COLORS[row.category] ?? '#6b7280',
                    borderColor: (CAT_COLORS[row.category] ?? '#6b7280') + '66'
                  }"
                >{{ graphData?.categories[row.category] ?? row.category }}</span>
              </td>
              <td class="num">{{ row.value }}</td>
              <td class="num">{{ row.symbolSize }}</td>
              <td class="num" :class="{ 'neg-val': row.slack < 0 }">{{ row.slackStr }} ns</td>
            </tr>
            <tr v-if="timingRows.length === 0">
              <td colspan="6" style="text-align:center;color:#64748b;padding:24px">No data</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'

const BASE = 'http://localhost:3000'

const templates = ['alu-4bit', 'risc-pipeline'] as const
const templateLabels: Record<string, string> = {
  'alu-4bit': '4-bit ALU',
  'risc-pipeline': 'RISC Pipeline',
}
const selectedTemplate = ref<string>('alu-4bit')
const activeTab = ref<'graph' | 'vector' | 'timing'>('graph')

interface GraphNode { id: string; label: string; category: number; value: number; symbolSize: number }
interface GraphEdge { source: string; target: string; label: string; weight: number }
interface VectorPoint { id: string; label: string; x: number; y: number; cluster: number; score: number; tags: string[] }
interface GraphData {
  dataset: string
  categories: string[]
  nodes: GraphNode[]
  edges: GraphEdge[]
  vectors: VectorPoint[]
}

const graphData = ref<GraphData | null>(null)
const loading = ref(false)
const error = ref('')
const storeLoading = ref(false)
const storeMsg = ref<{ ok: boolean; text: string } | null>(null)

const CAT_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#f97316', '#6b7280']

const TABS = [
  { key: 'graph', label: 'Force Graph' },
  { key: 'vector', label: 'Vector Space' },
  { key: 'timing', label: 'Timing Table' },
] as const

// Chart DOM refs
const graphEl = ref<HTMLElement | null>(null)
const vectorEl = ref<HTMLElement | null>(null)

let chartInstances: echarts.ECharts[] = []
let graphResizeObs: ResizeObserver | null = null
let vectorResizeObs: ResizeObserver | null = null

// Timing table rows
const timingRows = computed(() => {
  if (!graphData.value) return []
  return graphData.value.nodes
    .filter(n => n.category <= 3)
    .map(n => {
      const slack = n.value * 0.4 - 2.5
      return {
        ...n,
        slack,
        slackStr: slack.toFixed(2),
      }
    })
    .sort((a, b) => b.value - a.value)
})

async function fetchGraph() {
  loading.value = true
  error.value = ''
  storeMsg.value = null
  try {
    const res = await fetch(`${BASE}/api/semiconductor/graph/${selectedTemplate.value}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    graphData.value = await res.json()
  } catch (e: any) {
    error.value = `Failed to load: ${e.message}`
    graphData.value = null
  } finally {
    loading.value = false
  }
}

async function loadIntoStore() {
  if (!graphData.value) return
  storeLoading.value = true
  storeMsg.value = null
  const name = selectedTemplate.value === 'alu-4bit' ? 'semiconductor-alu' : 'semiconductor-risc'
  try {
    const res = await fetch(`${BASE}/api/store/datasets/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    storeMsg.value = { ok: true, text: `Loaded "${name}" into store.` }
  } catch (e: any) {
    storeMsg.value = { ok: false, text: `Error: ${e.message}` }
  } finally {
    storeLoading.value = false
  }
}

function switchTab(t: typeof activeTab.value) {
  activeTab.value = t
  nextTick(() => {
    if (t === 'graph') renderForceGraph()
    if (t === 'vector') renderVectorSpace()
  })
}

function getOrCreateChart(el: HTMLElement): echarts.ECharts {
  let c = echarts.getInstanceByDom(el)
  if (!c) {
    c = echarts.init(el, 'dark', { renderer: 'canvas' })
    chartInstances.push(c)
  }
  return c
}

function renderForceGraph() {
  const el = graphEl.value
  if (!el || !graphData.value) return
  const c = getOrCreateChart(el)
  const { categories, nodes, edges } = graphData.value

  c.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (p: any) => {
        if (p.dataType === 'node') {
          const cat = categories[p.data.category] ?? ''
          return `<b>${p.data.name}</b><br/><span style="color:#94a3b8">${cat}</span><br/>Fanout: ${p.data.value}`
        }
        return `<b>${p.data.label ?? ''}</b><br/>Weight: ${p.data.weight ?? ''}`
      },
    },
    legend: {
      data: categories.map((name, i) => ({ name, icon: 'circle', textStyle: { color: '#94a3b8' } })),
      bottom: 8,
      textStyle: { color: '#94a3b8', fontSize: 11 },
    },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      force: {
        repulsion: 220,
        edgeLength: [60, 160],
        gravity: 0.06,
        layoutAnimation: true,
      },
      categories: categories.map((name, i) => ({
        name,
        itemStyle: { color: CAT_COLORS[i] ?? '#6b7280' },
      })),
      data: nodes.map(n => ({
        id: n.id,
        name: n.label,
        category: n.category,
        value: n.value,
        symbolSize: n.symbolSize,
        itemStyle: { color: CAT_COLORS[n.category] ?? '#6b7280' },
        label: { show: n.symbolSize >= 28, fontSize: 10, color: '#fff' },
      })),
      edges: edges.map(e => ({
        source: e.source,
        target: e.target,
        label: e.label,
        weight: e.weight,
        lineStyle: {
          width: Math.max(1, (e.weight ?? 1) * 0.8),
          color: '#475569',
          opacity: 0.75,
          curveness: 0.1,
        },
        label: {
          show: true,
          formatter: e.label,
          fontSize: 9,
          color: '#94a3b8',
          backgroundColor: 'transparent',
        },
      })),
      emphasis: { focus: 'adjacency', lineStyle: { opacity: 1 } },
      edgeLabel: { show: true, fontSize: 9, color: '#64748b' },
    }],
  }, true)

  c.resize()
}

function renderVectorSpace() {
  const el = vectorEl.value
  if (!el || !graphData.value) return
  const c = getOrCreateChart(el)
  const { categories, vectors } = graphData.value

  const seriesData = categories.map((name, i) => ({
    name,
    type: 'scatter' as const,
    data: vectors
      .filter(v => v.cluster === i)
      .map(v => ({
        value: [v.x, v.y],
        name: v.label,
        id: v.id,
        score: v.score,
        tags: v.tags ?? [],
      })),
    symbolSize: 10,
    itemStyle: { color: CAT_COLORS[i] ?? '#6b7280', opacity: 0.85 },
    label: {
      show: true,
      formatter: (p: any) => p.name,
      fontSize: 9,
      position: 'top',
      color: '#94a3b8',
    },
  }))

  c.setOption({
    backgroundColor: 'transparent',
    title: {
      text: 'Semantic Embedding Space',
      textStyle: { color: '#e2e8f0', fontSize: 14, fontWeight: 600 },
      left: 16,
      top: 10,
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (p: any) => {
        const tags = (p.data?.tags ?? []).join(', ')
        return `<b>${p.data?.name ?? p.name}</b>`
          + (tags ? `<br/><span style="color:#94a3b8;font-size:11px">${tags}</span>` : '')
          + `<br/>Score: ${(p.data?.score ?? 0).toFixed(3)}`
      },
    },
    legend: {
      data: categories.map(name => ({ name, icon: 'circle' })),
      bottom: 8,
      textStyle: { color: '#94a3b8', fontSize: 11 },
    },
    grid: { top: 50, bottom: 60, left: 50, right: 30 },
    xAxis: {
      name: 'Dim 1',
      nameTextStyle: { color: '#64748b', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLabel: { color: '#64748b', fontSize: 10 },
    },
    yAxis: {
      name: 'Dim 2',
      nameTextStyle: { color: '#64748b', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLabel: { color: '#64748b', fontSize: 10 },
    },
    series: seriesData,
  }, true)

  c.resize()
}

function attachResizeObserver(el: HTMLElement | null, chart: () => void, obs: ResizeObserver | null): ResizeObserver | null {
  if (obs) obs.disconnect()
  if (!el) return null
  const ro = new ResizeObserver(() => {
    const instance = echarts.getInstanceByDom(el)
    if (instance) instance.resize()
  })
  ro.observe(el)
  return ro
}

watch(graphData, () => {
  nextTick(() => {
    if (activeTab.value === 'graph') renderForceGraph()
    if (activeTab.value === 'vector') renderVectorSpace()
  })
})

watch(graphEl, el => {
  graphResizeObs = attachResizeObserver(el, renderForceGraph, graphResizeObs)
})

watch(vectorEl, el => {
  vectorResizeObs = attachResizeObserver(el, renderVectorSpace, vectorResizeObs)
})

onMounted(() => {
  fetchGraph()
})

onUnmounted(() => {
  graphResizeObs?.disconnect()
  vectorResizeObs?.disconnect()
  chartInstances.forEach(c => c.dispose())
  chartInstances = []
})
</script>

<style scoped>
/* ===== Shell layout ===== */
.eda-shell {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: #0f172a;
  color: #e2e8f0;
  font-family: inherit;
}

/* ===== Sidebar ===== */
.eda-sidebar {
  width: 280px;
  flex-shrink: 0;
  background: #1e293b;
  border-right: 1px solid #334155;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid #334155;
}

.chip-icon {
  width: 20px;
  height: 20px;
  color: #6366f1;
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 700;
  color: #e2e8f0;
  letter-spacing: 0.01em;
}

.section-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  padding: 10px 14px 4px;
}

/* Template radio cards */
.template-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px 12px 8px;
}

.radio-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  user-select: none;
}

.radio-card:hover {
  border-color: #6366f1;
}

.radio-card.active {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
}

.radio-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #475569;
  flex-shrink: 0;
  position: relative;
  transition: border-color 0.15s;
}

.radio-dot.checked {
  border-color: #6366f1;
  background: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
}

.radio-label {
  font-size: 13px;
  font-weight: 500;
  color: #e2e8f0;
}

/* Legend */
.legend-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 4px 14px 8px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Stats */
.stats-block {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 4px 14px 8px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.stat-label { color: #64748b; }
.stat-val { font-weight: 600; color: #e2e8f0; }

/* Load button */
.load-btn {
  width: 100%;
  padding: 9px 14px;
  background: #6366f1;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.load-btn:hover:not(:disabled) { background: #4f46e5; }
.load-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.store-msg {
  margin-top: 7px;
  font-size: 11px;
  padding: 5px 8px;
  border-radius: 5px;
}

.store-msg.ok {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.store-msg.err {
  background: rgba(248, 113, 113, 0.12);
  color: #f87171;
  border: 1px solid rgba(248, 113, 113, 0.3);
}

/* ===== Main panel ===== */
.eda-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #0f172a;
  position: relative;
}

/* ===== Tab bar ===== */
.tab-bar {
  display: flex;
  border-bottom: 1px solid #334155;
  padding: 0 16px;
  flex-shrink: 0;
  background: #1e293b;
}

.tab-btn {
  padding: 11px 18px;
  font-size: 13px;
  font-weight: 500;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #64748b;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.tab-btn:hover { color: #e2e8f0; }

.tab-btn.active {
  color: #6366f1;
  border-bottom-color: #6366f1;
}

/* ===== Tab content ===== */
.tab-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: opacity 0.2s;
}

.chart-fill {
  flex: 1;
  min-height: 0;
  width: 100%;
}

/* ===== Loading/error overlay ===== */
.overlay {
  position: absolute;
  inset: 40px 0 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(15, 23, 42, 0.75);
  z-index: 10;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #334155;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ===== Timing table ===== */
.timing-content {
  overflow: auto;
  padding: 16px;
}

.timing-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: #e2e8f0;
}

.timing-table thead tr {
  background: #1e293b;
  border-bottom: 1px solid #334155;
}

.timing-table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #64748b;
  font-weight: 600;
  white-space: nowrap;
}

.timing-table td {
  padding: 9px 12px;
  border-bottom: 1px solid #1e293b;
}

.timing-table tbody tr {
  background: #0f172a;
  transition: background 0.1s;
}

.timing-table tbody tr:hover {
  background: #1e293b;
}

.timing-table tbody tr.slack-neg {
  background: rgba(248, 113, 113, 0.07);
}

.timing-table tbody tr.slack-neg:hover {
  background: rgba(248, 113, 113, 0.13);
}

.mono {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 11px;
  color: #94a3b8;
}

.num {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.neg-val {
  color: #f87171;
  font-weight: 600;
}

.cat-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}
</style>

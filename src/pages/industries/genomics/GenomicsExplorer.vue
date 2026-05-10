<template>
  <div class="genomics-explorer">
    <!-- Left Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="dna-icon">🧬</span>
        <h2 class="sidebar-title">Genomics Pathway Explorer</h2>
      </div>

      <!-- Template Selector -->
      <div class="section">
        <div class="section-label">Pathway Template</div>
        <div class="template-cards">
          <label
            v-for="tpl in TEMPLATES"
            :key="tpl.value"
            class="template-card"
            :class="{ active: selectedTemplate === tpl.value }"
          >
            <input
              type="radio"
              :value="tpl.value"
              v-model="selectedTemplate"
              class="sr-only"
            />
            <div class="template-card-title">{{ tpl.name }}</div>
            <div class="template-card-sub">{{ tpl.description }}</div>
          </label>
        </div>
      </div>

      <!-- Category Legend -->
      <div class="section">
        <div class="section-label">Categories</div>
        <div class="legend-list">
          <div
            v-for="cat in currentCategories"
            :key="cat.name"
            class="legend-item"
          >
            <span class="legend-dot" :style="{ background: cat.color }"></span>
            <span class="legend-name">{{ cat.name }}</span>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="section">
        <div class="section-label">Statistics</div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ graphData?.nodes.length ?? 0 }}</div>
            <div class="stat-label">Nodes</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ graphData?.edges.length ?? 0 }}</div>
            <div class="stat-label">Edges</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ feedbackLoopCount }}</div>
            <div class="stat-label">Feedback Loops</div>
          </div>
        </div>
      </div>

      <!-- Load into Store -->
      <div class="section">
        <button class="load-btn" @click="loadIntoStore" :disabled="loadingStore">
          <span v-if="loadingStore">Loading...</span>
          <span v-else>Load into Store</span>
        </button>
        <div v-if="storeMessage" class="store-message" :class="storeMessageType">
          {{ storeMessage }}
        </div>
      </div>
    </aside>

    <!-- Right Panel -->
    <main class="main-panel">
      <!-- Tabs -->
      <div class="tabs-bar">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          class="tab-btn"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
        <router-link to="/projects?industry=genomics" class="projects-badge">Open in Projects →</router-link>
      </div>

      <!-- Tab Content -->
      <div class="tab-content">
        <!-- Pathway Graph -->
        <div v-show="activeTab === 'graph'" class="chart-container">
          <div v-if="loading" class="loading-overlay">
            <div class="spinner"></div>
            <span>Loading pathway data...</span>
          </div>
          <div ref="graphChartEl" class="echart-el"></div>
        </div>

        <!-- Embedding Space -->
        <div v-show="activeTab === 'embedding'" class="chart-container">
          <div ref="scatterChartEl" class="echart-el"></div>
        </div>

        <!-- Edge Analysis -->
        <div v-show="activeTab === 'edges'" class="edges-panel">
          <div class="edge-filter-bar">
            <input
              v-model="edgeFilter"
              type="text"
              placeholder="Filter by relationship type..."
              class="edge-filter-input"
            />
            <span class="edge-count">{{ filteredEdges.length }} edges</span>
          </div>
          <div class="edge-table-wrapper">
            <table class="edge-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Relationship</th>
                  <th>Target</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="edge in filteredEdges"
                  :key="`${edge.source}-${edge.target}-${edge.label}`"
                >
                  <td class="edge-node">{{ edge.source }}</td>
                  <td>
                    <span class="rel-badge" :class="relClass(edge.label)">
                      {{ edge.label }}
                    </span>
                  </td>
                  <td class="edge-node">{{ edge.target }}</td>
                  <td class="edge-weight">{{ weightDots(edge.weight) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'

// ── Interfaces ────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string
  label: string
  category: number
  value: number
  symbolSize: number
}

interface GraphEdge {
  source: string
  target: string
  label: string
  weight: number
}

interface VectorPoint {
  id: string
  label: string
  x: number
  y: number
  cluster: number
  score: number
  tags: string[]
}

interface GraphData {
  dataset: string
  categories: string[]
  nodes: GraphNode[]
  edges: GraphEdge[]
  vectors: VectorPoint[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NODE_COLORS: string[] = [
  '#ef4444', // cat 0 — red   (Tumor Suppressor / Receptor)
  '#f97316', // cat 1 — orange (Oncogene / RAS-MAPK)
  '#eab308', // cat 2 — yellow (Kinase-Signaling / Serine Kinase)
  '#22c55e', // cat 3 — green  (Cell Cycle / Metabolic Output)
  '#a855f7', // cat 4 — purple (Apoptosis)
  '#3b82f6', // cat 5 — blue   (DNA Repair / Lipid Kinase)
  '#14b8a6', // cat 6 — teal   (extra)
  '#6b7280', // cat 7 — grey   (Second Messenger / extra)
]

const CLUSTER_COLORS: string[] = [
  '#6366f1', '#22c55e', '#f97316', '#ef4444',
  '#a855f7', '#14b8a6', '#eab308', '#3b82f6',
]

const P53_CATEGORIES = [
  { name: 'Tumor Suppressor', color: '#ef4444' },
  { name: 'Oncogene',         color: '#f97316' },
  { name: 'Kinase/Signaling', color: '#eab308' },
  { name: 'Cell Cycle',       color: '#22c55e' },
  { name: 'Apoptosis',        color: '#a855f7' },
  { name: 'DNA Repair',       color: '#3b82f6' },
]

const INSULIN_CATEGORIES = [
  { name: 'Receptor',         color: '#14b8a6' },
  { name: 'Lipid Kinase',     color: '#3b82f6' },
  { name: 'Serine Kinase',    color: '#22c55e' },
  { name: 'RAS/MAPK',         color: '#f97316' },
  { name: 'Metabolic Output', color: '#a855f7' },
  { name: 'Second Messenger', color: '#6b7280' },
]

const TEMPLATES = [
  { value: 'p53-network',       name: 'p53 Network',       description: 'Tumor suppressor' },
  { value: 'insulin-signaling', name: 'Insulin Signaling', description: 'Metabolic'        },
]

const TABS = [
  { id: 'graph',     label: 'Pathway Graph'   },
  { id: 'embedding', label: 'Embedding Space' },
  { id: 'edges',     label: 'Edge Analysis'   },
] as const

type TabId = typeof TABS[number]['id']

// ── State ─────────────────────────────────────────────────────────────────────

const selectedTemplate = ref<string>('p53-network')
const graphData        = ref<GraphData | null>(null)
const loading          = ref(false)
const activeTab        = ref<TabId>('graph')
const edgeFilter       = ref('')
const loadingStore     = ref(false)
const storeMessage     = ref('')
const storeMessageType = ref<'success' | 'error'>('success')

const graphChartEl   = ref<HTMLElement | null>(null)
const scatterChartEl = ref<HTMLElement | null>(null)

let graphChart:   echarts.ECharts | null = null
let scatterChart: echarts.ECharts | null = null
let graphResizeObserver:   ResizeObserver | null = null
let scatterResizeObserver: ResizeObserver | null = null

// ── Computed ──────────────────────────────────────────────────────────────────

const currentCategories = computed(() =>
  selectedTemplate.value === 'insulin-signaling' ? INSULIN_CATEGORIES : P53_CATEGORIES
)

const feedbackLoopCount = computed((): number => {
  if (!graphData.value) return 0
  const edges = graphData.value.edges
  const targetSet = new Set(edges.map(e => e.target))
  return edges.filter(e => targetSet.has(e.source)).length
})

const filteredEdges = computed((): GraphEdge[] => {
  if (!graphData.value) return []
  const q = edgeFilter.value.trim().toLowerCase()
  if (!q) return graphData.value.edges
  return graphData.value.edges.filter(e => e.label.toLowerCase().includes(q))
})

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchGraph(): Promise<void> {
  loading.value = true
  storeMessage.value = ''
  try {
    const res = await fetch(`/api/genomics/graph/${selectedTemplate.value}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    graphData.value = await res.json() as GraphData
  } catch (err) {
    console.error('Failed to fetch graph data:', err)
    graphData.value = null
  } finally {
    loading.value = false
  }
}

async function loadIntoStore(): Promise<void> {
  const name = selectedTemplate.value === 'p53-network' ? 'genomics-p53' : 'genomics-insulin'
  loadingStore.value = true
  storeMessage.value = ''
  try {
    const res = await fetch('/api/store/datasets/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    storeMessage.value = `"${name}" loaded successfully`
    storeMessageType.value = 'success'
  } catch {
    storeMessage.value = 'Failed to load dataset'
    storeMessageType.value = 'error'
  } finally {
    loadingStore.value = false
  }
}

// ── Chart builders ────────────────────────────────────────────────────────────

function buildGraphOption(data: GraphData): echarts.EChartsOption {
  const cats = data.categories.map((name, idx) => ({
    name,
    itemStyle: { color: NODE_COLORS[idx] ?? '#6b7280' },
  }))

  const ecNodes = data.nodes.map(n => ({
    id: n.id,
    name: n.label,
    category: n.category,
    symbolSize: n.symbolSize ?? 20,
    value: n.value,
    label: { show: true, color: '#e2e8f0', fontSize: 11 },
  }))

  const ecLinks = data.edges.map(e => ({
    source: e.source,
    target: e.target,
    label: {
      show: true,
      formatter: e.label,
      color: '#94a3b8',
      fontSize: 10,
    },
    lineStyle: {
      color: '#475569',
      width: 1 + (e.weight ?? 1) * 0.3,
    },
  }))

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const cat = data.categories[params.data.category] ?? ''
          return `<b>${params.data.name}</b><br/>Category: ${cat}<br/>Value: ${params.data.value}`
        }
        return `${params.data.source} → ${params.data.target}<br/>${params.data.label?.formatter ?? ''}`
      },
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0' },
    },
    legend: {
      data: cats.map(c => c.name),
      top: 10,
      right: 10,
      textStyle: { color: '#94a3b8', fontSize: 11 },
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        categories: cats,
        data: ecNodes,
        links: ecLinks,
        symbol: 'circle',
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: [0, 8],
        force: {
          repulsion: 300,
          gravity: 0.1,
          edgeLength: [80, 200],
        },
        lineStyle: { opacity: 0.7, curveness: 0.1 },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 2 },
        },
      },
    ],
  }
}

function buildScatterOption(data: GraphData): echarts.EChartsOption {
  const clusterMap = new Map<number, { name: string; data: any[] }>()

  for (const v of data.vectors) {
    if (!clusterMap.has(v.cluster)) {
      clusterMap.set(v.cluster, { name: `Cluster ${v.cluster}`, data: [] })
    }
    clusterMap.get(v.cluster)!.data.push({
      value: [v.x, v.y],
      name: v.label,
      tags: v.tags ?? [],
    })
  }

  const series: echarts.SeriesOption[] = Array.from(clusterMap.entries()).map(([idx, cl]) => ({
    name: cl.name,
    type: 'scatter' as const,
    data: cl.data,
    symbolSize: 10,
    itemStyle: { color: CLUSTER_COLORS[idx % CLUSTER_COLORS.length] },
  }))

  return {
    backgroundColor: 'transparent',
    title: {
      text: 'Functional Embedding Space',
      left: 'center',
      top: 10,
      textStyle: { color: '#e2e8f0', fontSize: 15 },
    },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const d = params.data
        const tagsStr = Array.isArray(d.tags) && d.tags.length ? d.tags.join(', ') : ''
        return `<b>${d.name}</b>${tagsStr ? '<br/>Tags: ' + tagsStr : ''}`
      },
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0' },
    },
    legend: {
      top: 40,
      right: 10,
      textStyle: { color: '#94a3b8', fontSize: 11 },
    },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: '#334155' } },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#1e293b' } },
    },
    series,
  }
}

// ── Chart init / resize ───────────────────────────────────────────────────────

function initGraphChart(): void {
  if (!graphChartEl.value) return
  if (graphChart) { graphChart.dispose(); graphChart = null }
  graphChart = echarts.init(graphChartEl.value, 'dark')
  graphResizeObserver = new ResizeObserver(() => graphChart?.resize())
  graphResizeObserver.observe(graphChartEl.value)
}

function initScatterChart(): void {
  if (!scatterChartEl.value) return
  if (scatterChart) { scatterChart.dispose(); scatterChart = null }
  scatterChart = echarts.init(scatterChartEl.value, 'dark')
  scatterResizeObserver = new ResizeObserver(() => scatterChart?.resize())
  scatterResizeObserver.observe(scatterChartEl.value)
}

function renderCharts(): void {
  if (!graphData.value) return
  if (graphChart) {
    graphChart.setOption(buildGraphOption(graphData.value), true)
  }
  if (scatterChart && graphData.value.vectors?.length) {
    scatterChart.setOption(buildScatterOption(graphData.value), true)
  }
}

// ── Edge Analysis helpers ─────────────────────────────────────────────────────

function relClass(label: string): string {
  const l = label.toUpperCase()
  if (l.includes('INHIBIT'))      return 'rel-inhibit'
  if (l.includes('ACTIVAT'))      return 'rel-activate'
  if (l.includes('PHOSPHORYLAT')) return 'rel-phospho'
  if (l.includes('DEGRAD'))       return 'rel-degrade'
  return 'rel-other'
}

function weightDots(weight: number): string {
  const w = Math.max(1, Math.min(5, Math.round(weight)))
  return '●'.repeat(w) + '○'.repeat(5 - w)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  await nextTick()
  initGraphChart()
  initScatterChart()
  await fetchGraph()
})

onUnmounted(() => {
  graphResizeObserver?.disconnect()
  scatterResizeObserver?.disconnect()
  graphChart?.dispose()
  scatterChart?.dispose()
})

watch(selectedTemplate, () => fetchGraph())

watch(graphData, async () => {
  await nextTick()
  renderCharts()
})

watch(activeTab, async () => {
  await nextTick()
  graphChart?.resize()
  scatterChart?.resize()
})
</script>

<style scoped>
/* ── Layout ───────────────────────────────────────────────────────────────── */
.genomics-explorer {
  display: flex;
  height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
  font-family: 'Inter', sans-serif;
  overflow: hidden;
}

/* ── Sidebar ──────────────────────────────────────────────────────────────── */
.sidebar {
  width: 280px;
  min-width: 280px;
  background: #1e293b;
  border-right: 1px solid #334155;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding-bottom: 16px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px 16px;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}

.dna-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
  line-height: 1.3;
  margin: 0;
}

.section {
  padding: 14px 16px;
  border-bottom: 1px solid #263148;
}

.section:last-child {
  border-bottom: none;
}

.section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
  margin-bottom: 10px;
}

/* ── Template cards ───────────────────────────────────────────────────────── */
.template-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.template-card {
  display: block;
  padding: 10px 12px;
  border: 1px solid #334155;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  background: #0f172a;
}

.template-card:hover {
  border-color: #6366f1;
}

.template-card.active {
  border-color: #6366f1;
  background: rgba(99, 102, 241, 0.12);
}

.template-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}

.template-card-sub {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* ── Legend ───────────────────────────────────────────────────────────────── */
.legend-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-name {
  font-size: 12px;
  color: #cbd5e1;
}

/* ── Stats ────────────────────────────────────────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stat-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 8px;
  text-align: center;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #6366f1;
  line-height: 1;
}

.stat-label {
  font-size: 10px;
  color: #64748b;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Load button ──────────────────────────────────────────────────────────── */
.load-btn {
  width: 100%;
  padding: 10px;
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.load-btn:hover:not(:disabled) {
  background: #4f46e5;
}

.load-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.store-message {
  margin-top: 8px;
  font-size: 12px;
  border-radius: 4px;
  padding: 4px 8px;
}

.store-message.success {
  color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

.store-message.error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

/* ── Main panel ───────────────────────────────────────────────────────────── */
.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
.tabs-bar {
  display: flex;
  gap: 4px;
  padding: 12px 16px 0;
  border-bottom: 1px solid #334155;
  background: #1e293b;
  flex-shrink: 0;
}

.tab-btn {
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}

.tab-btn:hover {
  color: #cbd5e1;
}

.tab-btn.active {
  color: #6366f1;
  border-bottom-color: #6366f1;
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

/* ── Tab content ──────────────────────────────────────────────────────────── */
.tab-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  min-height: 0;
}

.chart-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.echart-el {
  width: 100%;
  height: 100%;
}

/* ── Loading overlay ──────────────────────────────────────────────────────── */
.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(15, 23, 42, 0.75);
  z-index: 10;
  color: #94a3b8;
  font-size: 14px;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid #334155;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Edge Analysis ────────────────────────────────────────────────────────── */
.edges-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.edge-filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}

.edge-filter-input {
  flex: 1;
  padding: 8px 12px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  color: #e2e8f0;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.edge-filter-input::placeholder {
  color: #475569;
}

.edge-filter-input:focus {
  border-color: #6366f1;
}

.edge-count {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
}

.edge-table-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

.edge-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.edge-table th {
  text-align: left;
  padding: 10px 12px;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid #334155;
  position: sticky;
  top: 0;
  background: #0f172a;
  z-index: 1;
}

.edge-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #1e293b;
  color: #cbd5e1;
  vertical-align: middle;
}

.edge-table tr:hover td {
  background: rgba(99, 102, 241, 0.05);
}

.edge-node {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: #a5b4fc;
}

.rel-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.rel-inhibit {
  background: rgba(239, 68, 68, 0.18);
  color: #ef4444;
}

.rel-activate {
  background: rgba(34, 197, 94, 0.18);
  color: #22c55e;
}

.rel-phospho {
  background: rgba(234, 179, 8, 0.18);
  color: #eab308;
}

.rel-degrade {
  background: rgba(249, 115, 22, 0.18);
  color: #f97316;
}

.rel-other {
  background: rgba(100, 116, 139, 0.18);
  color: #94a3b8;
}

.edge-weight {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: #6366f1;
  letter-spacing: 0.05em;
}

/* ── Scrollbar ────────────────────────────────────────────────────────────── */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #0f172a;
}

::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>

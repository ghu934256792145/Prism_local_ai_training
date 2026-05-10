<template>
  <div class="erp-graph-shell">

    <!-- ── Sidebar ──────────────────────────────────────────────────────────── -->
    <aside class="erp-graph-sidebar">
      <div class="panel-header">
        <span class="panel-title">ERP × Industry Graph</span>
      </div>

      <!-- Load into store -->
      <div class="sidebar-section">
        <button
          class="btn btn-primary"
          style="width:100%;justify-content:center"
          :disabled="loadingStore"
          @click="loadIntoStore"
        >
          <div v-if="loadingStore" class="spinner-sm"></div>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
          </svg>
          {{ loadingStore ? 'Loading…' : 'Load into Store' }}
        </button>
        <div v-if="storeMsg" class="store-msg" :class="storeMsgOk ? 'ok' : 'err'">{{ storeMsg }}</div>
      </div>

      <!-- Category filters -->
      <div class="panel-header" style="margin-top:4px">
        <span class="panel-title">Show Categories</span>
      </div>
      <div class="sidebar-section">
        <label v-for="cat in CATEGORY_DEFS" :key="cat.id" class="filter-row">
          <input
            type="checkbox"
            :checked="visibleCats.has(cat.id)"
            @change="toggleCat(cat.id)"
            class="filter-check"
          />
          <span class="filter-dot" :style="{ background: cat.color }"></span>
          <span class="filter-label">{{ cat.label }}</span>
        </label>
      </div>

      <!-- Stats -->
      <div class="panel-header" style="margin-top:4px">
        <span class="panel-title">Graph Stats</span>
      </div>
      <div class="sidebar-section">
        <div class="stat-row-sm"><span class="stat-l">Nodes</span><span class="stat-v">{{ filteredNodes.length }}</span></div>
        <div class="stat-row-sm"><span class="stat-l">Edges</span><span class="stat-v">{{ filteredEdges.length }}</span></div>
        <div class="stat-row-sm"><span class="stat-l">Domain Bridges</span><span class="stat-v">{{ domainBridges }}</span></div>
        <div class="stat-row-sm"><span class="stat-l">Dataset</span><span class="stat-v" style="color:#6366f1">{{ graphData?.dataset ?? '—' }}</span></div>
      </div>

      <!-- Legend -->
      <div class="panel-header" style="margin-top:4px">
        <span class="panel-title">Legend</span>
      </div>
      <div class="sidebar-section">
        <div v-for="cat in CATEGORY_DEFS" :key="cat.id" class="legend-row">
          <span class="legend-dot" :style="{ background: cat.color }"></span>
          <span class="legend-label">{{ cat.label }}</span>
          <span class="legend-count">{{ nodesByCategory(cat.id).length }}</span>
        </div>
      </div>
    </aside>

    <!-- ── Main panel ────────────────────────────────────────────────────────── -->
    <div class="erp-graph-main">
      <!-- Loading / error -->
      <div v-if="loadingGraph" class="graph-loading">
        <div class="spinner"></div>
        <span>Loading ERP graph…</span>
      </div>
      <div v-else-if="graphError" class="graph-error">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>{{ graphError }}</span>
        <button class="btn" @click="fetchGraph">Retry</button>
      </div>

      <!-- Chart -->
      <div ref="chartEl" class="chart-fill" v-show="!loadingGraph && !graphError"></div>

      <!-- Node click tooltip popup -->
      <div
        v-if="clickedNode"
        class="node-popup"
        :style="{ left: popupX + 'px', top: popupY + 'px' }"
      >
        <div class="popup-header">
          <span class="popup-title">{{ clickedNode.name }}</span>
          <button class="popup-close" @click="clickedNode = null">✕</button>
        </div>
        <div class="popup-body">
          <div class="popup-category" :style="{ color: CATEGORY_DEFS[clickedNode.category ?? 0]?.color }">
            {{ CATEGORY_DEFS[clickedNode.category ?? 0]?.label }}
          </div>
          <div v-if="clickedNode.category === 2 && domainRoute(clickedNode.id)" class="popup-nav">
            <button
              class="btn btn-primary"
              style="font-size:12px;padding:5px 12px"
              @click="navigateToDomain(clickedNode.id)"
            >
              Navigate to Industry →
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as echarts from 'echarts'

const router = useRouter()

// ── Types ──────────────────────────────────────────────────────────────────────

interface GraphData {
  dataset: string
  categories: string[]
  nodes: any[]
  edges: any[]
  vectors: any[]
}

// ── Category definitions ───────────────────────────────────────────────────────

const CATEGORY_DEFS = [
  { id: 0, label: 'ERP Module',      color: '#6366f1' },
  { id: 1, label: 'Database/Gateway', color: '#14b8a6' },
  { id: 2, label: 'Industry Domain', color: '#f59e0b' },
  { id: 3, label: 'External',        color: '#64748b' },
]

// ── Domain → route map ─────────────────────────────────────────────────────────

const DOMAIN_ROUTES: Record<string, string> = {
  'domain-pharma':    '/drug-discovery',
  'domain-genomics':  '/genomics',
  'domain-eda':       '/semiconductor',
  'domain-mfg':       '/mfg',
  'domain-pipeline':  '/pipeline',
  'domain-scaffold':  '/scaffold',
  'domain-supply':    '/graph?dataset=supply-chain',
  'domain-threat':    '/threat-intel',
}

function domainRoute(id: string): string | null {
  return DOMAIN_ROUTES[id] ?? null
}

function navigateToDomain(id: string) {
  const route = DOMAIN_ROUTES[id]
  if (!route) return
  clickedNode.value = null
  if (route.includes('?')) {
    const [path, query] = route.split('?')
    const params = Object.fromEntries(new URLSearchParams(query))
    router.push({ path, query: params })
  } else {
    router.push(route)
  }
}

// ── Static fallback graph (used when API is unavailable) ──────────────────────

const STATIC_GRAPH: GraphData = {
  dataset: 'erp',
  categories: ['ERP Module', 'Database/Gateway', 'Industry Domain', 'External'],
  nodes: [
    // ERP Modules (cat 0)
    { id: 'erp-finance',       name: 'Finance',       category: 0, symbolSize: 36 },
    { id: 'erp-hr',            name: 'HR',             category: 0, symbolSize: 32 },
    { id: 'erp-mfg',           name: 'Manufacturing',  category: 0, symbolSize: 36 },
    { id: 'erp-procurement',   name: 'Procurement',    category: 0, symbolSize: 32 },
    { id: 'erp-sales',         name: 'Sales',          category: 0, symbolSize: 32 },
    { id: 'erp-logistics',     name: 'Logistics',      category: 0, symbolSize: 30 },
    { id: 'erp-inventory',     name: 'Inventory',      category: 0, symbolSize: 30 },
    { id: 'erp-crm',           name: 'CRM',            category: 0, symbolSize: 30 },
    { id: 'erp-reporting',     name: 'Reporting',      category: 0, symbolSize: 28 },
    // Database/Gateway (cat 1)
    { id: 'db-erp',            name: 'ERP Core DB',    category: 1, symbolSize: 28 },
    { id: 'gw-api',            name: 'API Gateway',    category: 1, symbolSize: 24 },
    { id: 'gw-etl',            name: 'ETL Pipeline',   category: 1, symbolSize: 24 },
    // Industry Domains (cat 2) — larger
    { id: 'domain-mfg',        name: 'MFG Domain',     category: 2, symbolSize: 48 },
    { id: 'domain-pharma',     name: 'Pharma Domain',  category: 2, symbolSize: 44 },
    { id: 'domain-genomics',   name: 'Genomics Domain',category: 2, symbolSize: 40 },
    { id: 'domain-eda',        name: 'EDA Domain',     category: 2, symbolSize: 40 },
    { id: 'domain-pipeline',   name: 'Pipeline Domain',category: 2, symbolSize: 40 },
    { id: 'domain-scaffold',   name: 'Scaffold Domain',category: 2, symbolSize: 38 },
    { id: 'domain-supply',     name: 'Supply Chain',   category: 2, symbolSize: 44 },
    { id: 'domain-threat',     name: 'Threat Intel',   category: 2, symbolSize: 40 },
    // External (cat 3)
    { id: 'ext-cloud',         name: 'Cloud ERP',      category: 3, symbolSize: 22 },
    { id: 'ext-bi',            name: 'BI Platform',    category: 3, symbolSize: 22 },
  ],
  edges: [
    // ERP modules → Core DB
    { source: 'erp-finance',     target: 'db-erp',         label: 'WRITES' },
    { source: 'erp-hr',          target: 'db-erp',         label: 'WRITES' },
    { source: 'erp-mfg',         target: 'db-erp',         label: 'WRITES' },
    { source: 'erp-procurement', target: 'db-erp',         label: 'WRITES' },
    { source: 'erp-sales',       target: 'db-erp',         label: 'WRITES' },
    { source: 'erp-inventory',   target: 'db-erp',         label: 'WRITES' },
    { source: 'erp-crm',         target: 'db-erp',         label: 'WRITES' },
    { source: 'erp-logistics',   target: 'db-erp',         label: 'WRITES' },
    { source: 'erp-reporting',   target: 'db-erp',         label: 'READS' },
    // DB → Gateway
    { source: 'db-erp',          target: 'gw-api',         label: 'EXPOSES' },
    { source: 'db-erp',          target: 'gw-etl',         label: 'FEEDS' },
    // ERP modules → Industry domains
    { source: 'erp-mfg',         target: 'domain-mfg',     label: 'DRIVES' },
    { source: 'erp-mfg',         target: 'domain-eda',     label: 'USES' },
    { source: 'erp-finance',     target: 'domain-supply',  label: 'COSTS' },
    { source: 'erp-procurement', target: 'domain-supply',  label: 'ORDERS' },
    { source: 'erp-procurement', target: 'domain-pipeline',label: 'SOURCES' },
    { source: 'erp-logistics',   target: 'domain-pipeline',label: 'ROUTES' },
    { source: 'erp-logistics',   target: 'domain-scaffold',label: 'PLANS' },
    { source: 'erp-sales',       target: 'domain-pharma',  label: 'SELLS' },
    { source: 'erp-hr',          target: 'domain-genomics',label: 'COMPLIES' },
    { source: 'erp-crm',         target: 'domain-threat',  label: 'MONITORS' },
    { source: 'erp-inventory',   target: 'domain-mfg',     label: 'STOCKS' },
    { source: 'erp-reporting',   target: 'domain-eda',     label: 'REPORTS' },
    // ETL → domains
    { source: 'gw-etl',          target: 'domain-supply',  label: 'SYNCS' },
    { source: 'gw-etl',          target: 'domain-genomics',label: 'SYNCS' },
    // External
    { source: 'gw-api',          target: 'ext-cloud',      label: 'SYNCS' },
    { source: 'erp-reporting',   target: 'ext-bi',         label: 'EXPORTS' },
  ],
  vectors: [],
}

// ── State ──────────────────────────────────────────────────────────────────────

const chartEl      = ref<HTMLElement | null>(null)
const loadingGraph = ref(false)
const graphError   = ref<string | null>(null)
const graphData    = ref<GraphData | null>(null)
const loadingStore = ref(false)
const storeMsg     = ref<string | null>(null)
const storeMsgOk   = ref(false)
const visibleCats  = ref(new Set([0, 1, 2, 3]))

const clickedNode  = ref<any>(null)
const popupX       = ref(0)
const popupY       = ref(0)

let chartInstance: echarts.ECharts | null = null

// ── Computed ───────────────────────────────────────────────────────────────────

const allNodes = computed(() => graphData.value?.nodes ?? [])
const allEdges = computed(() => graphData.value?.edges ?? [])

const filteredNodes = computed(() =>
  allNodes.value.filter(n => visibleCats.value.has(n.category ?? 0))
)

const filteredEdges = computed(() => {
  const nodeIds = new Set(filteredNodes.value.map((n: any) => n.id))
  return allEdges.value.filter((e: any) => nodeIds.has(e.source) && nodeIds.has(e.target))
})

const domainBridges = computed(() =>
  filteredEdges.value.filter((e: any) => {
    const src = allNodes.value.find((n: any) => n.id === e.source)
    const tgt = allNodes.value.find((n: any) => n.id === e.target)
    return (src?.category === 0 && tgt?.category === 2) || (src?.category === 2 && tgt?.category === 0)
  }).length
)

function nodesByCategory(catId: number) {
  return allNodes.value.filter((n: any) => n.category === catId)
}

// ── Chart ──────────────────────────────────────────────────────────────────────

function buildOption() {
  const catColors = CATEGORY_DEFS.map(c => c.color)

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        if (p.dataType === 'node') {
          const cat = CATEGORY_DEFS[p.data.category ?? 0]
          return `<b>${p.data.name}</b><br/><span style="color:${cat?.color}">${cat?.label}</span>`
        }
        return `<b>${p.data.label ?? ''}</b>`
      },
    },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      force: {
        repulsion: 200,
        edgeLength: [80, 180],
        gravity: 0.05,
        layoutAnimation: true,
      },
      categories: CATEGORY_DEFS.map(c => ({ name: c.label, itemStyle: { color: c.color } })),
      data: filteredNodes.value.map((n: any) => ({
        id: n.id,
        name: n.name ?? n.label ?? n.id,
        category: n.category ?? 0,
        symbolSize: n.category === 2
          ? (n.symbolSize ?? 44)
          : (n.symbolSize ?? 28),
        itemStyle: { color: catColors[n.category ?? 0] },
        label: {
          show: true,
          fontSize: n.category === 2 ? 11 : 9,
          color: '#fff',
          position: n.category === 2 ? 'bottom' : 'inside',
        },
      })),
      edges: filteredEdges.value.map((e: any) => ({
        source: e.source,
        target: e.target,
        label: e.label ?? '',
        lineStyle: {
          color: '#334155',
          width: 1.5,
          opacity: 0.7,
          curveness: 0.1,
        },
        label: {
          show: true,
          formatter: e.label ?? '',
          fontSize: 9,
          color: '#64748b',
          backgroundColor: 'transparent',
        },
        symbol: ['none', 'arrow'],
        symbolSize: [0, 6],
      })),
      emphasis: { focus: 'adjacency', blurScope: 'global' },
    }],
  }
}

function initChart() {
  if (!chartEl.value) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartEl.value, 'dark', { renderer: 'canvas' })
  }
  chartInstance.setOption(buildOption(), { notMerge: true })

  chartInstance.off('click')
  chartInstance.on('click', (params: any) => {
    if (params.dataType !== 'node') return
    const node = params.data
    const rect = chartEl.value!.getBoundingClientRect()
    const ex = params.event?.event as MouseEvent | undefined
    if (ex) {
      popupX.value = Math.min(ex.clientX - rect.left, rect.width - 200)
      popupY.value = Math.min(ex.clientY - rect.top, rect.height - 120)
    }
    clickedNode.value = node
  })
}

// ── Fetch ──────────────────────────────────────────────────────────────────────

async function fetchGraph() {
  loadingGraph.value = true
  graphError.value = null
  try {
    const r = await fetch('/api/erp/graph')
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const d = await r.json()
    graphData.value = d
  } catch {
    // Use static fallback — don't show error
    graphData.value = STATIC_GRAPH
  } finally {
    loadingGraph.value = false
  }
  nextTick(() => initChart())
}

async function loadIntoStore() {
  loadingStore.value = true
  storeMsg.value = null
  try {
    const r = await fetch('/api/store/datasets/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'erp' }),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    storeMsg.value = 'ERP dataset loaded into live store.'
    storeMsgOk.value = true
  } catch (e: any) {
    storeMsg.value = `Load failed: ${e.message}`
    storeMsgOk.value = false
  } finally {
    loadingStore.value = false
    setTimeout(() => { storeMsg.value = null }, 4000)
  }
}

function toggleCat(id: number) {
  const s = new Set(visibleCats.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  visibleCats.value = s
}

// ── Resize ─────────────────────────────────────────────────────────────────────

function onResize() { chartInstance?.resize() }

// ── Watchers ───────────────────────────────────────────────────────────────────

watch(visibleCats, () => {
  if (chartInstance && graphData.value) initChart()
}, { deep: true })

// ── Lifecycle ──────────────────────────────────────────────────────────────────

onMounted(() => {
  fetchGraph()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  chartInstance?.dispose()
  chartInstance = null
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.erp-graph-shell {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ── Sidebar ───────────────────────────────────────────────────────────────── */

.erp-graph-sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--bg-panel);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.sidebar-section {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.store-msg {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  text-align: center;
}
.store-msg.ok  { background: rgba(34,197,94,0.12);  color: #22c55e; }
.store-msg.err { background: rgba(242,73,92,0.12);  color: var(--accent-red); }

.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 2px 0;
}

.filter-check {
  accent-color: #6366f1;
  cursor: pointer;
}

.filter-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.filter-label {
  font-size: 12px;
}

.stat-row-sm {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.stat-l { color: var(--text-muted); }
.stat-v { font-weight: 600; color: var(--text-primary); }

.legend-row {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-label { flex: 1; color: var(--text-secondary); }
.legend-count {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-secondary);
  padding: 0px 6px;
  border-radius: 8px;
}

/* ── Main panel ────────────────────────────────────────────────────────────── */

.erp-graph-main {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}

.chart-fill {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.graph-loading,
.graph-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex: 1;
  color: var(--text-muted);
  font-size: 13px;
}

.graph-error { color: var(--accent-red); }

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

.spinner-sm {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Node popup ────────────────────────────────────────────────────────────── */

.node-popup {
  position: absolute;
  z-index: 200;
  background: var(--bg-panel);
  border: 1px solid var(--border-hover);
  border-radius: 8px;
  min-width: 180px;
  max-width: 240px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  overflow: hidden;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
}

.popup-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.popup-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
  line-height: 1;
}
.popup-close:hover { color: var(--text-primary); }

.popup-body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.popup-category {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.popup-nav {
  display: flex;
}
</style>

<template>
  <div class="ti-layout">
    <!-- ── Left sidebar ──────────────────────────────────────────── -->
    <aside class="ti-sidebar">
      <!-- Header -->
      <div class="panel">
        <div class="panel-header" style="gap:8px">
          <span class="ti-shield-icon">🛡</span>
          <span class="panel-title">Threat Intelligence Graph</span>
        </div>
      </div>

      <!-- Template selector -->
      <div class="panel">
        <div class="panel-header"><span class="panel-title">Template</span></div>
        <div style="padding:10px;display:flex;flex-direction:column;gap:8px">
          <label
            v-for="tpl in TEMPLATES"
            :key="tpl.id"
            class="radio-card"
            :class="{ 'radio-card-active': selectedTemplate === tpl.id }"
          >
            <input
              type="radio"
              :value="tpl.id"
              v-model="selectedTemplate"
              style="display:none"
            />
            <div style="display:flex;align-items:flex-start;gap:8px">
              <span class="radio-dot" :class="selectedTemplate === tpl.id ? 'radio-dot-active' : ''"></span>
              <div>
                <div class="radio-label">{{ tpl.label }}</div>
                <div class="radio-desc">{{ tpl.desc }}</div>
              </div>
            </div>
          </label>
        </div>
      </div>

      <!-- Category legend -->
      <div class="panel">
        <div class="panel-header"><span class="panel-title">Category Legend</span></div>
        <div style="padding:10px;display:flex;flex-direction:column;gap:5px">
          <div
            v-for="cat in activeCategories"
            :key="cat.name"
            class="legend-row"
          >
            <span class="legend-dot" :style="{ background: cat.color }"></span>
            <span class="legend-name">{{ cat.label }}</span>
            <span
              class="badge"
              :style="{ background: cat.color + '22', color: cat.color, border: '1px solid ' + cat.color + '44' }"
            >
              {{ nodeCountByCategory(cat.index) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Campaign Complexity Score -->
      <div class="panel">
        <div class="panel-header"><span class="panel-title">Campaign Complexity Score</span></div>
        <div style="padding:10px">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:12px;color:var(--text-secondary)">Techniques × 3.7</span>
            <span style="font-size:13px;font-weight:600;color:#ef4444">{{ complexityScore }}</span>
          </div>
          <div class="score-track">
            <div
              class="score-bar"
              :style="{ width: complexityScore + '%' }"
            ></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:var(--text-muted)">
            <span>0</span><span>50</span><span>100</span>
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="panel">
        <div class="panel-header"><span class="panel-title">Statistics</span></div>
        <div style="padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div v-for="stat in stats" :key="stat.label" class="stat-cell">
            <div class="stat-val" :style="{ color: stat.color }">{{ stat.val }}</div>
            <div class="stat-label">{{ stat.label }}</div>
          </div>
        </div>
      </div>

      <!-- Load into Store -->
      <div class="panel">
        <div style="padding:10px">
          <button
            class="btn btn-primary"
            style="width:100%;justify-content:center;gap:6px"
            :disabled="loadingStore"
            @click="loadIntoStore"
          >
            <span v-if="loadingStore" class="spinner"></span>
            <span v-else>⬆</span>
            {{ loadingStore ? 'Loading…' : 'Load into Store' }}
          </button>
          <div v-if="storeMsg" class="store-msg" :class="storeMsgOk ? 'store-msg-ok' : 'store-msg-err'">
            {{ storeMsg }}
          </div>
        </div>
      </div>
    </aside>

    <!-- ── Main content ──────────────────────────────────────────── -->
    <div class="ti-main">
      <div class="panel" style="height:100%;display:flex;flex-direction:column">
        <!-- Tabs -->
        <div class="panel-header" style="gap:0;padding:0 12px">
          <div class="tab-bar">
            <button
              v-for="tab in TABS"
              :key="tab.id"
              class="tab-btn"
              :class="{ 'tab-btn-active': activeTab === tab.id }"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>
          <div style="margin-left:auto;padding:8px 0">
            <span v-if="loading" class="spinner" style="display:inline-block"></span>
            <span v-if="!loading && graphData" class="badge badge-green" style="font-size:10px">
              {{ graphData.nodes.length }} nodes · {{ graphData.edges.length }} edges
            </span>
          </div>
        </div>

        <!-- Campaign Graph tab -->
        <div v-show="activeTab === 'graph'" style="flex:1;min-height:0;position:relative">
          <div v-if="loading" class="loading-overlay">
            <span class="spinner spinner-lg"></span>
            <span style="margin-top:10px;color:var(--text-secondary);font-size:13px">Loading graph…</span>
          </div>
          <div ref="chartEl" style="width:100%;height:100%"></div>
        </div>

        <!-- Attack Chain tab -->
        <div v-show="activeTab === 'chain'" class="chain-tab">
          <div v-if="loading" class="loading-overlay">
            <span class="spinner spinner-lg"></span>
          </div>
          <template v-else-if="graphData">
            <div class="chain-scroll">
              <div class="chain-columns">
                <div
                  v-for="(col, ci) in chainColumns"
                  :key="col.catIndex"
                  class="chain-col"
                >
                  <!-- column header -->
                  <div
                    class="chain-col-header"
                    :style="{ background: col.color + '22', borderColor: col.color, color: col.color }"
                  >
                    {{ col.catName }}
                  </div>
                  <!-- node badges -->
                  <div class="chain-nodes">
                    <div
                      v-for="node in col.nodes"
                      :key="node.id"
                      class="chain-badge"
                      :style="{ background: col.color + '18', borderColor: col.color + '55', color: '#e2e8f0' }"
                      :title="node.id"
                    >
                      {{ node.label }}
                    </div>
                  </div>
                  <!-- arrow connector (not on last column) -->
                  <div v-if="ci < chainColumns.length - 1" class="chain-arrow">→</div>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="empty-state">No data loaded</div>
        </div>

        <!-- IOC Matrix tab -->
        <div v-show="activeTab === 'ioc'" class="ioc-tab">
          <div v-if="loading" class="loading-overlay">
            <span class="spinner spinner-lg"></span>
          </div>
          <template v-else-if="graphData">
            <div class="ioc-toolbar">
              <input
                v-model="iocFilter"
                class="input-ctrl"
                placeholder="Filter by name…"
                style="width:220px"
              />
              <button class="btn" style="gap:6px" @click="exportCSV">
                <span>⬇</span> Export CSV
              </button>
            </div>
            <div class="ioc-table-wrap">
              <table class="ioc-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th style="width:140px">Severity</th>
                    <th>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in filteredIOC" :key="row.node.id">
                    <td class="ioc-id">{{ row.node.id }}</td>
                    <td>{{ row.node.label }}</td>
                    <td>
                      <span
                        class="badge"
                        :style="{ background: row.color + '22', color: row.color, border: '1px solid ' + row.color + '44' }"
                      >
                        {{ row.catName }}
                      </span>
                    </td>
                    <td>
                      <div style="display:flex;align-items:center;gap:6px">
                        <div class="sev-track">
                          <div
                            class="sev-bar"
                            :style="{ width: Math.min(row.severity, 100) + '%', background: severityColor(row.severity) }"
                          ></div>
                        </div>
                        <span style="font-size:11px;color:var(--text-secondary);min-width:26px">{{ row.severity }}</span>
                      </div>
                    </td>
                    <td>
                      <div style="display:flex;gap:4px;flex-wrap:wrap">
                        <span
                          v-for="tag in row.tags.slice(0, 2)"
                          :key="tag"
                          class="tag-badge"
                        >{{ tag }}</span>
                        <span v-if="row.tags.length === 0" style="color:var(--text-muted);font-size:11px">—</span>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="filteredIOC.length === 0">
                    <td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px">
                      No matching indicators
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
          <div v-else class="empty-state">No data loaded</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

// ── Interfaces ────────────────────────────────────────────────────────────────

interface GraphNode { id: string; label: string; category: number; value: number; symbolSize: number }
interface GraphEdge { source: string; target: string; label: string; weight: number }
interface VectorPoint { id: string; label: string; x: number; y: number; cluster: number; score: number; tags: string[] }
interface GraphData { dataset: string; categories: string[]; nodes: GraphNode[]; edges: GraphEdge[]; vectors: VectorPoint[] }

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'graph', label: 'Campaign Graph' },
  { id: 'chain', label: 'Attack Chain' },
  { id: 'ioc',   label: 'IOC Matrix' },
]

const TEMPLATES = [
  { id: 'apt29-campaign',      label: 'APT29 Campaign',      desc: 'State-sponsored espionage (SVR/Cozy Bear)' },
  { id: 'ransomware-killchain', label: 'Ransomware Kill Chain', desc: 'Attack lifecycle graph' },
]

// Category color palette indexed by category number
const CAT_COLORS: Record<number, string> = {
  0: '#dc2626', // Threat Actor / red
  1: '#ea580c', // Tactic / orange
  2: '#ca8a04', // Technique / dark yellow
  3: '#7c3aed', // Tool/Malware / purple
  4: '#4b5563', // Infrastructure / dark grey
  5: '#16a34a', // Target/Victim / green
  6: '#991b1b', // Impact / dark red
}

// APT29 category definitions
const APT29_CATS = [
  { index: 0, name: 'actor',          label: 'Threat Actor',     color: '#dc2626' },
  { index: 1, name: 'tactic',         label: 'Tactic',           color: '#ea580c' },
  { index: 2, name: 'technique',      label: 'Technique',        color: '#ca8a04' },
  { index: 3, name: 'malware',        label: 'Malware / Tool',   color: '#7c3aed' },
  { index: 4, name: 'infrastructure', label: 'Infrastructure',   color: '#4b5563' },
  { index: 5, name: 'target',         label: 'Target',           color: '#16a34a' },
]

// Ransomware category definitions
const RANSOM_CATS = [
  { index: 0, name: 'actor',     label: 'Threat Actor',      color: '#dc2626' },
  { index: 1, name: 'phase',     label: 'Kill Chain Phase',  color: '#ea580c' },
  { index: 2, name: 'technique', label: 'Technique',         color: '#ca8a04' },
  { index: 3, name: 'tool',      label: 'Tool / Malware',    color: '#7c3aed' },
  { index: 4, name: 'infra',     label: 'Infrastructure',    color: '#4b5563' },
  { index: 5, name: 'victim',    label: 'Victim Asset',      color: '#2563eb' },
  { index: 6, name: 'impact',    label: 'Impact',            color: '#991b1b' },
]

// ── State ─────────────────────────────────────────────────────────────────────

const selectedTemplate = ref<string>('apt29-campaign')
const activeTab = ref<string>('graph')
const loading = ref<boolean>(false)
const graphData = ref<GraphData | null>(null)
const iocFilter = ref<string>('')
const loadingStore = ref<boolean>(false)
const storeMsg = ref<string>('')
const storeMsgOk = ref<boolean>(true)

const chartEl = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null
let resizeObserver: ResizeObserver | null = null

// ── Computed ──────────────────────────────────────────────────────────────────

const activeCategories = computed(() =>
  selectedTemplate.value === 'apt29-campaign' ? APT29_CATS : RANSOM_CATS
)

function nodeCountByCategory(idx: number): number {
  if (!graphData.value) return 0
  return graphData.value.nodes.filter(n => n.category === idx).length
}

const techniqueCount = computed(() => {
  if (!graphData.value) return 0
  return graphData.value.nodes.filter(n => n.category === 2).length
})

const complexityScore = computed(() => Math.min(Math.round(techniqueCount.value * 3.7), 100))

const stats = computed(() => {
  const nodes = graphData.value?.nodes ?? []
  const catMap = activeCategories.value.reduce((m, c) => { m[c.index] = c; return m }, {} as Record<number, typeof activeCategories.value[0]>)
  return [
    { label: 'Actors',      val: nodes.filter(n => n.category === 0).length, color: '#dc2626' },
    { label: 'Tactics',     val: nodes.filter(n => n.category === 1).length, color: '#ea580c' },
    { label: 'Techniques',  val: nodes.filter(n => n.category === 2).length, color: '#ca8a04' },
    { label: 'Tools/Malware', val: nodes.filter(n => n.category === 3).length, color: '#7c3aed' },
  ]
})

// Attack Chain columns: one column per category, in order
const chainColumns = computed(() => {
  if (!graphData.value) return []
  const cats = activeCategories.value
  return cats
    .map(cat => ({
      catIndex: cat.index,
      catName: cat.label,
      color: cat.color,
      nodes: graphData.value!.nodes.filter(n => n.category === cat.index),
    }))
    .filter(col => col.nodes.length > 0)
})

// IOC rows: Technique (cat 2) and Tool/Malware (cat 3)
const iocRows = computed(() => {
  if (!graphData.value) return []
  const cats = activeCategories.value
  const vectorMap = new Map<string, VectorPoint>()
  graphData.value.vectors.forEach(v => vectorMap.set(v.id, v))
  return graphData.value.nodes
    .filter(n => n.category === 2 || n.category === 3)
    .map(n => {
      const cat = cats.find(c => c.index === n.category)
      const vec = vectorMap.get(n.id)
      return {
        node: n,
        catName: cat?.label ?? 'Unknown',
        color: cat?.color ?? '#6366f1',
        severity: Math.round(n.value * 10),
        tags: vec?.tags ?? [],
      }
    })
})

const filteredIOC = computed(() => {
  const q = iocFilter.value.trim().toLowerCase()
  if (!q) return iocRows.value
  return iocRows.value.filter(r => r.node.label.toLowerCase().includes(q))
})

// ── API calls ─────────────────────────────────────────────────────────────────

async function fetchGraph(): Promise<void> {
  loading.value = true
  storeMsg.value = ''
  try {
    const res = await fetch(`/api/threat/graph/${selectedTemplate.value}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    graphData.value = await res.json() as GraphData
  } catch (err) {
    console.error('fetchGraph error', err)
    graphData.value = null
  } finally {
    loading.value = false
  }
}

async function loadIntoStore(): Promise<void> {
  loadingStore.value = true
  storeMsg.value = ''
  const name = selectedTemplate.value === 'apt29-campaign'
    ? 'threat-intel-apt29'
    : 'threat-intel-ransomware'
  try {
    const res = await fetch('/api/store/datasets/load', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    storeMsgOk.value = true
    storeMsg.value = `Loaded "${name}" into store`
  } catch (err) {
    storeMsgOk.value = false
    storeMsg.value = 'Failed to load into store'
  } finally {
    loadingStore.value = false
  }
}

// ── ECharts ───────────────────────────────────────────────────────────────────

function buildChartOption(data: GraphData): echarts.EChartsOption {
  const cats = activeCategories.value
  const categories = cats.map(c => ({ name: c.label, itemStyle: { color: c.color } }))

  const nodes = data.nodes.map(n => ({
    id: n.id,
    name: n.label,
    category: n.category,
    symbolSize: n.symbolSize || 20,
    value: n.value,
    itemStyle: { color: CAT_COLORS[n.category] ?? '#6366f1' },
    label: { show: true, fontSize: 10, color: '#e2e8f0' },
  }))

  const edges = data.edges.map(e => ({
    source: e.source,
    target: e.target,
    value: e.weight ?? 1,
    label: {
      show: true,
      formatter: e.label,
      fontSize: 9,
      color: '#94a3b8',
    },
    lineStyle: {
      width: Math.max(1, (e.weight ?? 1) * 0.8),
      color: '#334155',
      curveness: 0.15,
    },
  }))

  return {
    backgroundColor: 'transparent',
    legend: {
      data: categories.map(c => c.name),
      top: 8,
      right: 8,
      orient: 'vertical',
      textStyle: { color: '#94a3b8', fontSize: 11 },
      itemWidth: 12,
      itemHeight: 12,
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0', fontSize: 12 },
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const cat = cats[params.data.category]
          return `<b>${params.data.name}</b><br/>${cat?.label ?? ''}<br/>Value: ${params.data.value}`
        }
        if (params.dataType === 'edge') {
          return `${params.data.source} → ${params.data.target}<br/><b>${params.data.label ?? ''}</b>`
        }
        return ''
      },
    },
    series: [{
      type: 'graph',
      layout: 'force',
      data: nodes,
      links: edges,
      categories,
      roam: true,
      draggable: true,
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: [4, 10],
      force: {
        repulsion: 500,
        edgeLength: [80, 200],
        gravity: 0.05,
        layoutAnimation: true,
      },
      lineStyle: { opacity: 0.6 },
      emphasis: {
        focus: 'adjacency',
        lineStyle: { width: 3 },
      },
    }],
  }
}

function initChart(): void {
  if (!chartEl.value) return
  if (chartInstance) { chartInstance.dispose(); chartInstance = null }
  chartInstance = echarts.init(chartEl.value, 'dark')
  if (graphData.value) {
    chartInstance.setOption(buildChartOption(graphData.value))
  }
  if (resizeObserver) resizeObserver.disconnect()
  resizeObserver = new ResizeObserver(() => chartInstance?.resize())
  resizeObserver.observe(chartEl.value)
}

// ── IOC helpers ───────────────────────────────────────────────────────────────

function severityColor(sev: number): string {
  if (sev >= 80) return '#dc2626'
  if (sev >= 60) return '#ea580c'
  if (sev >= 40) return '#ca8a04'
  return '#16a34a'
}

function exportCSV(): void {
  const rows = filteredIOC.value
  const header = 'id,name,type,severity'
  const lines = rows.map(r =>
    `${r.node.id},"${r.node.label.replace(/"/g, '""')}","${r.catName}",${r.severity}`
  )
  const csv = [header, ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `threat-ioc-${selectedTemplate.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  await fetchGraph()
  await nextTick()
  if (activeTab.value === 'graph') initChart()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  chartInstance?.dispose()
  chartInstance = null
})

watch(selectedTemplate, async () => {
  await fetchGraph()
  await nextTick()
  if (activeTab.value === 'graph') initChart()
})

watch(graphData, async (val) => {
  if (!val) return
  await nextTick()
  if (activeTab.value === 'graph') {
    if (!chartInstance) {
      initChart()
    } else {
      chartInstance.setOption(buildChartOption(val), true)
    }
  }
})

watch(activeTab, async (tab) => {
  if (tab === 'graph') {
    await nextTick()
    initChart()
  }
})
</script>

<style scoped>
/* ── Layout ──────────────────────────────────────────────────────────────────── */
.ti-layout {
  display: flex;
  height: 100%;
  gap: 12px;
  padding: 12px;
  background: #0f172a;
  color: #e2e8f0;
  box-sizing: border-box;
  overflow: hidden;
}

.ti-sidebar {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.ti-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* ── Panel ───────────────────────────────────────────────────────────────────── */
.panel {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #0f172a;
  border-bottom: 1px solid #334155;
  min-height: 36px;
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.ti-shield-icon {
  font-size: 14px;
  filter: hue-rotate(240deg);
}

/* ── Radio cards ─────────────────────────────────────────────────────────────── */
.radio-card {
  cursor: pointer;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #0f172a;
  transition: border-color 0.15s, background 0.15s;
}

.radio-card:hover {
  border-color: #6366f1;
  background: #1e1b4b22;
}

.radio-card-active {
  border-color: #6366f1;
  background: #1e1b4b44;
}

.radio-dot {
  margin-top: 3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #475569;
  flex-shrink: 0;
  transition: border-color 0.15s, background 0.15s;
}

.radio-dot-active {
  border-color: #6366f1;
  background: #6366f1;
}

.radio-label {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  line-height: 1.3;
}

.radio-desc {
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
  line-height: 1.4;
}

/* ── Legend ──────────────────────────────────────────────────────────────────── */
.legend-row {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: #cbd5e1;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-name {
  flex: 1;
  font-size: 12px;
}

/* ── Score bar ───────────────────────────────────────────────────────────────── */
.score-track {
  height: 8px;
  background: #1e293b;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #334155;
}

.score-bar {
  height: 100%;
  background: linear-gradient(90deg, #dc2626, #ef4444);
  border-radius: 4px;
  transition: width 0.5s ease;
}

/* ── Stat cells ──────────────────────────────────────────────────────────────── */
.stat-cell {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px;
  text-align: center;
}

.stat-val {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
}

.stat-label {
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 2px;
}

/* ── Store message ───────────────────────────────────────────────────────────── */
.store-msg {
  margin-top: 6px;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  text-align: center;
}

.store-msg-ok {
  background: #16a34a22;
  color: #4ade80;
  border: 1px solid #16a34a44;
}

.store-msg-err {
  background: #dc262622;
  color: #f87171;
  border: 1px solid #dc262644;
}

/* ── Tabs ────────────────────────────────────────────────────────────────────── */
.tab-bar {
  display: flex;
  gap: 0;
}

.tab-btn {
  padding: 8px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.tab-btn:hover {
  color: #cbd5e1;
}

.tab-btn-active {
  color: #818cf8;
  border-bottom-color: #6366f1;
}

/* ── Loading overlay ─────────────────────────────────────────────────────────── */
.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #0f172aaa;
  z-index: 10;
  border-radius: 4px;
}

/* ── Spinner ─────────────────────────────────────────────────────────────────── */
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #334155;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner-lg {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Attack Chain tab ────────────────────────────────────────────────────────── */
.chain-tab {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.chain-scroll {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.chain-columns {
  display: flex;
  align-items: flex-start;
  gap: 0;
  min-width: max-content;
}

.chain-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  min-width: 130px;
  max-width: 160px;
}

.chain-col-header {
  width: 100%;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 5px 8px;
  border-radius: 6px 6px 0 0;
  border: 1px solid;
  border-bottom: none;
}

.chain-nodes {
  width: 100%;
  border: 1px solid #334155;
  border-top: none;
  border-radius: 0 0 6px 6px;
  background: #0f172a;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-height: 40px;
}

.chain-badge {
  padding: 4px 7px;
  border-radius: 4px;
  border: 1px solid;
  font-size: 11px;
  line-height: 1.3;
  word-break: break-word;
  cursor: default;
}

.chain-arrow {
  position: absolute;
  right: -16px;
  top: 12px;
  font-size: 20px;
  color: #475569;
  z-index: 1;
  width: 32px;
  text-align: center;
  line-height: 1;
}

/* ── IOC Matrix tab ──────────────────────────────────────────────────────────── */
.ioc-tab {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ioc-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid #334155;
  background: #0f172a;
}

.ioc-table-wrap {
  flex: 1;
  overflow: auto;
}

.ioc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.ioc-table thead {
  position: sticky;
  top: 0;
  z-index: 2;
}

.ioc-table th {
  background: #1e293b;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 8px 12px;
  border-bottom: 1px solid #334155;
  text-align: left;
  white-space: nowrap;
}

.ioc-table td {
  padding: 7px 12px;
  border-bottom: 1px solid #1e293b;
  color: #cbd5e1;
  vertical-align: middle;
}

.ioc-table tbody tr:hover td {
  background: #1e293b55;
}

.ioc-id {
  font-family: monospace;
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sev-track {
  flex: 1;
  height: 6px;
  background: #1e293b;
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid #334155;
}

.sev-bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.tag-badge {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  background: #1e1b4b;
  color: #818cf8;
  border: 1px solid #4338ca44;
  white-space: nowrap;
}

/* ── Shared controls ─────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  padding: 5px 12px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 5px;
  color: #cbd5e1;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.btn:hover:not(:disabled) {
  background: #334155;
  border-color: #475569;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #4338ca;
  border-color: #6366f1;
  color: #e0e7ff;
}

.btn-primary:hover:not(:disabled) {
  background: #4f46e5;
  border-color: #818cf8;
}

.badge {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
}

.badge-green {
  background: #16a34a22;
  color: #4ade80;
  border: 1px solid #16a34a44;
}

.input-ctrl {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 5px;
  color: #e2e8f0;
  padding: 5px 9px;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s;
}

.input-ctrl:focus {
  border-color: #6366f1;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  font-size: 14px;
}

/* ── Vars ────────────────────────────────────────────────────────────────────── */
:root {
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted: #475569;
}
</style>

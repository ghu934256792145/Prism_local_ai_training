<template>
  <div class="legal-explorer">
    <!-- Sidebar -->
    <aside class="legal-sidebar panel">
      <div class="panel-header"><span class="panel-title">Legal Explorer</span></div>
      <div class="sidebar-body">
        <div class="sidebar-section">
          <div class="sidebar-label">Template</div>
          <div class="template-list">
            <button
              v-for="t in templates"
              :key="t"
              class="template-btn"
              :class="{ active: activeTemplate === t }"
              @click="loadTemplate(t)"
            >{{ templateLabel(t) }}</button>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-label">Category Legend</div>
          <div class="legend-list">
            <div v-for="(cat, i) in categories" :key="i" class="legend-item">
              <span class="legend-dot" :style="{ background: CAT_COLORS[i] }"></span>
              <span>{{ cat }}</span>
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-label">Overrulings ({{ overruleEdges.length }})</div>
          <div v-for="e in overruleEdges" :key="e.source+e.target" class="overrule-chip">
            <span class="overrule-icon">⊗</span>
            <span class="overrule-text">{{ nodeLabel(e.source) }} → {{ nodeLabel(e.target) }}</span>
          </div>
          <div v-if="overruleEdges.length === 0" class="text-secondary" style="font-size:12px">None in this template</div>
        </div>

        <div class="sidebar-section stats-grid">
          <div class="stat-box"><div class="stat-val">{{ nodes.length }}</div><div class="stat-lbl">Nodes</div></div>
          <div class="stat-box"><div class="stat-val">{{ edges.length }}</div><div class="stat-lbl">Edges</div></div>
          <div class="stat-box"><div class="stat-val">{{ caseNodes.length }}</div><div class="stat-lbl">Cases</div></div>
          <div class="stat-box"><div class="stat-val">{{ statuteNodes.length }}</div><div class="stat-lbl">Statutes</div></div>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <div class="legal-main">
      <div class="tab-bar">
        <button v-for="tab in TABS" :key="tab.id" class="tab-btn" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">
          {{ tab.label }}
        </button>
        <router-link to="/projects?industry=legal" class="projects-badge">Open in Projects →</router-link>
      </div>

      <div class="tab-content">
        <!-- Tab 1: Citation Network -->
        <div v-show="activeTab === 'graph'" class="chart-wrap">
          <div id="legal-graph" style="width:100%;height:100%"></div>
        </div>

        <!-- Tab 2: Precedent Map -->
        <div v-show="activeTab === 'embed'" class="chart-wrap">
          <div id="legal-embed" style="width:100%;height:100%"></div>
        </div>

        <!-- Tab 3: Edge Analysis -->
        <div v-show="activeTab === 'edges'" class="edge-panel">
          <div class="edge-filter-row">
            <select v-model="edgeFilter" class="edge-filter-select">
              <option value="">All relationship types</option>
              <option v-for="rel in edgeTypes" :key="rel" :value="rel">{{ rel }}</option>
            </select>
            <span class="text-secondary" style="font-size:12px">{{ filteredEdges.length }} edges</span>
          </div>
          <div class="edge-table-wrap">
            <table class="edge-table">
              <thead><tr><th>Source</th><th>Relationship</th><th>Target</th></tr></thead>
              <tbody>
                <tr v-for="e in filteredEdges" :key="e.source+e.label+e.target" :class="edgeClass(e.label)">
                  <td>{{ nodeLabel(e.source) }}</td>
                  <td><span class="rel-badge" :class="relBadgeClass(e.label)">{{ e.label }}</span></td>
                  <td>{{ nodeLabel(e.target) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab 4: Concept Map -->
        <div v-show="activeTab === 'concepts'" class="chart-wrap">
          <div id="legal-concepts" style="width:100%;height:100%"></div>
        </div>
      </div>
    </div>

    <!-- Detail panel -->
    <aside class="legal-detail panel">
      <div class="panel-header"><span class="panel-title">Selected Node</span></div>
      <div v-if="!selected" class="detail-empty text-secondary">Click a node in the graph</div>
      <div v-else class="detail-body">
        <div class="detail-name">{{ selected.label }}</div>
        <div class="detail-cat">
          <span class="legend-dot" :style="{ background: CAT_COLORS[selected.category] }"></span>
          {{ categories[selected.category] }}
        </div>
        <div class="sidebar-label" style="margin-top:12px">Cites / Relies On</div>
        <div v-for="conn in outConnections" :key="conn.id" class="conn-row">
          <span class="rel-badge sm" :class="relBadgeClass(conn.rel)">{{ conn.rel }}</span>
          <span class="conn-label">{{ conn.label }}</span>
        </div>
        <div class="sidebar-label" style="margin-top:10px">Cited By</div>
        <div v-for="conn in inConnections" :key="conn.id" class="conn-row">
          <span class="conn-dir">←</span>
          <span class="conn-label">{{ conn.label }}</span>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'

const CAT_COLORS = ['#5794f2','#73bf69','#fade2a','#ff7383','#b877d9']
const TABS = [
  { id: 'graph',    label: 'Citation Network' },
  { id: 'embed',    label: 'Precedent Map' },
  { id: 'edges',    label: 'Edge Analysis' },
  { id: 'concepts', label: 'Concept Graph' },
]

const templates = ref(['legal-citation', 'legal-contract'])
const activeTemplate = ref('legal-citation')
const activeTab = ref('graph')
const nodes = ref<any[]>([])
const edges = ref<any[]>([])
const categories = ref<string[]>([])
const vectors = ref<any[]>([])
const selected = ref<any>(null)
const edgeFilter = ref('')

let graphChart: echarts.ECharts | null = null
let embedChart: echarts.ECharts | null = null
let conceptChart: echarts.ECharts | null = null

function templateLabel(t: string) {
  const m: Record<string,string> = {
    'legal-citation': 'SCOTUS Citations',
    'legal-contract': 'Contract Clauses',
  }
  return m[t] ?? t
}

function nodeLabel(id: string) {
  return nodes.value.find(n => n.id === id)?.label ?? id
}

function edgeClass(label: string) {
  if (label === 'OVERRULES') return 'row-overrule'
  if (label === 'INTERPRETS') return 'row-interprets'
  return ''
}

function relBadgeClass(label: string) {
  const m: Record<string,string> = {
    OVERRULES: 'rel-red', CITES: 'rel-blue', INTERPRETS: 'rel-green',
    RELIES_ON: 'rel-yellow', DISTINGUISHED_BY: 'rel-orange',
    INCORPORATES: 'rel-blue', INCLUDES: 'rel-green', GOVERNS: 'rel-purple',
    DEFINED_BY: 'rel-yellow', DEFINES: 'rel-green', APPLIES_TO: 'rel-orange',
  }
  return m[label] ?? 'rel-default'
}

async function loadTemplate(t: string) {
  activeTemplate.value = t
  selected.value = null
  try {
    const res = await fetch(`/api/legal/graph/${t}`)
    const data = await res.json()
    nodes.value = data.nodes ?? []
    edges.value = data.edges ?? []
    categories.value = data.categories ?? []
    vectors.value = data.vectors ?? []
    await nextTick()
    renderGraph()
    renderEmbed()
    renderConceptGraph()
  } catch {
    loadFallback()
  }
}

function loadFallback() {
  categories.value = ['Case','Statute','Court','Concept','Precedent']
  nodes.value = [
    { id:'marbury', label:'Marbury v. Madison', category:0, symbolSize:26 },
    { id:'brown', label:'Brown v. Board', category:0, symbolSize:28 },
    { id:'plessy', label:'Plessy v. Ferguson', category:0, symbolSize:22 },
    { id:'constitution', label:'U.S. Constitution', category:1, symbolSize:20 },
    { id:'scotus', label:'Supreme Court', category:2, symbolSize:24 },
    { id:'judicial-review', label:'Judicial Review', category:3, symbolSize:20 },
  ]
  edges.value = [
    { source:'brown', target:'plessy', label:'OVERRULES' },
    { source:'marbury', target:'constitution', label:'INTERPRETS' },
    { source:'scotus', target:'marbury', label:'DECIDED' },
    { source:'judicial-review', target:'marbury', label:'RELIES_ON' },
  ]
  vectors.value = []
  renderGraph()
  renderEmbed()
  renderConceptGraph()
}

const overruleEdges = computed(() => edges.value.filter(e => e.label === 'OVERRULES'))
const caseNodes = computed(() => nodes.value.filter(n => n.category === 0))
const statuteNodes = computed(() => nodes.value.filter(n => n.category === 1))
const edgeTypes = computed(() => [...new Set(edges.value.map(e => e.label))].sort())
const filteredEdges = computed(() =>
  edgeFilter.value ? edges.value.filter(e => e.label === edgeFilter.value) : edges.value
)

const outConnections = computed(() => {
  if (!selected.value) return []
  return edges.value.filter(e => e.source === selected.value.id).map(e => ({
    id: e.target, label: nodeLabel(e.target), rel: e.label,
  }))
})
const inConnections = computed(() => {
  if (!selected.value) return []
  return edges.value.filter(e => e.target === selected.value.id).map(e => ({
    id: e.source, label: nodeLabel(e.source), rel: e.label,
  }))
})

function renderGraph() {
  const el = document.getElementById('legal-graph')
  if (!el) return
  if (!graphChart) graphChart = echarts.init(el, 'dark')

  const edgeColorMap: Record<string,string> = {
    OVERRULES: '#f44336', CITES: '#5794f2', INTERPRETS: '#73bf69',
    RELIES_ON: '#fade2a', DISTINGUISHED_BY: '#ff9800',
    INCORPORATES: '#5794f2', INCLUDES: '#73bf69', GOVERNS: '#b877d9',
  }

  graphChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { formatter: (p: any) => p.data?.label ?? p.data?.source },
    legend: { data: categories.value, textStyle: { color: '#ccc' }, bottom: 8, orient: 'horizontal' },
    series: [{
      type: 'graph', layout: 'force', roam: true, draggable: true,
      symbolSize: (v: any, params: any) => params.data?.symbolSize ?? 18,
      categories: categories.value.map((name, i) => ({ name, itemStyle: { color: CAT_COLORS[i] } })),
      data: nodes.value.map(n => ({ ...n, name: n.label })),
      links: edges.value.map(e => ({
        source: e.source, target: e.target,
        label: { show: true, formatter: e.label, fontSize: 9, color: '#aaa' },
        lineStyle: {
          color: edgeColorMap[e.label] ?? '#555',
          width: e.label === 'OVERRULES' ? 2.5 : 1,
          type: e.label === 'OVERRULES' ? 'dashed' : 'solid',
        },
      })),
      force: { repulsion: 220, edgeLength: [80, 200] },
      emphasis: { focus: 'adjacency' },
    }]
  })
  graphChart.on('click', (params: any) => {
    if (params.dataType === 'node') {
      selected.value = nodes.value.find(n => n.id === params.data.id || n.label === params.data.label)
    }
  })
}

function renderEmbed() {
  const el = document.getElementById('legal-embed')
  if (!el) return
  if (!embedChart) embedChart = echarts.init(el, 'dark')
  const series = categories.value.map((name, i) => ({
    name, type: 'scatter', symbolSize: 14,
    itemStyle: { color: CAT_COLORS[i] },
    data: vectors.value.filter(v => {
      const node = nodes.value.find(n => n.id === v.id)
      return node?.category === i
    }).map(v => ({ value: [v.x, v.y], name: v.label })),
  }))
  embedChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { formatter: (p: any) => p.data?.name },
    legend: { data: categories.value, textStyle: { color: '#ccc' }, bottom: 8 },
    xAxis: { name: 'Constitutional Axis', nameTextStyle: { color: '#888' }, axisLabel: { color: '#888' }, splitLine: { lineStyle: { color: '#333' } } },
    yAxis: { name: 'Civil Rights Axis', nameTextStyle: { color: '#888' }, axisLabel: { color: '#888' }, splitLine: { lineStyle: { color: '#333' } } },
    series,
  })
}

function renderConceptGraph() {
  const el = document.getElementById('legal-concepts')
  if (!el) return
  if (!conceptChart) conceptChart = echarts.init(el, 'dark')

  // Show only concept nodes and their connections
  const conceptNodes = nodes.value.filter(n => n.category === 3)
  const allIds = new Set(conceptNodes.map(n => n.id))
  const relevantEdges = edges.value.filter(e => allIds.has(e.source) || allIds.has(e.target))
  const relatedIds = new Set<string>()
  relevantEdges.forEach(e => { relatedIds.add(e.source); relatedIds.add(e.target) })
  const conceptAllNodes = nodes.value.filter(n => relatedIds.has(n.id))

  conceptChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { formatter: (p: any) => p.data?.label ?? '' },
    series: [{
      type: 'graph', layout: 'force', roam: true, draggable: true,
      categories: categories.value.map((name, i) => ({ name, itemStyle: { color: CAT_COLORS[i] } })),
      data: conceptAllNodes.map(n => ({ ...n, name: n.label, symbolSize: n.category === 3 ? 22 : 16 })),
      links: relevantEdges.map(e => ({
        source: e.source, target: e.target,
        label: { show: true, formatter: e.label, fontSize: 9, color: '#aaa' },
        lineStyle: { color: '#555' },
      })),
      force: { repulsion: 180, edgeLength: [60, 150] },
      emphasis: { focus: 'adjacency' },
    }]
  })
}

onMounted(async () => {
  await nextTick()
  await loadTemplate('legal-citation')
})

watch(activeTab, async (tab) => {
  await nextTick()
  if (tab === 'graph') { graphChart?.resize(); renderGraph() }
  if (tab === 'embed') { embedChart?.resize(); renderEmbed() }
  if (tab === 'concepts') { conceptChart?.resize(); renderConceptGraph() }
})

onUnmounted(() => {
  graphChart?.dispose()
  embedChart?.dispose()
  conceptChart?.dispose()
})
</script>

<style scoped>
.legal-explorer { display: flex; height: 100%; overflow: hidden; }
.legal-sidebar { width: 200px; flex-shrink: 0; display: flex; flex-direction: column; overflow-y: auto; }
.legal-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.legal-detail { width: 220px; flex-shrink: 0; overflow-y: auto; }

.sidebar-body { padding: 12px; display: flex; flex-direction: column; gap: 16px; }
.sidebar-section { display: flex; flex-direction: column; gap: 6px; }
.sidebar-label { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .6px; }

.template-list { display: flex; flex-direction: column; gap: 4px; }
.template-btn { background: var(--bg-panel); border: 1px solid var(--border); color: var(--text-primary);
  padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; text-align: left; }
.template-btn.active { border-color: var(--accent); color: var(--accent); }

.legend-list { display: flex; flex-direction: column; gap: 5px; }
.legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

.overrule-chip { display: flex; align-items: center; gap: 5px; font-size: 11px; padding: 3px 6px;
  background: rgba(244,67,54,.1); border-radius: 3px; }
.overrule-icon { color: #f44336; }
.overrule-text { color: #ffcdd2; }

.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.stat-box { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 4px; padding: 8px; text-align: center; }
.stat-val { font-size: 18px; font-weight: 700; color: var(--accent); }
.stat-lbl { font-size: 10px; color: var(--text-secondary); }

.tab-bar { display: flex; gap: 0; border-bottom: 1px solid var(--border); padding: 0 12px; }
.tab-btn { background: none; border: none; color: var(--text-secondary); padding: 10px 16px; cursor: pointer; font-size: 13px; border-bottom: 2px solid transparent; }
.tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
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
.tab-content { flex: 1; overflow: hidden; }
.chart-wrap { width: 100%; height: 100%; }

.edge-panel { padding: 16px; height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.edge-filter-row { display: flex; align-items: center; gap: 12px; }
.edge-filter-select { background: var(--bg-panel); border: 1px solid var(--border); color: var(--text-primary);
  padding: 6px 10px; border-radius: 4px; font-size: 12px; }
.edge-table-wrap { flex: 1; overflow-y: auto; }
.edge-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.edge-table th { text-align: left; padding: 8px; border-bottom: 1px solid var(--border); color: var(--text-secondary); font-weight: 500; }
.edge-table td { padding: 8px; border-bottom: 1px solid rgba(255,255,255,.05); }
.row-overrule td { background: rgba(244,67,54,.05); }
.row-interprets td { background: rgba(115,191,105,.05); }

.rel-badge { font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 600; }
.rel-badge.sm { font-size: 9px; padding: 1px 5px; }
.rel-red { background: rgba(244,67,54,.2); color: #ff8a80; }
.rel-blue { background: rgba(87,148,242,.2); color: #90caf9; }
.rel-green { background: rgba(115,191,105,.2); color: #a5d6a7; }
.rel-yellow { background: rgba(250,222,42,.2); color: #fff176; }
.rel-orange { background: rgba(255,152,0,.2); color: #ffcc80; }
.rel-purple { background: rgba(184,119,217,.2); color: #ce93d8; }
.rel-default { background: rgba(255,255,255,.1); color: #ccc; }

.detail-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.detail-empty { padding: 20px; font-size: 12px; text-align: center; }
.detail-name { font-size: 13px; font-weight: 600; line-height: 1.4; }
.detail-cat { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); }
.conn-row { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 3px 0; border-bottom: 1px solid var(--border); }
.conn-dir { color: var(--accent); font-weight: 700; width: 16px; }
.conn-label { flex: 1; }
</style>

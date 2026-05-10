<template>
  <div class="mat-explorer">
    <!-- Sidebar -->
    <aside class="mat-sidebar panel">
      <div class="panel-header"><span class="panel-title">Materials Explorer</span></div>
      <div class="sidebar-body">
        <div class="sidebar-section">
          <div class="sidebar-label">Material System</div>
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
          <div class="sidebar-label">Applications ({{ appNodes.length }})</div>
          <div v-for="a in appNodes" :key="a.id" class="app-chip">
            <span class="app-dot">▶</span>
            <span>{{ a.label }}</span>
          </div>
        </div>

        <div class="sidebar-section stats-grid">
          <div class="stat-box"><div class="stat-val">{{ nodes.length }}</div><div class="stat-lbl">Nodes</div></div>
          <div class="stat-box"><div class="stat-val">{{ edges.length }}</div><div class="stat-lbl">Edges</div></div>
          <div class="stat-box"><div class="stat-val">{{ elementNodes.length }}</div><div class="stat-lbl">Elements</div></div>
          <div class="stat-box"><div class="stat-val">{{ compoundNodes.length }}</div><div class="stat-lbl">Compounds</div></div>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <div class="mat-main">
      <div class="tab-bar">
        <button v-for="tab in TABS" :key="tab.id" class="tab-btn" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">
          {{ tab.label }}
        </button>
        <router-link to="/projects?industry=materials" class="projects-badge">Open in Projects →</router-link>
      </div>

      <div class="tab-content">
        <!-- Tab 1: Structure Graph -->
        <div v-show="activeTab === 'graph'" class="chart-wrap">
          <div id="mat-graph" style="width:100%;height:100%"></div>
        </div>

        <!-- Tab 2: Property Embedding -->
        <div v-show="activeTab === 'embed'" class="chart-wrap">
          <div id="mat-embed" style="width:100%;height:100%"></div>
        </div>

        <!-- Tab 3: Composition Heatmap -->
        <div v-show="activeTab === 'heatmap'" class="chart-wrap">
          <div id="mat-heatmap" style="width:100%;height:100%"></div>
        </div>

        <!-- Tab 4: Synthesis Routes (DAG) -->
        <div v-show="activeTab === 'routes'" class="routes-panel">
          <div class="routes-title">Synthesis Routes: Elements → Compounds → Applications</div>
          <div class="routes-list">
            <div v-for="route in synthesisRoutes" :key="route.target" class="route-card">
              <div class="route-target">
                <span class="legend-dot" :style="{ background: CAT_COLORS[1] }"></span>
                <strong>{{ route.target }}</strong>
              </div>
              <div class="route-chain">
                <span v-for="(step, i) in route.steps" :key="i" class="route-step">
                  <span class="step-node" :style="{ borderColor: CAT_COLORS[step.cat] }">{{ step.label }}</span>
                  <span v-if="i < route.steps.length - 1" class="step-arrow">→</span>
                </span>
              </div>
              <div class="route-apps">
                <span class="route-apps-label text-secondary">Enables: </span>
                <span v-for="app in route.apps" :key="app" class="app-tag">{{ app }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail panel -->
    <aside class="mat-detail panel">
      <div class="panel-header"><span class="panel-title">Selected Node</span></div>
      <div v-if="!selected" class="detail-empty text-secondary">Click a node in the graph</div>
      <div v-else class="detail-body">
        <div class="detail-name">{{ selected.label }}</div>
        <div class="detail-cat">
          <span class="legend-dot" :style="{ background: CAT_COLORS[selected.category] }"></span>
          {{ categories[selected.category] }}
        </div>
        <div class="sidebar-label" style="margin-top:12px">Outgoing</div>
        <div v-for="conn in outConnections" :key="conn.id" class="conn-row">
          <span class="conn-rel badge" :class="relClass(conn.rel)" style="font-size:10px">{{ conn.rel }}</span>
          <span class="conn-label">{{ conn.label }}</span>
        </div>
        <div class="sidebar-label" style="margin-top:10px">Incoming</div>
        <div v-for="conn in inConnections" :key="conn.id" class="conn-row">
          <span class="conn-dir">←</span>
          <span class="conn-label">{{ conn.label }}</span>
          <span class="conn-rel badge" style="font-size:10px">{{ conn.rel }}</span>
        </div>
        <template v-if="selectedVector">
          <div class="sidebar-label" style="margin-top:12px">Embedding</div>
          <div class="embed-coords">
            <div>x: {{ selectedVector.x.toFixed(3) }}</div>
            <div>y: {{ selectedVector.y.toFixed(3) }}</div>
            <div>cluster: {{ selectedVector.cluster }}</div>
          </div>
        </template>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'

const CAT_COLORS = ['#78c6f7','#73bf69','#fade2a','#ff7383','#b877d9']
const TABS = [
  { id: 'graph',   label: 'Structure Graph' },
  { id: 'embed',   label: 'Property Embedding' },
  { id: 'heatmap', label: 'Composition Matrix' },
  { id: 'routes',  label: 'Synthesis Routes' },
]

const templates = ref(['materials-perovskite', 'materials-alloy'])
const activeTemplate = ref('materials-perovskite')
const activeTab = ref('graph')
const nodes = ref<any[]>([])
const edges = ref<any[]>([])
const categories = ref<string[]>([])
const vectors = ref<any[]>([])
const selected = ref<any>(null)

let graphChart: echarts.ECharts | null = null
let embedChart: echarts.ECharts | null = null
let heatmapChart: echarts.ECharts | null = null

function templateLabel(t: string) {
  const m: Record<string,string> = {
    'materials-perovskite': 'Perovskite Solar (ABX₃)',
    'materials-alloy': 'Ni Superalloy System',
  }
  return m[t] ?? t
}

function nodeLabel(id: string) {
  return nodes.value.find(n => n.id === id)?.label ?? id
}

function relClass(rel: string) {
  const m: Record<string,string> = {
    FORMS: 'rel-green', ADOPTS: 'rel-blue', EXHIBITS: 'rel-yellow',
    ENABLES: 'rel-purple', DOPED_WITH: 'rel-orange', SIMILAR_COMPOSITION: 'rel-cyan',
    EXHIBITS_STRUCTURE: 'rel-blue',
  }
  return m[rel] ?? 'rel-default'
}

async function loadTemplate(t: string) {
  activeTemplate.value = t
  selected.value = null
  try {
    const res = await fetch(`/api/materials/graph/${t}`)
    const data = await res.json()
    nodes.value = data.nodes ?? []
    edges.value = data.edges ?? []
    categories.value = data.categories ?? []
    vectors.value = data.vectors ?? []
    await nextTick()
    renderGraph()
    renderEmbed()
    renderHeatmap()
  } catch {
    loadFallback()
  }
}

function loadFallback() {
  categories.value = ['Element','Compound','Structure','Property','Application']
  nodes.value = [
    { id:'ma', label:'Methylammonium (MA)', category:0, symbolSize:16 },
    { id:'pb', label:'Lead (Pb)', category:0, symbolSize:16 },
    { id:'iodine', label:'Iodine (I)', category:0, symbolSize:16 },
    { id:'mapbi3', label:'MAPbI₃', category:1, symbolSize:26 },
    { id:'cubic', label:'Cubic Perovskite', category:2, symbolSize:20 },
    { id:'bg-16', label:'Bandgap ~1.6 eV', category:3, symbolSize:18 },
    { id:'solar', label:'Perovskite Solar Cell', category:4, symbolSize:22 },
  ]
  edges.value = [
    { source:'ma', target:'mapbi3', label:'FORMS' },
    { source:'pb', target:'mapbi3', label:'FORMS' },
    { source:'iodine', target:'mapbi3', label:'FORMS' },
    { source:'mapbi3', target:'cubic', label:'ADOPTS' },
    { source:'mapbi3', target:'bg-16', label:'EXHIBITS' },
    { source:'mapbi3', target:'solar', label:'ENABLES' },
  ]
  vectors.value = []
  renderGraph()
  renderEmbed()
  renderHeatmap()
}

const elementNodes = computed(() => nodes.value.filter(n => n.category === 0))
const compoundNodes = computed(() => nodes.value.filter(n => n.category === 1))
const appNodes = computed(() => nodes.value.filter(n => n.category === 4))

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
const selectedVector = computed(() => selected.value ? vectors.value.find(v => v.id === selected.value.id) : null)

// Synthesis routes: for each compound, collect its element inputs and application outputs
const synthesisRoutes = computed(() => {
  return compoundNodes.value.slice(0, 6).map(c => {
    const inputs = edges.value
      .filter(e => e.target === c.id && e.label === 'FORMS')
      .map(e => ({ id: e.source, label: nodeLabel(e.source), cat: 0 }))
    const apps = edges.value
      .filter(e => e.source === c.id && e.label === 'ENABLES')
      .map(e => nodeLabel(e.target))
    return { target: c.label, steps: inputs, apps }
  }).filter(r => r.steps.length > 0)
})

function renderGraph() {
  const el = document.getElementById('mat-graph')
  if (!el) return
  if (!graphChart) graphChart = echarts.init(el, 'dark')

  const edgeColorMap: Record<string,string> = {
    FORMS: '#73bf69', ADOPTS: '#78c6f7', EXHIBITS: '#fade2a',
    ENABLES: '#b877d9', DOPED_WITH: '#ff9800', SIMILAR_COMPOSITION: '#00bcd4',
    EXHIBITS_STRUCTURE: '#5794f2',
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
        lineStyle: { color: edgeColorMap[e.label] ?? '#555', width: 1 },
      })),
      force: { repulsion: 200, edgeLength: [60, 180] },
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
  const el = document.getElementById('mat-embed')
  if (!el) return
  if (!embedChart) embedChart = echarts.init(el, 'dark')
  const series = categories.value.map((name, i) => ({
    name, type: 'scatter', symbolSize: (v: any, params: any) => i < 2 ? 16 : 12,
    itemStyle: { color: CAT_COLORS[i] },
    data: vectors.value.filter(v => {
      const node = nodes.value.find(n => n.id === v.id)
      return node?.category === i
    }).map(v => ({ value: [v.x, v.y], name: v.label })),
  }))
  const xAxisLabel = activeTemplate.value === 'materials-perovskite' ? 'Bandgap Axis' : 'Ni Content Axis'
  const yAxisLabel = activeTemplate.value === 'materials-perovskite' ? 'Stability Axis' : 'High-Temp Performance'
  embedChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { formatter: (p: any) => p.data?.name },
    legend: { data: categories.value, textStyle: { color: '#ccc' }, bottom: 8 },
    xAxis: { name: xAxisLabel, nameTextStyle: { color: '#888' }, axisLabel: { color: '#888' }, splitLine: { lineStyle: { color: '#333' } } },
    yAxis: { name: yAxisLabel, nameTextStyle: { color: '#888' }, axisLabel: { color: '#888' }, splitLine: { lineStyle: { color: '#333' } } },
    series,
  })
}

function renderHeatmap() {
  const el = document.getElementById('mat-heatmap')
  if (!el) return
  if (!heatmapChart) heatmapChart = echarts.init(el, 'dark')

  // Build compound × property matrix
  const compounds = compoundNodes.value.slice(0, 8)
  const properties = nodes.value.filter(n => n.category === 3).slice(0, 8)
  if (compounds.length === 0 || properties.length === 0) return

  const data: number[][] = []
  for (let ci = 0; ci < compounds.length; ci++) {
    for (let pi = 0; pi < properties.length; pi++) {
      const hasEdge = edges.value.some(e =>
        e.source === compounds[ci].id && e.target === properties[pi].id
        && (e.label === 'EXHIBITS' || e.label === 'EXHIBITS_STRUCTURE')
      )
      data.push([pi, ci, hasEdge ? 1 : 0])
    }
  }

  heatmapChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { formatter: (p: any) => `${compounds[p.data[1]]?.label} × ${properties[p.data[0]]?.label}: ${p.data[2] ? 'Yes' : 'No'}` },
    grid: { containLabel: true },
    xAxis: { type: 'category', data: properties.map(p => p.label), axisLabel: { color: '#888', rotate: 30, fontSize: 10 } },
    yAxis: { type: 'category', data: compounds.map(c => c.label), axisLabel: { color: '#888', fontSize: 11 } },
    visualMap: { min: 0, max: 1, calculable: false, show: false,
      inRange: { color: ['#1a1a2e','#73bf69'] } },
    series: [{ type: 'heatmap', data, label: { show: false } }],
  })
}

onMounted(async () => {
  await nextTick()
  await loadTemplate('materials-perovskite')
})

watch(activeTab, async (tab) => {
  await nextTick()
  if (tab === 'graph') { graphChart?.resize(); renderGraph() }
  if (tab === 'embed') { embedChart?.resize(); renderEmbed() }
  if (tab === 'heatmap') { heatmapChart?.resize(); renderHeatmap() }
})

onUnmounted(() => {
  graphChart?.dispose()
  embedChart?.dispose()
  heatmapChart?.dispose()
})
</script>

<style scoped>
.mat-explorer { display: flex; height: 100%; overflow: hidden; }
.mat-sidebar { width: 200px; flex-shrink: 0; display: flex; flex-direction: column; overflow-y: auto; }
.mat-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.mat-detail { width: 220px; flex-shrink: 0; overflow-y: auto; }

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

.app-chip { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 3px 0; color: #ce93d8; }
.app-dot { color: #b877d9; }

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

.routes-panel { padding: 16px; height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.routes-title { font-size: 14px; font-weight: 600; }
.routes-list { display: flex; flex-direction: column; gap: 10px; }
.route-card { background: var(--bg-panel); border: 1px solid var(--border); border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.route-target { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.route-chain { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.route-step { display: flex; align-items: center; gap: 4px; }
.step-node { font-size: 11px; padding: 2px 7px; border-radius: 12px; border: 1px solid; background: rgba(255,255,255,.05); }
.step-arrow { color: var(--text-secondary); }
.route-apps { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.route-apps-label { font-size: 11px; }
.app-tag { font-size: 11px; padding: 2px 7px; border-radius: 10px; background: rgba(184,119,217,.15); color: #ce93d8; }

.detail-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.detail-empty { padding: 20px; font-size: 12px; text-align: center; }
.detail-name { font-size: 14px; font-weight: 600; }
.detail-cat { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); }
.conn-row { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 3px 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
.conn-dir { color: var(--accent); font-weight: 700; width: 16px; }
.conn-label { flex: 1; }
.conn-rel { font-size: 10px; }
.embed-coords { font-size: 12px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 3px; }

.rel-green { background: rgba(115,191,105,.2); color: #a5d6a7; padding: 1px 5px; border-radius: 3px; }
.rel-blue { background: rgba(87,148,242,.2); color: #90caf9; padding: 1px 5px; border-radius: 3px; }
.rel-yellow { background: rgba(250,222,42,.2); color: #fff176; padding: 1px 5px; border-radius: 3px; }
.rel-purple { background: rgba(184,119,217,.2); color: #ce93d8; padding: 1px 5px; border-radius: 3px; }
.rel-orange { background: rgba(255,152,0,.2); color: #ffcc80; padding: 1px 5px; border-radius: 3px; }
.rel-cyan { background: rgba(0,188,212,.2); color: #80deea; padding: 1px 5px; border-radius: 3px; }
.rel-default { background: rgba(255,255,255,.1); color: #ccc; padding: 1px 5px; border-radius: 3px; }
</style>

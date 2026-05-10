<template>
  <div class="aml-explorer">
    <!-- Sidebar -->
    <aside class="aml-sidebar panel">
      <div class="panel-header"><span class="panel-title">AML Explorer</span></div>
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
          <div class="sidebar-label">Risk Legend</div>
          <div class="legend-list">
            <div v-for="(cat, i) in categories" :key="i" class="legend-item">
              <span class="legend-dot" :style="{ background: CAT_COLORS[i] }"></span>
              <span>{{ cat }}</span>
            </div>
          </div>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-label">Alerts ({{ alertNodes.length }})</div>
          <div v-for="a in alertNodes" :key="a.id" class="alert-chip">
            <span class="alert-icon">⚠</span>
            <span class="alert-label">{{ a.label }}</span>
          </div>
        </div>

        <div class="sidebar-section stats-grid">
          <div class="stat-box"><div class="stat-val">{{ nodes.length }}</div><div class="stat-lbl">Nodes</div></div>
          <div class="stat-box"><div class="stat-val">{{ edges.length }}</div><div class="stat-lbl">Edges</div></div>
          <div class="stat-box"><div class="stat-val">{{ entityNodes.length }}</div><div class="stat-lbl">Entities</div></div>
          <div class="stat-box"><div class="stat-val">{{ txnNodes.length }}</div><div class="stat-lbl">Transactions</div></div>
        </div>
      </div>
    </aside>

    <!-- Main -->
    <div class="aml-main">
      <!-- Tabs -->
      <div class="tab-bar">
        <button v-for="tab in TABS" :key="tab.id" class="tab-btn" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">
          {{ tab.label }}
        </button>
        <router-link to="/projects?industry=aml" class="projects-badge">Open in Projects →</router-link>
      </div>

      <div class="tab-content">
        <!-- Tab 1: Transaction Graph -->
        <div v-show="activeTab === 'graph'" class="chart-wrap">
          <div id="aml-graph" style="width:100%;height:100%"></div>
        </div>

        <!-- Tab 2: Risk Embedding -->
        <div v-show="activeTab === 'embed'" class="chart-wrap">
          <div id="aml-embed" style="width:100%;height:100%"></div>
        </div>

        <!-- Tab 3: Alert Feed -->
        <div v-show="activeTab === 'alerts'" class="alerts-panel">
          <div class="alerts-header">
            <span class="alerts-title">Active Alerts</span>
            <span class="badge badge-red">{{ allAlerts.length }} alerts</span>
          </div>
          <div class="alerts-list">
            <div v-for="alert in allAlerts" :key="alert.id" class="alert-row" :class="alert.severity">
              <div class="alert-row-top">
                <span class="alert-sev-badge" :class="alert.severity">{{ alert.severity.toUpperCase() }}</span>
                <span class="alert-row-title">{{ alert.title }}</span>
                <span class="alert-row-time text-secondary">{{ alert.time }}</span>
              </div>
              <div class="alert-row-desc text-secondary">{{ alert.description }}</div>
              <div class="alert-row-flags">
                <span v-for="f in alert.flags" :key="f" class="flag-tag">{{ f }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 4: Ring Detector -->
        <div v-show="activeTab === 'rings'" class="rings-panel">
          <div class="rings-header">
            <span class="rings-title">Cycle Detection (DFS)</span>
            <button class="btn btn-sm" @click="detectCycles">Run Detection</button>
          </div>
          <div v-if="cycles.length === 0 && cyclesRun" class="no-cycles text-secondary">No cycles detected in current graph.</div>
          <div v-for="(cycle, ci) in cycles" :key="ci" class="cycle-card">
            <div class="cycle-header">
              <span class="badge badge-red">Cycle {{ ci + 1 }}</span>
              <span class="text-secondary" style="font-size:12px">{{ cycle.length }} nodes</span>
            </div>
            <div class="cycle-nodes">
              <span v-for="(node, ni) in cycle" :key="ni" class="cycle-node">
                {{ node }}<span v-if="ni < cycle.length - 1" class="cycle-arrow"> → </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail panel -->
    <aside class="aml-detail panel">
      <div class="panel-header"><span class="panel-title">Selected Node</span></div>
      <div v-if="!selected" class="detail-empty text-secondary">Click a node in the graph</div>
      <div v-else class="detail-body">
        <div class="detail-name">{{ selected.label }}</div>
        <div class="detail-cat">
          <span class="legend-dot" :style="{ background: CAT_COLORS[selected.category] }"></span>
          {{ categories[selected.category] }}
        </div>
        <div class="sidebar-label" style="margin-top:12px">Connections</div>
        <div v-for="conn in selectedConnections" :key="conn.id" class="conn-row">
          <span class="conn-dir">{{ conn.dir }}</span>
          <span class="conn-label">{{ conn.label }}</span>
          <span class="conn-rel badge" style="font-size:10px">{{ conn.rel }}</span>
        </div>
        <div v-if="selected.category === 1" class="risk-meter">
          <div class="sidebar-label" style="margin-top:12px">Risk Score</div>
          <div class="risk-bar-wrap">
            <div class="risk-bar" :style="{ width: (selectedRisk * 100) + '%', background: riskColor(selectedRisk) }"></div>
          </div>
          <div class="risk-val">{{ (selectedRisk * 100).toFixed(0) }}%</div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'

const CAT_COLORS = ['#f44336','#ff9800','#2196f3','#e91e63','#9c27b0']
const TABS = [
  { id: 'graph',  label: 'Transaction Graph' },
  { id: 'embed',  label: 'Risk Embedding' },
  { id: 'alerts', label: 'Alert Feed' },
  { id: 'rings',  label: 'Ring Detector' },
]

const templates = ref(['aml-ring', 'aml-layering'])
const activeTemplate = ref('aml-ring')
const activeTab = ref('graph')
const nodes = ref<any[]>([])
const edges = ref<any[]>([])
const categories = ref<string[]>([])
const vectors = ref<any[]>([])
const selected = ref<any>(null)
const cycles = ref<string[][]>([])
const cyclesRun = ref(false)

let graphChart: echarts.ECharts | null = null
let embedChart: echarts.ECharts | null = null

function templateLabel(t: string) {
  const m: Record<string,string> = {
    'aml-ring': 'Circular Ring Flow',
    'aml-layering': 'Shell Layering Chain',
  }
  return m[t] ?? t
}

async function loadTemplate(t: string) {
  activeTemplate.value = t
  cycles.value = []
  cyclesRun.value = false
  try {
    const res = await fetch(`/api/aml/graph/${t}`)
    const data = await res.json()
    nodes.value = data.nodes ?? []
    edges.value = data.edges ?? []
    categories.value = data.categories ?? []
    vectors.value = data.vectors ?? []
    await nextTick()
    renderGraph()
    renderEmbed()
  } catch {
    loadFallback(t)
  }
}

function loadFallback(t: string) {
  categories.value = ['Entity','Account','Transaction','Alert','Jurisdiction']
  nodes.value = [
    { id:'entity-criminal', label:'Crime Syndicate', category:0, symbolSize:30 },
    { id:'entity-alpha', label:'ShellCo Alpha', category:0, symbolSize:22 },
    { id:'acct-alpha', label:'Alpha Account', category:1, symbolSize:18 },
    { id:'txn-inject', label:'Cash Injection', category:2, symbolSize:16 },
    { id:'alert-ring', label:'Ring Alert', category:3, symbolSize:22 },
    { id:'jur-cayman', label:'Cayman Islands', category:4, symbolSize:16 },
  ]
  edges.value = [
    { source:'entity-criminal', target:'entity-alpha', label:'CONTROLS' },
    { source:'entity-alpha', target:'acct-alpha', label:'OWNS' },
    { source:'acct-alpha', target:'txn-inject', label:'SENDS_TO' },
    { source:'alert-ring', target:'txn-inject', label:'FLAGS' },
    { source:'entity-alpha', target:'jur-cayman', label:'LINKED_TO' },
  ]
  vectors.value = []
  renderGraph()
  renderEmbed()
}

const alertNodes = computed(() => nodes.value.filter(n => n.category === 3))
const entityNodes = computed(() => nodes.value.filter(n => n.category === 0))
const txnNodes = computed(() => nodes.value.filter(n => n.category === 2))

const allAlerts = computed(() => {
  const flagEdges = edges.value.filter(e => e.label === 'FLAGS')
  return flagEdges.map((fe, i) => {
    const alertNode = nodes.value.find(n => n.id === fe.source)
    const txnNode   = nodes.value.find(n => n.id === fe.target)
    const sev = i % 3 === 0 ? 'critical' : i % 3 === 1 ? 'high' : 'medium'
    return {
      id: `${fe.source}-${fe.target}`,
      title: alertNode?.label ?? fe.source,
      severity: sev,
      description: `Flagged transaction: ${txnNode?.label ?? fe.target}`,
      time: `${2 + i}m ago`,
      flags: ['SUSPICIOUS_PATTERN', sev === 'critical' ? 'LARGE_AMOUNT' : 'CROSS_BORDER'],
    }
  })
})

const selectedConnections = computed(() => {
  if (!selected.value) return []
  const id = selected.value.id
  return edges.value
    .filter(e => e.source === id || e.target === id)
    .map(e => {
      const otherId = e.source === id ? e.target : e.source
      const other = nodes.value.find(n => n.id === otherId)
      return { id: otherId, label: other?.label ?? otherId, dir: e.source === id ? '→' : '←', rel: e.label }
    })
})

const selectedRisk = computed(() => {
  if (!selected.value) return 0
  const vec = vectors.value.find(v => v.id === selected.value.id)
  return vec?.score ?? 0.5
})

function riskColor(r: number) {
  if (r > 0.7) return '#f44336'
  if (r > 0.4) return '#ff9800'
  return '#4caf50'
}

function detectCycles() {
  cyclesRun.value = true
  const adj: Map<string, string[]> = new Map()
  for (const n of nodes.value) adj.set(n.id, [])
  for (const e of edges.value) {
    adj.get(e.source)?.push(e.target)
  }
  const found: string[][] = []
  const visited = new Set<string>()
  const stack: string[] = []
  const inStack = new Set<string>()

  function dfs(node: string) {
    visited.add(node)
    stack.push(node)
    inStack.add(node)
    for (const nb of adj.get(node) ?? []) {
      if (inStack.has(nb)) {
        const startIdx = stack.indexOf(nb)
        found.push([...stack.slice(startIdx), nb])
      } else if (!visited.has(nb)) {
        dfs(nb)
      }
    }
    stack.pop()
    inStack.delete(node)
  }

  for (const n of nodes.value) {
    if (!visited.has(n.id)) dfs(n.id)
  }
  cycles.value = found.map(c => c.map(id => nodes.value.find(n => n.id === id)?.label ?? id))
}

function renderGraph() {
  const el = document.getElementById('aml-graph')
  if (!el) return
  if (!graphChart) graphChart = echarts.init(el, 'dark')

  const edgeColorMap: Record<string,string> = {
    CONTROLS: '#f44336', OWNS: '#ff9800', SENDS_TO: '#2196f3',
    RECEIVES_FROM: '#03a9f4', FLAGS: '#e91e63', LINKED_TO: '#9c27b0',
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
        lineStyle: { color: edgeColorMap[e.label] ?? '#555', width: e.label === 'FLAGS' ? 2 : 1,
          type: e.label === 'FLAGS' ? 'dashed' : 'solid' },
      })),
      force: { repulsion: 200, edgeLength: [80, 180] },
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
  const el = document.getElementById('aml-embed')
  if (!el) return
  if (!embedChart) embedChart = echarts.init(el, 'dark')

  const series = categories.value.map((name, i) => ({
    name,
    type: 'scatter',
    symbolSize: 12,
    itemStyle: { color: CAT_COLORS[i] },
    data: vectors.value.filter(v => {
      const node = nodes.value.find(n => n.id === v.id)
      return node?.category === i
    }).map(v => ({
      value: [v.x, v.y],
      name: v.label,
      riskScore: v.score,
    })),
  }))

  embedChart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      formatter: (p: any) => `${p.data.name}<br/>Risk: ${((p.data.riskScore ?? 0) * 100).toFixed(0)}%`
    },
    legend: { data: categories.value, textStyle: { color: '#ccc' }, bottom: 8 },
    xAxis: { name: 'Transaction Velocity', nameTextStyle: { color: '#888' }, axisLabel: { color: '#888' }, splitLine: { lineStyle: { color: '#333' } } },
    yAxis: { name: 'Jurisdiction Risk', nameTextStyle: { color: '#888' }, axisLabel: { color: '#888' }, splitLine: { lineStyle: { color: '#333' } } },
    series,
  })
}

onMounted(async () => {
  await nextTick()
  await loadTemplate('aml-ring')
})

watch(activeTab, async (tab) => {
  await nextTick()
  if (tab === 'graph') { graphChart?.resize(); renderGraph() }
  if (tab === 'embed') { embedChart?.resize(); renderEmbed() }
})

onUnmounted(() => {
  graphChart?.dispose()
  embedChart?.dispose()
})
</script>

<style scoped>
.aml-explorer { display: flex; height: 100%; overflow: hidden; }
.aml-sidebar { width: 200px; flex-shrink: 0; display: flex; flex-direction: column; overflow-y: auto; }
.aml-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.aml-detail { width: 220px; flex-shrink: 0; overflow-y: auto; }

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

.alert-chip { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 4px 6px;
  background: rgba(244,67,54,.15); border-radius: 4px; border: 1px solid rgba(244,67,54,.3); }
.alert-icon { color: #f44336; font-size: 14px; }
.alert-label { color: #ffcdd2; }

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

.alerts-panel { padding: 16px; height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.alerts-header { display: flex; align-items: center; gap: 10px; }
.alerts-title { font-size: 14px; font-weight: 600; }
.alerts-list { display: flex; flex-direction: column; gap: 10px; }
.alert-row { padding: 12px; border-radius: 6px; background: var(--bg-panel); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 6px; }
.alert-row.critical { border-color: rgba(244,67,54,.4); background: rgba(244,67,54,.05); }
.alert-row.high { border-color: rgba(255,152,0,.4); background: rgba(255,152,0,.05); }
.alert-row-top { display: flex; align-items: center; gap: 10px; }
.alert-sev-badge { font-size: 10px; padding: 2px 6px; border-radius: 3px; font-weight: 700; }
.alert-sev-badge.critical { background: rgba(244,67,54,.3); color: #ff8a80; }
.alert-sev-badge.high { background: rgba(255,152,0,.3); color: #ffcc80; }
.alert-sev-badge.medium { background: rgba(255,235,59,.3); color: #fff176; }
.alert-row-title { font-size: 13px; font-weight: 500; flex: 1; }
.alert-row-desc { font-size: 12px; }
.alert-row-flags { display: flex; gap: 6px; flex-wrap: wrap; }
.flag-tag { font-size: 10px; padding: 2px 6px; border-radius: 3px; background: rgba(87,148,242,.15); color: var(--accent); }

.rings-panel { padding: 16px; height: 100%; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.rings-header { display: flex; align-items: center; gap: 12px; }
.rings-title { font-size: 14px; font-weight: 600; }
.btn-sm { font-size: 12px; padding: 4px 10px; }
.no-cycles { padding: 20px; text-align: center; }
.cycle-card { background: var(--bg-panel); border: 1px solid rgba(244,67,54,.3); border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.cycle-header { display: flex; align-items: center; gap: 10px; }
.cycle-nodes { font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
.cycle-node { color: var(--text-primary); }
.cycle-arrow { color: #f44336; }

.detail-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.detail-empty { padding: 20px; font-size: 12px; text-align: center; }
.detail-name { font-size: 14px; font-weight: 600; }
.detail-cat { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); }
.conn-row { display: flex; align-items: center; gap: 6px; font-size: 12px; padding: 4px 0; border-bottom: 1px solid var(--border); }
.conn-dir { color: var(--accent); font-weight: 700; width: 16px; }
.conn-label { flex: 1; }
.risk-meter { display: flex; flex-direction: column; gap: 6px; }
.risk-bar-wrap { height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }
.risk-bar { height: 100%; transition: width 0.3s; }
.risk-val { font-size: 13px; font-weight: 600; }

.badge-red { background: rgba(244,67,54,.2); color: #ff8a80; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
</style>

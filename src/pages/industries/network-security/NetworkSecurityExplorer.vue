<template>
  <div class="netsec-layout">
    <!-- Left sidebar: controls + zones + events -->
    <aside class="netsec-sidebar">
      <!-- Dataset toggle -->
      <div class="panel">
        <div class="panel-header"><span class="panel-title">Dataset</span></div>
        <div style="padding:10px;display:flex;flex-direction:column;gap:6px">
          <button
            v-for="ds in DATASETS"
            :key="ds.id"
            class="btn"
            :class="{ 'btn-active': dataset === ds.id }"
            style="justify-content:flex-start;gap:8px;font-size:12px"
            @click="switchDataset(ds.id)"
          >
            <span :style="{ color: ds.color }">●</span>
            {{ ds.label }}
          </button>
        </div>
      </div>

      <!-- Zone summary -->
      <div class="panel">
        <div class="panel-header"><span class="panel-title">Zone Summary</span></div>
        <div style="padding:10px;display:flex;flex-direction:column;gap:5px">
          <div v-for="cat in activeCategories" :key="cat.name" class="zone-row">
            <span class="zone-dot" :style="{ background: cat.color }"></span>
            <span class="zone-name">{{ cat.label }}</span>
            <span class="zone-count badge" :style="{ background: cat.color + '22', color: cat.color }">
              {{ nodeCountByCategory(cat.index) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Security events -->
      <div class="panel" style="flex:1;min-height:0;display:flex;flex-direction:column">
        <div class="panel-header">
          <span class="panel-title">Security Events</span>
          <span v-if="dataset === 'network_security'" class="badge badge-red" style="font-size:9px">LIVE</span>
        </div>
        <div style="padding:10px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:4px">
          <template v-if="securityEvents.length">
            <div
              v-for="(ev, i) in securityEvents"
              :key="i"
              class="event-row"
              :class="'sev-' + ev.severity"
              @click="highlightEdge(ev)"
            >
              <span class="event-sev" :class="'sev-badge-' + ev.severity">{{ ev.severity }}</span>
              <div style="flex:1;min-width:0">
                <div class="event-label">{{ ev.label }}</div>
                <div class="event-path text-secondary">{{ ev.source }} → {{ ev.target }}</div>
              </div>
            </div>
          </template>
          <div v-else class="text-secondary" style="font-size:12px;padding:4px 0">
            No attack-path events in this dataset
          </div>
        </div>
      </div>
    </aside>

    <!-- Main graph -->
    <div class="netsec-main">
      <div class="panel" style="height:100%;display:flex;flex-direction:column">
        <div class="panel-header" style="gap:12px">
          <span class="panel-title">{{ activeDatasetLabel }} — Attack Graph</span>
          <div style="display:flex;gap:6px;margin-left:auto;align-items:center">
            <label class="ctrl-check">
              <input type="checkbox" v-model="showLabels" @change="rebuildChart" />
              Labels
            </label>
            <label class="ctrl-check">
              <input type="checkbox" v-model="showEdgeLabels" @change="rebuildChart" />
              Edge labels
            </label>
            <button class="btn" style="font-size:11px" @click="resetZoom">Reset</button>
            <router-link to="/projects?industry=network-security" class="projects-badge">Open in Projects →</router-link>
          </div>
        </div>

        <!-- Selected node info strip -->
        <div v-if="selected" class="sel-strip">
          <span class="sel-dot" :style="{ background: categoryColor(selected.category) }"></span>
          <strong style="color:var(--text-primary)">{{ selected.label }}</strong>
          <span class="text-secondary" style="font-size:12px">
            {{ activeCategories[selected.category]?.label ?? 'Unknown' }}
          </span>
          <span class="badge" style="margin-left:auto">value {{ selected.value }}</span>
          <button class="btn" style="font-size:10px;padding:2px 6px" @click="selected = null">✕</button>
        </div>

        <div ref="chartEl" style="flex:1;min-height:0"></div>
      </div>
    </div>

    <!-- Right panel: edge legend + top nodes -->
    <aside class="netsec-right">
      <!-- Edge type legend -->
      <div class="panel">
        <div class="panel-header"><span class="panel-title">Edge Types</span></div>
        <div style="padding:10px;display:flex;flex-direction:column;gap:5px">
          <div v-for="(color, lbl) in edgeLegend" :key="lbl" class="edge-legend-row">
            <span class="edge-line" :style="{ background: color }"></span>
            <span style="font-size:11px;color:var(--text-secondary)">{{ lbl }}</span>
          </div>
        </div>
      </div>

      <!-- Top nodes by degree -->
      <div class="panel">
        <div class="panel-header"><span class="panel-title">Top Hubs</span></div>
        <div style="padding:10px;display:flex;flex-direction:column;gap:6px">
          <div v-for="(hub, i) in topHubs" :key="hub.id" class="hub-row">
            <span class="hub-rank text-muted">#{{ i + 1 }}</span>
            <span class="hub-dot" :style="{ background: categoryColor(hub.category) }"></span>
            <span class="hub-name" :title="hub.label">{{ hub.label }}</span>
            <span class="hub-deg text-secondary">{{ hub.degree }}</span>
            <div class="hub-bar-wrap">
              <div class="hub-bar" :style="{ width: (hub.degree / maxDegree * 100) + '%', background: categoryColor(hub.category) }"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Threat path tracer -->
      <div v-if="dataset === 'network_security'" class="panel">
        <div class="panel-header"><span class="panel-title">Path Tracer</span></div>
        <div style="padding:10px;display:flex;flex-direction:column;gap:8px">
          <select v-model="pathFrom" class="input-ctrl" style="font-size:11px">
            <option value="">From node…</option>
            <option v-for="n in graphData.nodes" :key="n.id" :value="n.id">{{ n.label }}</option>
          </select>
          <select v-model="pathTo" class="input-ctrl" style="font-size:11px">
            <option value="">To node…</option>
            <option v-for="n in graphData.nodes" :key="n.id" :value="n.id">{{ n.label }}</option>
          </select>
          <button class="btn btn-primary" style="font-size:11px" :disabled="!pathFrom || !pathTo" @click="tracePath">
            Trace Path
          </button>
          <div v-if="pathResult.length" class="path-result">
            <div v-for="(hop, i) in pathResult" :key="i" class="path-hop">
              <span class="path-node">{{ hop }}</span>
              <span v-if="i < pathResult.length - 1" class="path-arrow text-muted">→</span>
            </div>
          </div>
          <div v-else-if="pathSearched" class="text-secondary" style="font-size:11px">No path found</div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { usePrismAPI } from '@/composables/usePrismAPI'

const { getScenarioGraph } = usePrismAPI()

// ── Dataset definitions ───────────────────────────────────────────────────────

interface CatDef { name: string; label: string; color: string; index: number }

const NET_SEC_CATS: CatDef[] = [
  { name: 'attacker',       label: 'Attacker',       color: '#f2495c', index: 0 },
  { name: 'infrastructure', label: 'Infrastructure',  color: '#ff9830', index: 1 },
  { name: 'firewall',       label: 'Firewall',        color: '#fade2a', index: 2 },
  { name: 'server',         label: 'Server',          color: '#5794f2', index: 3 },
  { name: 'monitoring',     label: 'Monitoring',      color: '#73bf69', index: 4 },
  { name: 'endpoint',       label: 'Endpoint',        color: '#19dde2', index: 5 },
]

const NET_TOPO_CATS: CatDef[] = [
  { name: 'core',       label: 'Core Router',  color: '#f2495c', index: 0 },
  { name: 'edge',       label: 'Edge Router',  color: '#ff9830', index: 1 },
  { name: 'peering',    label: 'Peering/AS',   color: '#b877d9', index: 2 },
  { name: 'ix',         label: 'Internet Exchange', color: '#fade2a', index: 3 },
  { name: 'datacenter', label: 'Datacenter',   color: '#5794f2', index: 4 },
]

const DATASETS = [
  { id: 'network_security', label: 'Network Security', color: '#f2495c' },
  { id: 'network_topology', label: 'Network Topology', color: '#5794f2' },
]

// ── High-risk edge labels for the events panel ────────────────────────────────
const THREAT_LABELS: Record<string, { severity: 'critical' | 'high' | 'medium' }> = {
  EXPLOIT:    { severity: 'critical' },
  BYPASS:     { severity: 'critical' },
  PRIV_ESC:   { severity: 'critical' },
  DATA_EXFIL: { severity: 'critical' },
  PIVOT:      { severity: 'high' },
  LATERAL:    { severity: 'high' },
  PHISHING:   { severity: 'high' },
  CONTROL:    { severity: 'high' },
  ALERT:      { severity: 'medium' },
}

// ── Edge color map ────────────────────────────────────────────────────────────
const EDGE_COLORS: Record<string, string> = {
  // attack
  EXPLOIT:    '#f2495c',
  BYPASS:     '#f2495c',
  PRIV_ESC:   '#f2495c',
  DATA_EXFIL: '#f2495c',
  PIVOT:      '#ff9830',
  LATERAL:    '#ff9830',
  PHISHING:   '#ff9830',
  CONTROL:    '#ff9830',
  ALERT:      '#fade2a',
  // neutral
  ALLOW:      '#73bf69',
  FILTER:     '#73bf69',
  INSPECT:    '#73bf69',
  SEGMENT:    '#73bf69',
  // info
  AUTHN:      '#5794f2',
  QUERY:      '#5794f2',
  LDAP:       '#5794f2',
  REPLICATE:  '#19dde2',
  FORWARD:    '#19dde2',
  DELIVER:    '#19dde2',
  GPO:        '#b877d9',
  TUNE:       '#b877d9',
  // topology
  iBGP:    '#5794f2',
  eBGP:    '#ff9830',
  ISIS:    '#19dde2',
  MPLS:    '#b877d9',
  ECMP:    '#73bf69',
  PEER:    '#fade2a',
  TRANSIT: '#f2495c',
  MGMT:    '#73bf69',
}

// ── State ─────────────────────────────────────────────────────────────────────
const dataset  = ref<'network_security' | 'network_topology'>('network_security')
const graphData = ref<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] })
const selected  = ref<any>(null)
const showLabels      = ref(true)
const showEdgeLabels  = ref(false)
const pathFrom   = ref('')
const pathTo     = ref('')
const pathResult = ref<string[]>([])
const pathSearched = ref(false)

const chartEl = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

// ── Derived ───────────────────────────────────────────────────────────────────
const activeCategories = computed<CatDef[]>(() =>
  dataset.value === 'network_security' ? NET_SEC_CATS : NET_TOPO_CATS,
)

const activeDatasetLabel = computed(() =>
  DATASETS.find(d => d.id === dataset.value)?.label ?? '',
)

function categoryColor(idx: number): string {
  return activeCategories.value[idx]?.color ?? '#aaa'
}

function nodeCountByCategory(idx: number): number {
  return graphData.value.nodes.filter(n => n.category === idx).length
}

const securityEvents = computed(() => {
  if (dataset.value !== 'network_security') return []
  return graphData.value.edges
    .filter(e => e.label in THREAT_LABELS)
    .map(e => ({
      label: e.label,
      source: e.source,
      target: e.target,
      severity: THREAT_LABELS[e.label].severity,
    }))
    .sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2 }
      return order[a.severity] - order[b.severity]
    })
})

// Degree centrality
const topHubs = computed(() => {
  const deg: Record<string, number> = {}
  graphData.value.nodes.forEach(n => { deg[n.id] = 0 })
  graphData.value.edges.forEach(e => {
    deg[e.source] = (deg[e.source] ?? 0) + 1
    deg[e.target] = (deg[e.target] ?? 0) + 1
  })
  return graphData.value.nodes
    .map(n => ({ ...n, degree: deg[n.id] ?? 0 }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 8)
})

const maxDegree = computed(() => Math.max(1, ...topHubs.value.map(h => h.degree)))

// Edge legend: unique labels present in current graph
const edgeLegend = computed<Record<string, string>>(() => {
  const seen = new Set<string>()
  const result: Record<string, string> = {}
  graphData.value.edges.forEach(e => {
    if (!seen.has(e.label)) {
      seen.add(e.label)
      result[e.label] = EDGE_COLORS[e.label] ?? '#888'
    }
  })
  return result
})

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadGraph() {
  const res = await getScenarioGraph(dataset.value) as any
  if (!res) return
  graphData.value = { nodes: res.nodes ?? [], edges: res.edges ?? [] }
  pathFrom.value = ''
  pathTo.value = ''
  pathResult.value = []
  pathSearched.value = false
  selected.value = null
  rebuildChart()
}

// ── ECharts ───────────────────────────────────────────────────────────────────
function buildOption() {
  const cats = activeCategories.value
  const nodes = graphData.value.nodes.map(n => ({
    id: n.id,
    name: n.label,
    category: n.category,
    value: n.value,
    symbolSize: n.symbolSize ?? n.symbol_size ?? 24,
    itemStyle: {
      color: cats[n.category]?.color ?? '#888',
      borderColor: selected.value?.id === n.id ? '#fff' : 'transparent',
      borderWidth: selected.value?.id === n.id ? 2 : 0,
      shadowBlur: selected.value?.id === n.id ? 10 : 0,
      shadowColor: selected.value?.id === n.id ? '#fff4' : 'transparent',
    },
    label: { show: showLabels.value, fontSize: 11, color: '#ccc' },
  }))

  const edges = graphData.value.edges.map(e => ({
    source: e.source,
    target: e.target,
    value: e.weight ?? 1,
    lineStyle: {
      color: EDGE_COLORS[e.label] ?? '#555',
      width: Math.max(1, (e.weight ?? 1) * 0.5),
      opacity: 0.7,
    },
    label: {
      show: showEdgeLabels.value,
      formatter: e.label,
      fontSize: 9,
      color: '#aaa',
    },
  }))

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const cat = cats[params.data.category]?.label ?? 'Unknown'
          return `<strong>${params.data.name}</strong><br/>Category: ${cat}<br/>Value: ${params.data.value}`
        }
        const edge = graphData.value.edges[params.dataIndex]
        return edge ? `${edge.source} → ${edge.target}<br/><strong>${edge.label}</strong> (w=${edge.weight})` : ''
      },
    },
    legend: { show: false },
    series: [{
      type: 'graph',
      layout: 'force',
      data: nodes,
      links: edges,
      categories: cats.map(c => ({ name: c.label, itemStyle: { color: c.color } })),
      roam: true,
      draggable: true,
      force: {
        repulsion: 220,
        edgeLength: [80, 160],
        gravity: 0.08,
        layoutAnimation: true,
      },
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: 8,
      emphasis: {
        focus: 'adjacency',
        lineStyle: { width: 3 },
      },
    }],
  }
}

function rebuildChart() {
  if (!chart) return
  chart.setOption(buildOption(), true)
}

function resetZoom() {
  chart?.dispatchAction({ type: 'restore' })
}

function highlightEdge(ev: any) {
  const node = graphData.value.nodes.find(n => n.id === ev.source || n.id === ev.target)
  if (node) selected.value = node
  rebuildChart()
}

// Simple BFS path tracer (client-side)
function tracePath() {
  pathSearched.value = true
  if (pathFrom.value === pathTo.value) {
    pathResult.value = [pathFrom.value]
    return
  }
  const adj: Record<string, string[]> = {}
  graphData.value.nodes.forEach(n => { adj[n.id] = [] })
  graphData.value.edges.forEach(e => {
    adj[e.source]?.push(e.target)
    adj[e.target]?.push(e.source) // undirected for tracing
  })

  const queue: string[][] = [[pathFrom.value]]
  const visited = new Set<string>([pathFrom.value])
  while (queue.length) {
    const path = queue.shift()!
    const cur = path[path.length - 1]
    if (cur === pathTo.value) { pathResult.value = path; return }
    for (const nb of (adj[cur] ?? [])) {
      if (!visited.has(nb)) {
        visited.add(nb)
        queue.push([...path, nb])
      }
    }
  }
  pathResult.value = []
}

function switchDataset(id: 'network_security' | 'network_topology') {
  if (dataset.value === id) return
  dataset.value = id
  loadGraph()
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  await nextTick()
  if (chartEl.value) {
    chart = echarts.init(chartEl.value, 'dark')
    chart.on('click', (params: any) => {
      if (params.dataType === 'node') {
        const node = graphData.value.nodes.find(n => n.id === params.data.id)
        selected.value = node ?? null
        rebuildChart()
      }
    })
  }
  await loadGraph()
  window.addEventListener('resize', () => chart?.resize())
})

onUnmounted(() => {
  chart?.dispose()
  window.removeEventListener('resize', () => chart?.resize())
})

watch(showLabels, rebuildChart)
watch(showEdgeLabels, rebuildChart)
</script>

<style scoped>
.netsec-layout {
  display: grid;
  grid-template-columns: 200px 1fr 200px;
  gap: 10px;
  height: 100%;
  overflow: hidden;
}

.netsec-sidebar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.netsec-main {
  min-width: 0;
  height: 100%;
}

.netsec-right {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

/* Zone summary */
.zone-row {
  display: flex;
  align-items: center;
  gap: 7px;
}
.zone-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
}
.zone-name {
  font-size: 11px;
  color: var(--text-secondary);
  flex: 1;
}
.zone-count {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 10px;
}

/* Security events */
.event-row {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 5px 7px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}
.event-row:hover { background: rgba(255,255,255,0.05); }
.event-sev {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 2px 4px;
  border-radius: 3px;
  flex-shrink: 0;
  margin-top: 1px;
}
.sev-badge-critical { background: rgba(242,73,92,0.2); color: #f2495c; }
.sev-badge-high     { background: rgba(255,152,48,0.2); color: #ff9830; }
.sev-badge-medium   { background: rgba(250,222,42,0.2); color: #fade2a; }
.event-label {
  font-size: 11px;
  color: var(--text-primary);
  font-weight: 600;
}
.event-path {
  font-size: 10px;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Selected strip */
.sel-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.sel-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Edge legend */
.edge-legend-row {
  display: flex;
  align-items: center;
  gap: 7px;
}
.edge-line {
  display: inline-block;
  width: 22px;
  height: 2px;
  border-radius: 1px;
  flex-shrink: 0;
}

/* Hub rows */
.hub-row {
  display: flex;
  align-items: center;
  gap: 5px;
}
.hub-rank  { font-size: 10px; width: 18px; flex-shrink: 0; }
.hub-dot   { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.hub-name  { font-size: 11px; color: var(--text-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hub-deg   { font-size: 10px; flex-shrink: 0; }
.hub-bar-wrap { width: 30px; height: 4px; background: var(--bg-secondary); border-radius: 2px; flex-shrink: 0; }
.hub-bar      { height: 4px; border-radius: 2px; transition: width 0.3s; }

/* Path tracer */
.path-result {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 4px;
}
.path-hop { display: flex; align-items: center; gap: 3px; }
.path-node {
  font-size: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  padding: 2px 5px;
  border-radius: 3px;
  color: var(--text-primary);
}
.path-arrow { font-size: 10px; }

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

/* Active dataset button */
.btn-active {
  background: rgba(87,148,242,0.12);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

/* Controls */
.ctrl-check {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
}
.ctrl-check input { cursor: pointer; }
.input-ctrl {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: 4px;
  padding: 4px 6px;
  width: 100%;
}
.input-ctrl:focus { outline: none; border-color: var(--accent-blue); }
</style>

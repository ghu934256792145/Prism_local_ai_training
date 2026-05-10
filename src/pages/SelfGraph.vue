<template>
  <div class="self-page">

    <!-- Header bar -->
    <div class="sg-header panel">
      <div class="sg-title-block">
        <span class="sg-title">App Brain</span>
        <span class="sg-sub">Live architecture — pages · composables · stores · API routes · engine modules</span>
      </div>
      <div class="sg-metrics">
        <div v-for="cat in CAT_META" :key="cat.name" class="metric-chip">
          <span class="metric-dot" :style="{ background: cat.color }"></span>
          <span class="metric-label">{{ cat.name }}</span>
          <span class="metric-val">{{ nodesByCategory(cat.index).length }}</span>
        </div>
        <div class="metric-chip metric-sep">
          <span class="metric-label">Nodes</span>
          <span class="metric-val">{{ graph.nodes.length }}</span>
        </div>
        <div class="metric-chip">
          <span class="metric-label">Edges</span>
          <span class="metric-val">{{ graph.edges.length }}</span>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <span class="ws-badge" :class="wsConnected ? 'ws-live' : 'ws-off'" :title="wsConnected ? 'WebSocket live' : 'WebSocket offline'">
          {{ wsConnected ? '⬤ live' : '○ off' }}
        </span>
        <button class="btn btn-primary" @click="loadGraph" :disabled="loading">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.08-4.64"/></svg>
          {{ loading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </div>

    <!-- Call count ribbon -->
    <div v-if="callCounts" class="call-ribbon panel">
      <span class="call-ribbon-label">API calls since start:</span>
      <span v-for="(val, key) in callCounts" :key="key" class="call-chip">
        <span class="call-key">/{{ key }}</span>
        <span class="call-val">{{ val }}</span>
      </span>
    </div>

    <!-- Body -->
    <div class="sg-body">

      <!-- Graph canvas -->
      <div class="sg-canvas panel">
        <div ref="chartEl" class="sg-chart" />
        <!-- Tier labels -->
        <div class="tier-labels">
          <span v-for="cat in CAT_META" :key="cat.name" class="tier-label" :style="{ color: cat.color }">
            {{ cat.name }}
          </span>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="sg-sidebar">

        <!-- Node detail -->
        <div class="panel sg-detail">
          <div class="panel-header"><span class="panel-title">Node Detail</span></div>
          <div style="padding:10px 12px">
            <template v-if="selectedNode">
              <div class="detail-row">
                <span class="text-muted">ID</span>
                <span class="mono" style="font-size:11px;color:var(--accent-blue)">{{ selectedNode.id }}</span>
              </div>
              <div class="detail-row">
                <span class="text-muted">Label</span>
                <span style="font-size:12px">{{ selectedNode.label }}</span>
              </div>
              <div class="detail-row">
                <span class="text-muted">Layer</span>
                <span class="cat-badge" :style="catBadgeStyle(selectedNode.category)">
                  {{ CAT_META[selectedNode.category]?.name }}
                </span>
              </div>
              <div v-if="selectedNode.category === 3" class="detail-row">
                <span class="text-muted">API calls</span>
                <span class="mono" style="color:#ff9830;font-size:12px">{{ selectedNode.value }}</span>
              </div>
              <div class="detail-row">
                <span class="text-muted">Degree</span>
                <span>{{ edgesOf(selectedNode.id).length }}</span>
              </div>
              <div class="divider"></div>
              <div style="font-size:10px;color:var(--text-muted);margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em">Connections</div>
              <div
                v-for="e in edgesOf(selectedNode.id)" :key="e.source + e.target"
                class="edge-row"
                @click="selectNodeById(e.source === selectedNode.id ? e.target : e.source)"
              >
                <span class="edge-dir" :class="e.source === selectedNode.id ? 'out' : 'in'">
                  {{ e.source === selectedNode.id ? '→' : '←' }}
                </span>
                <span class="mono edge-peer">{{ e.source === selectedNode.id ? e.target : e.source }}</span>
                <span class="edge-lbl" :style="{ color: EDGE_COLORS[e.label] ?? '#888' }">{{ e.label }}</span>
              </div>
            </template>
            <div v-else class="text-muted" style="font-size:12px">Click a node to inspect</div>
          </div>
        </div>

        <!-- Top hubs -->
        <div class="panel sg-hubs">
          <div class="panel-header"><span class="panel-title">Top Hubs by Degree</span></div>
          <div style="padding:6px 12px;display:flex;flex-direction:column;gap:3px">
            <div
              v-for="hub in topHubs" :key="hub.id"
              class="hub-row"
              :class="{ 'hub-active': selectedNode?.id === hub.id }"
              @click="selectNodeById(hub.id)"
            >
              <span class="hub-dot" :style="{ background: CAT_META[hub.category]?.color }"></span>
              <span class="hub-label mono">{{ hub.id }}</span>
              <span class="hub-bar-wrap">
                <span class="hub-bar" :style="{ width: hub.pct + '%', background: CAT_META[hub.category]?.color }"></span>
              </span>
              <span class="hub-deg">{{ hub.deg }}</span>
            </div>
          </div>
        </div>

        <!-- Edge types -->
        <div class="panel sg-edge-types">
          <div class="panel-header"><span class="panel-title">Edge Types</span></div>
          <div style="padding:6px 12px;display:flex;flex-direction:column;gap:3px">
            <div v-for="et in edgeTypes" :key="et.label" class="et-row">
              <span class="et-dot" :style="{ background: EDGE_COLORS[et.label] ?? '#666' }"></span>
              <span class="mono et-label">{{ et.label }}</span>
              <span class="et-count text-muted">{{ et.count }}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { usePrismAPI, type NodeRecord, type EdgeRecord } from '@/composables/usePrismAPI'
import { useWebSocket } from '@/composables/useWebSocket'

const api = usePrismAPI()

// ── Category metadata ─────────────────────────────────────────────────────────
const CAT_META = [
  { name: 'Page',       color: '#5794f2', index: 0 },
  { name: 'Composable', color: '#19dde2', index: 1 },
  { name: 'Store',      color: '#73bf69', index: 2 },
  { name: 'API Route',  color: '#ff9830', index: 3 },
  { name: 'Engine',     color: '#b877d9', index: 4 },
]

const EDGE_COLORS: Record<string, string> = {
  USES: '#5794f2', CALLS: '#ff9830', BACKED_BY: '#73bf69',
  IMPLEMENTS: '#b877d9', DEPENDS_ON: '#fade2a',
  CONNECTS: '#19dde2', SUBSCRIBES: '#f2495c',
}

// ── State ─────────────────────────────────────────────────────────────────────
interface LiveGraph {
  nodes: NodeRecord[]
  edges: EdgeRecord[]
  categories: string[]
  dataset: string
  callCounts?: Record<string, number>
}

const graph = ref<LiveGraph>({ nodes: [], edges: [], categories: [], dataset: '' })
const callCounts = ref<Record<string, number> | null>(null)
const selectedNode = ref<NodeRecord | null>(null)
const loading = ref(false)
const chartEl = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

// ── Derived ───────────────────────────────────────────────────────────────────
function nodesByCategory(cat: number) { return graph.value.nodes.filter(n => n.category === cat) }
function edgesOf(id: string) { return graph.value.edges.filter(e => e.source === id || e.target === id) }
function totalDegree(id: string) { return edgesOf(id).length }

const topHubs = computed(() => {
  const maxD = Math.max(...graph.value.nodes.map(n => totalDegree(n.id)), 1)
  return [...graph.value.nodes]
    .sort((a, b) => totalDegree(b.id) - totalDegree(a.id))
    .slice(0, 12)
    .map(n => ({ id: n.id, category: n.category, deg: totalDegree(n.id), pct: (totalDegree(n.id) / maxD) * 100 }))
})

const edgeTypes = computed(() => {
  const counts = new Map<string, number>()
  for (const e of graph.value.edges) counts.set(e.label, (counts.get(e.label) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }))
})

function catBadgeStyle(cat: number) {
  const c = CAT_META[cat % CAT_META.length].color
  return { background: c + '22', color: c, border: `1px solid ${c}55`, borderRadius: '3px', padding: '1px 6px', fontSize: '10px' }
}

// ── Tier layout ───────────────────────────────────────────────────────────────
function tierPositions(): Map<string, { x: number; y: number }> {
  const W = 820
  const tiers: NodeRecord[][] = [[], [], [], [], []]
  for (const n of graph.value.nodes) tiers[n.category % 5].push(n)
  const yTiers = [55, 190, 325, 465, 600]
  const pos = new Map<string, { x: number; y: number }>()
  for (let t = 0; t < 5; t++) {
    const row = tiers[t]
    row.forEach((n, i) => {
      pos.set(n.id, { x: ((i + 0.5) / row.length) * W, y: yTiers[t] })
    })
  }
  return pos
}

// ── ECharts ───────────────────────────────────────────────────────────────────
function buildOption(): any {
  const pos = tierPositions()
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (p: any) => {
        if (p.dataType === 'node') {
          const n = p.data._raw as NodeRecord
          const cat = CAT_META[n.category % CAT_META.length]
          const callLine = n.category === 3 ? `<br/><span style="color:#ff9830">calls: ${n.value}</span>` : ''
          return `<b>${n.label}</b><br/><span style="color:${cat.color}">${cat.name}</span><br/>id: <code>${n.id}</code>${callLine}`
        }
        if (p.dataType === 'edge') {
          const e = p.data._raw as EdgeRecord
          const col = EDGE_COLORS[e.label] ?? '#888'
          return `${e.source} → ${e.target}<br/><code style="color:${col}">${e.label}</code>`
        }
        return ''
      },
    },
    series: [{
      type: 'graph',
      layout: 'none',
      roam: true,
      draggable: false,
      animation: false,
      label: { show: true, fontSize: 9, color: '#c0cfe0', position: 'bottom', overflow: 'truncate', width: 80 },
      emphasis: { focus: 'adjacency', lineStyle: { width: 2.5, opacity: 1 }, label: { show: true, fontSize: 10 } },
      nodes: graph.value.nodes.map(n => {
        const p = pos.get(n.id) ?? { x: 400, y: 330 }
        const cat = CAT_META[n.category % CAT_META.length]
        const sel = selectedNode.value?.id === n.id
        return {
          id: n.id,
          name: n.label,
          x: p.x, y: p.y,
          symbolSize: sel ? Math.max(26, n.symbolSize * 1.2) : Math.max(18, n.symbolSize * 0.75),
          itemStyle: {
            color: cat.color,
            borderColor: sel ? '#fff' : cat.color + '99',
            borderWidth: sel ? 2 : 1,
            shadowBlur: sel ? 14 : 0,
            shadowColor: cat.color + '88',
          },
          label: { show: true, fontSize: sel ? 10 : 9, color: sel ? '#fff' : '#b0bec5', fontWeight: sel ? 600 : 400 },
          _raw: n,
        }
      }),
      edges: graph.value.edges.map(e => ({
        source: e.source,
        target: e.target,
        lineStyle: {
          color: EDGE_COLORS[e.label] ?? '#555a6e',
          width: 0.8 + e.weight * 0.25,
          opacity: 0.55,
          curveness: 0.08,
        },
        edgeSymbol: ['none', 'arrow'],
        edgeSymbolSize: 6,
        _raw: e,
      })),
    }],
  }
}

function redraw() { chart?.setOption(buildOption(), { replaceMerge: ['series'] }) }

function selectNodeById(id: string) {
  selectedNode.value = graph.value.nodes.find(n => n.id === id) ?? null
  redraw()
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadGraph() {
  loading.value = true
  const res = await api.getMetaGraph() as any
  if (res) {
    graph.value = res as LiveGraph
    callCounts.value = res.callCounts ?? null
  }
  loading.value = false
  redraw()
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
const { connected: wsConnected } = useWebSocket('/api/ws', () => loadGraph())

// ── Lifecycle ─────────────────────────────────────────────────────────────────
const ro = new ResizeObserver(() => chart?.resize())

onMounted(async () => {
  await loadGraph()
  await nextTick()
  if (chartEl.value) {
    chart = echarts.init(chartEl.value, 'dark')
    chart.on('click', (p: any) => {
      if (p.dataType === 'node') selectNodeById(p.data.id)
    })
    ro.observe(chartEl.value)
    redraw()
  }
})

onUnmounted(() => { ro.disconnect(); chart?.dispose() })
</script>

<style scoped>
.self-page {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: calc(100vh - var(--header-height) - 28px);
}

/* Header */
.sg-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 14px;
  flex-shrink: 0;
}
.sg-title-block { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex-shrink: 0; }
.sg-title { font-size: 14px; font-weight: 700; color: var(--text-primary); letter-spacing: .02em; }
.sg-sub { font-size: 10px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sg-metrics { display: flex; flex-wrap: wrap; gap: 5px; flex: 1; }
.metric-chip {
  display: flex; align-items: center; gap: 4px;
  font-size: 10px; padding: 2px 7px; border-radius: 3px;
  background: rgba(255,255,255,0.04); border: 1px solid var(--border);
  color: var(--text-secondary);
}
.metric-sep { border-left: 1px solid var(--border-hover); }
.metric-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.metric-label { color: var(--text-muted); }
.metric-val { font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); }

/* Call ribbon */
.call-ribbon {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 5px 12px;
  flex-shrink: 0;
}
.call-ribbon-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; margin-right: 4px; }
.call-chip {
  display: flex; gap: 3px; align-items: center;
  font-size: 10px; padding: 2px 6px; border-radius: 3px;
  background: rgba(255,152,48,0.08); border: 1px solid rgba(255,152,48,0.2);
}
.call-key { color: var(--text-muted); }
.call-val { font-family: var(--font-mono); color: #ff9830; font-weight: 600; }

/* WS badges */
.ws-badge {
  font-size: 10px; padding: 2px 7px; border-radius: 3px;
  border: 1px solid; white-space: nowrap;
}
.ws-live { background: rgba(115,191,105,0.15); color: #73bf69; border-color: rgba(115,191,105,0.3); }
.ws-off  { background: rgba(110,110,110,0.1);  color: #888;    border-color: rgba(110,110,110,0.2); }

/* Body */
.sg-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 8px;
  min-height: 0;
}

/* Canvas */
.sg-canvas { position: relative; height: 100%; }
.sg-chart  { width: 100%; height: 100%; }

.tier-labels {
  position: absolute;
  top: 0; bottom: 0; right: 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  pointer-events: none;
}
.tier-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .1em;
  opacity: 0.55;
  writing-mode: vertical-lr;
  transform: rotate(180deg);
  text-align: center;
}

/* Sidebar */
.sg-sidebar { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }

.sg-detail  { flex: 1; overflow-y: auto; }
.sg-hubs    { flex-shrink: 0; }
.sg-edge-types { flex-shrink: 0; }

.detail-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 0; border-bottom: 1px solid var(--border); font-size: 12px;
}
.divider { border-top: 1px solid var(--border); margin: 6px 0; }
.cat-badge { white-space: nowrap; }

.edge-row {
  display: flex; align-items: center; gap: 5px;
  padding: 2px 0; border-bottom: 1px solid var(--border);
  font-size: 10px; cursor: pointer;
}
.edge-row:hover .edge-peer { color: var(--accent-blue); }
.edge-dir { font-weight: 700; min-width: 12px; }
.edge-dir.out { color: var(--accent-blue); }
.edge-dir.in  { color: #73bf69; }
.edge-peer { flex: 1; color: var(--text-secondary); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.edge-lbl  { font-size: 8px; font-family: var(--font-mono); margin-left: auto; flex-shrink: 0; }

.hub-row {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; cursor: pointer; padding: 2px 0;
}
.hub-row:hover .hub-label, .hub-active .hub-label { color: var(--accent-blue); }
.hub-dot   { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.hub-label { flex: 1; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hub-bar-wrap { width: 40px; height: 3px; background: rgba(255,255,255,0.07); border-radius: 2px; flex-shrink: 0; }
.hub-bar   { display: block; height: 100%; border-radius: 2px; min-width: 2px; }
.hub-deg   { color: var(--text-muted); min-width: 16px; text-align: right; }

.et-row { display: flex; align-items: center; gap: 6px; font-size: 10px; }
.et-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.et-label { flex: 1; font-family: var(--font-mono); color: var(--text-secondary); }
.et-count { color: var(--text-muted); }

.mono { font-family: var(--font-mono); }
.text-muted { color: var(--text-muted); }
.text-blue  { color: var(--accent-blue); }
</style>

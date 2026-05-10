<template>
  <div class="eda-shell">
    <!-- Sidebar -->
    <aside class="eda-sidebar">
      <div class="panel-header"><span class="panel-title">Netlist</span></div>
      <div style="padding:8px;display:flex;flex-direction:column;gap:6px">
        <button
          v-for="t in TEMPLATES"
          :key="t.key"
          class="dataset-btn"
          :class="{ active: template === t.key }"
          @click="loadTemplate(t.key)"
        >
          <span style="font-weight:500;font-size:13px">{{ t.label }}</span>
          <span style="font-size:11px;color:var(--text-muted)">{{ t.desc }}</span>
        </button>
      </div>

      <div class="panel-header" style="margin-top:8px"><span class="panel-title">Cell Types</span></div>
      <div style="padding:8px;display:flex;flex-direction:column;gap:5px">
        <div v-for="(cat, i) in categories" :key="i" style="display:flex;align-items:center;gap:7px">
          <span class="dot" :style="{ background: CAT_COLORS[i] ?? '#888' }"></span>
          <span style="font-size:12px">{{ cat }}</span>
        </div>
      </div>

      <div class="panel-header" style="margin-top:8px"><span class="panel-title">Metrics</span></div>
      <div style="padding:8px;display:flex;flex-direction:column;gap:6px">
        <div class="stat-row"><span class="stat-label">Cells</span><span class="stat-val">{{ nodes.length }}</span></div>
        <div class="stat-row"><span class="stat-label">Nets</span><span class="stat-val">{{ edges.length }}</span></div>
        <div class="stat-row"><span class="stat-label">Critical Paths</span><span class="stat-val">{{ criticalPaths.length }}</span></div>
        <div class="stat-row"><span class="stat-label">Max Depth</span><span class="stat-val">{{ maxDepth }}</span></div>
      </div>
    </aside>

    <!-- Main -->
    <div class="eda-main">
      <div class="tab-bar">
        <button v-for="t in TABS" :key="t.key" class="tab-btn" :class="{ active: tab === t.key }" @click="switchTab(t.key)">{{ t.label }}</button>
        <router-link to="/projects?industry=semiconductor" class="projects-badge">Open in Projects →</router-link>
      </div>

      <!-- Netlist graph -->
      <div v-show="tab === 'netlist'" class="tab-content">
        <div ref="netlistEl" class="chart-fill"></div>
      </div>

      <!-- Timing paths -->
      <div v-show="tab === 'timing'" class="tab-content" style="overflow-y:auto;padding:12px">
        <div style="margin-bottom:12px;font-size:12px;color:var(--text-muted)">
          Longest signal paths through combinational logic (estimated gate-count depth)
        </div>
        <div v-for="(path, i) in criticalPaths" :key="i" class="timing-row" @click="highlightPath(path)">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;font-weight:500">Path {{ i + 1 }}</span>
            <span class="badge" :style="{ background: slackColor(path.depth) + '22', color: slackColor(path.depth) }">{{ path.depth }} gates</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">{{ path.nodes.map(id => nodeLabel(id)).join(' → ') }}</div>
        </div>
      </div>

      <!-- Functional embedding -->
      <div v-show="tab === 'embedding'" class="tab-content">
        <div ref="embeddingEl" class="chart-fill"></div>
      </div>

      <!-- Signal trace -->
      <div v-show="tab === 'trace'" class="tab-content" style="padding:12px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:8px;align-items:center">
          <select v-model="traceFrom" class="select-input" style="width:160px">
            <option value="">-- From node --</option>
            <option v-for="n in nodes" :key="n.id" :value="n.id">{{ n.label }}</option>
          </select>
          <span style="color:var(--text-muted)">→</span>
          <select v-model="traceTo" class="select-input" style="width:160px">
            <option value="">-- To node --</option>
            <option v-for="n in nodes" :key="n.id" :value="n.id">{{ n.label }}</option>
          </select>
          <button class="btn" @click="runTrace" :disabled="!traceFrom || !traceTo">Trace</button>
        </div>
        <div v-if="tracePath.length" style="padding:10px;background:var(--bg-input);border-radius:6px;font-size:12px">
          <div style="color:var(--text-muted);margin-bottom:6px">Signal path ({{ tracePath.length - 1 }} hops):</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">
            <template v-for="(id, i) in tracePath" :key="id">
              <span class="gene-tag" style="border-color:#5794f266;color:#5794f2">{{ nodeLabel(id) }}</span>
              <span v-if="i < tracePath.length - 1" style="color:var(--text-muted)">→</span>
            </template>
          </div>
        </div>
        <div v-else-if="traceFrom && traceTo" style="color:var(--text-muted);font-size:12px">No path found between selected nodes.</div>
      </div>
    </div>

    <!-- Detail -->
    <aside class="eda-detail">
      <div class="panel-header"><span class="panel-title">Cell Detail</span></div>
      <div v-if="selected" style="padding:12px;display:flex;flex-direction:column;gap:10px">
        <div><div class="detail-label">Cell</div><div style="font-size:16px;font-weight:700">{{ selected.label }}</div></div>
        <div>
          <div class="detail-label">Type</div>
          <span class="badge" :style="{ background: CAT_COLORS[selected.category] + '22', color: CAT_COLORS[selected.category] }">{{ categories[selected.category] }}</span>
        </div>
        <div>
          <div class="detail-label">Fanout ({{ fanout(selected.id).length }})</div>
          <div style="display:flex;flex-direction:column;gap:3px;margin-top:3px">
            <div v-for="e in fanout(selected.id)" :key="e.target" style="font-size:12px">→ {{ nodeLabel(e.target) }}</div>
          </div>
        </div>
        <div>
          <div class="detail-label">Fanin ({{ fanin(selected.id).length }})</div>
          <div style="display:flex;flex-direction:column;gap:3px;margin-top:3px">
            <div v-for="e in fanin(selected.id)" :key="e.source" style="font-size:12px">← {{ nodeLabel(e.source) }}</div>
          </div>
        </div>
      </div>
      <div v-else style="padding:16px;color:var(--text-muted);font-size:12px">Click a node to inspect.</div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'

const BASE = '/api'

const TEMPLATES = [
  { key: 'alu-4bit',      label: '4-bit ALU',       desc: 'Ripple-carry adder netlist' },
  { key: 'risc-pipeline', label: 'RISC-V Pipeline',  desc: '5-stage IF/ID/EX/MEM/WB' },
]

const CAT_COLORS = ['#888','#5794f2','#19dde2','#ff9830','#73bf69','#fade2a','#b877d9']

const TABS = [
  { key: 'netlist',   label: 'Netlist'       },
  { key: 'timing',    label: 'Timing Paths'  },
  { key: 'embedding', label: 'Similarity'    },
  { key: 'trace',     label: 'Signal Trace'  },
] as const

interface GNode { id: string; label: string; category: number; value: number; symbol_size: number }
interface GEdge { source: string; target: string; label: string; weight: number }
interface GVec  { id: string; label: string; x: number; y: number; cluster: number }

const template  = ref('alu-4bit')
const nodes     = ref<GNode[]>([])
const edges     = ref<GEdge[]>([])
const vectors   = ref<GVec[]>([])
const categories = ref<string[]>([])
const tab       = ref<typeof TABS[number]['key']>('netlist')
const selected  = ref<GNode | null>(null)
const traceFrom = ref('')
const traceTo   = ref('')
const tracePath = ref<string[]>([])

const netlistEl   = ref<HTMLElement | null>(null)
const embeddingEl = ref<HTMLElement | null>(null)
let charts: echarts.ECharts[] = []

function nodeLabel(id: string) { return nodes.value.find(n => n.id === id)?.label ?? id }
function fanout(id: string) { return edges.value.filter(e => e.source === id) }
function fanin(id: string)  { return edges.value.filter(e => e.target === id) }

const criticalPaths = computed(() => {
  // Find 5 longest BFS paths from category-0 (port) inputs
  const inputs = nodes.value.filter(n => n.category === 0 && fanin(n.id).length === 0)
  const adj: Record<string, string[]> = {}
  edges.value.forEach(e => { (adj[e.source] ??= []).push(e.target) })
  const paths: { nodes: string[]; depth: number }[] = []
  for (const start of inputs.slice(0, 4)) {
    const stack: { id: string; path: string[] }[] = [{ id: start.id, path: [start.id] }]
    let best: string[] = [start.id]
    while (stack.length) {
      const { id, path } = stack.pop()!
      if (path.length > best.length) best = path
      for (const nb of (adj[id] ?? [])) {
        if (!path.includes(nb)) stack.push({ id: nb, path: [...path, nb] })
      }
    }
    if (best.length > 1) paths.push({ nodes: best, depth: best.length - 1 })
  }
  return paths.sort((a, b) => b.depth - a.depth).slice(0, 6)
})

const maxDepth = computed(() => Math.max(0, ...criticalPaths.value.map(p => p.depth)))

function slackColor(depth: number) {
  if (depth >= maxDepth.value) return '#f2495c'
  if (depth >= maxDepth.value * 0.7) return '#ff9830'
  return '#73bf69'
}

function runTrace() {
  if (!traceFrom.value || !traceTo.value) return
  const adj: Record<string, string[]> = {}
  edges.value.forEach(e => { (adj[e.source] ??= []).push(e.target) })
  const queue: string[][] = [[traceFrom.value]]
  const visited = new Set([traceFrom.value])
  while (queue.length) {
    const path = queue.shift()!
    const cur = path[path.length - 1]
    if (cur === traceTo.value) { tracePath.value = path; return }
    for (const nb of (adj[cur] ?? [])) {
      if (!visited.has(nb)) { visited.add(nb); queue.push([...path, nb]) }
    }
  }
  tracePath.value = []
}

function highlightPath(path: { nodes: string[] }) {
  const el = netlistEl.value; if (!el) return
  tab.value = 'netlist'
  nextTick(() => {
    const c = echarts.getInstanceByDom(el); if (!c) return
    const pathSet = new Set(path.nodes)
    c.dispatchAction({ type: 'focusNodeAdjacency' })
  })
}

async function loadTemplate(t: string) {
  template.value = t; selected.value = null; tracePath.value = []
  try {
    const r = await fetch(`${BASE}/semiconductor/graph/${t}`)
    const d = await r.json()
    nodes.value     = d.nodes     ?? []
    edges.value     = d.edges     ?? []
    vectors.value   = d.vectors   ?? []
    categories.value = d.categories ?? []
  } catch { nodes.value = []; edges.value = []; vectors.value = []; categories.value = [] }
  nextTick(() => { initAll(); charts.forEach(c => c.resize()) })
}

function switchTab(t: typeof tab.value) {
  tab.value = t; nextTick(() => { initAll(); charts.forEach(c => c.resize()) })
}

function initAll() {
  if (tab.value === 'netlist')   initNetlist()
  if (tab.value === 'embedding') initEmbedding()
}

function initNetlist() {
  const el = netlistEl.value; if (!el) return
  let c = echarts.getInstanceByDom(el)
  if (!c) { c = echarts.init(el, 'dark', { renderer: 'canvas' }); charts.push(c) }
  c.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: (p: any) => p.dataType === 'node'
      ? `<b>${p.data.name}</b><br/>${categories.value[p.data.category] ?? ''}`
      : p.data.label },
    series: [{
      type: 'graph', layout: 'force', roam: true, draggable: true,
      force: { repulsion: 180, edgeLength: [50, 120], gravity: 0.08 },
      categories: categories.value.map((name, i) => ({ name, itemStyle: { color: CAT_COLORS[i] } })),
      data: nodes.value.map(n => ({
        id: n.id, name: n.label, category: n.category,
        symbolSize: n.symbol_size * 0.55,
        itemStyle: { color: CAT_COLORS[n.category] },
        label: { show: n.category !== 2, fontSize: 9, color: '#fff' },
      })),
      edges: edges.value.map(e => ({
        source: e.source, target: e.target, label: e.label,
        lineStyle: { color: '#5794f2', width: 1.2, opacity: 0.6 },
      })),
      emphasis: { focus: 'adjacency' },
    }],
  })
  c.on('click', (p: any) => { if (p.dataType === 'node') selected.value = nodes.value.find(n => n.id === p.data.id) ?? null })
}

function initEmbedding() {
  const el = embeddingEl.value; if (!el) return
  let c = echarts.getInstanceByDom(el)
  if (!c) { c = echarts.init(el, 'dark', { renderer: 'canvas' }); charts.push(c) }
  const byCat = categories.value.map((name, i) => ({
    name, type: 'scatter' as const,
    data: vectors.value.filter(v => nodes.value.find(n => n.id === v.id)?.category === i)
      .map(v => ({ value: [v.x, v.y], name: v.label, id: v.id, symbolSize: 10 })),
    itemStyle: { color: CAT_COLORS[i], opacity: 0.85 },
    label: { show: true, formatter: (p: any) => p.name, fontSize: 9, position: 'top', color: '#bbb' },
  }))
  c.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: (p: any) => `<b>${p.name}</b>` },
    legend: { bottom: 8, textStyle: { color: '#aaa', fontSize: 11 } },
    xAxis: { name: 'Functional Sim Dim 1', splitLine: { lineStyle: { color: '#333' } } },
    yAxis: { name: 'Functional Sim Dim 2', splitLine: { lineStyle: { color: '#333' } } },
    series: byCat,
  })
}

function onResize() { charts.forEach(c => c.resize()) }
onMounted(() => { loadTemplate('alu-4bit'); window.addEventListener('resize', onResize) })
onUnmounted(() => { charts.forEach(c => c.dispose()); window.removeEventListener('resize', onResize) })
</script>

<style scoped>
.eda-shell { display:flex; height:100%; overflow:hidden; }
.eda-sidebar { width:200px; flex-shrink:0; border-right:1px solid var(--border); display:flex; flex-direction:column; overflow-y:auto; }
.eda-main { flex:1; min-width:0; display:flex; flex-direction:column; }
.eda-detail { width:200px; flex-shrink:0; border-left:1px solid var(--border); overflow-y:auto; }
.dataset-btn { display:flex; flex-direction:column; gap:2px; padding:8px 10px; background:transparent; border:1px solid var(--border); border-radius:6px; cursor:pointer; color:var(--text-primary); text-align:left; transition:all 0.15s; }
.dataset-btn:hover { border-color:var(--primary); }
.dataset-btn.active { border-color:var(--primary); background:rgba(87,148,242,0.1); }
.dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.stat-row { display:flex; justify-content:space-between; font-size:12px; }
.stat-label { color:var(--text-muted); }
.stat-val { font-weight:600; }
.tab-bar { display:flex; border-bottom:1px solid var(--border); padding:0 12px; }
.tab-btn { padding:10px 14px; font-size:13px; background:transparent; border:none; border-bottom:2px solid transparent; color:var(--text-muted); cursor:pointer; transition:all 0.15s; }
.tab-btn:hover { color:var(--text-primary); }
.tab-btn.active { color:var(--primary,#5794f2); border-bottom-color:var(--primary,#5794f2); }
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
.tab-content { flex:1; min-height:0; display:flex; flex-direction:column; }
.chart-fill { flex:1; min-height:0; width:100%; }
.timing-row { padding:10px 12px; border:1px solid var(--border); border-radius:6px; margin-bottom:6px; cursor:pointer; transition:background 0.1s; }
.timing-row:hover { background:rgba(255,255,255,0.04); }
.select-input { background:var(--bg-input); border:1px solid var(--border); color:var(--text-primary); padding:6px 10px; border-radius:5px; font-size:12px; }
.gene-tag { padding:2px 7px; border-radius:10px; border:1px solid; font-size:11px; cursor:pointer; }
.detail-label { font-size:10px; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); margin-bottom:3px; }
</style>

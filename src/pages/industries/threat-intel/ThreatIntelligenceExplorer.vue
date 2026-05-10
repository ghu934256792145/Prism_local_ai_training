<template>
  <div class="ti-shell">
    <!-- Sidebar -->
    <aside class="ti-sidebar">
      <div class="panel-header"><span class="panel-title">Campaign</span></div>
      <div style="padding:8px;display:flex;flex-direction:column;gap:6px">
        <button
          v-for="t in TEMPLATES"
          :key="t.key"
          class="dataset-btn"
          :class="{ active: template === t.key }"
          @click="loadTemplate(t.key)"
        >
          <div style="display:flex;align-items:center;gap:6px">
            <span class="severity-dot" :style="{ background: t.color }"></span>
            <span style="font-weight:500;font-size:13px">{{ t.label }}</span>
          </div>
          <span style="font-size:11px;color:var(--text-muted);margin-top:2px">{{ t.desc }}</span>
        </button>
      </div>

      <div class="panel-header" style="margin-top:8px"><span class="panel-title">Categories</span></div>
      <div style="padding:8px;display:flex;flex-direction:column;gap:5px">
        <div v-for="(cat, i) in categories" :key="i" style="display:flex;align-items:center;gap:7px">
          <span class="dot" :style="{ background: CAT_COLORS[i] ?? '#888' }"></span>
          <span style="font-size:12px">{{ cat }}</span>
        </div>
      </div>

      <div class="panel-header" style="margin-top:8px"><span class="panel-title">Risk Summary</span></div>
      <div style="padding:8px;display:flex;flex-direction:column;gap:6px">
        <div class="stat-row"><span class="stat-label">Actors</span><span class="stat-val">{{ countCat(0) }}</span></div>
        <div class="stat-row"><span class="stat-label">Tactics</span><span class="stat-val">{{ countCat(1) }}</span></div>
        <div class="stat-row"><span class="stat-label">Techniques</span><span class="stat-val">{{ countCat(2) }}</span></div>
        <div class="stat-row"><span class="stat-label">Malware</span><span class="stat-val">{{ countCat(3) }}</span></div>
        <div class="stat-row"><span class="stat-label">Infra</span><span class="stat-val">{{ countCat(4) }}</span></div>
        <div class="stat-row"><span class="stat-label">Targets</span><span class="stat-val">{{ countCat(5) }}</span></div>
      </div>
    </aside>

    <!-- Main -->
    <div class="ti-main">
      <div class="tab-bar">
        <button v-for="t in TABS" :key="t.key" class="tab-btn" :class="{ active: tab === t.key }" @click="switchTab(t.key)">{{ t.label }}</button>
        <router-link to="/projects?industry=threat-intel" class="projects-badge">Open in Projects →</router-link>
      </div>

      <!-- Kill Chain graph -->
      <div v-show="tab === 'killchain'" class="tab-content">
        <div ref="killchainEl" class="chart-fill"></div>
      </div>

      <!-- Technique scatter -->
      <div v-show="tab === 'techniques'" class="tab-content">
        <div ref="techniquesEl" class="chart-fill"></div>
      </div>

      <!-- Malware × Technique heatmap -->
      <div v-show="tab === 'matrix'" class="tab-content">
        <div ref="matrixEl" class="chart-fill"></div>
      </div>

      <!-- Alert feed -->
      <div v-show="tab === 'alerts'" class="tab-content" style="overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:6px">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">
          Simulated IOC alerts derived from campaign graph — click to inspect
        </div>
        <div
          v-for="alert in alertFeed"
          :key="alert.id"
          class="alert-row"
          @click="selected = nodes.find(n => n.id === alert.nodeId) ?? null"
        >
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <span class="sev-badge" :style="{ background: alert.color + '22', color: alert.color }">{{ alert.severity }}</span>
              <span style="font-size:13px;font-weight:500;margin-left:8px">{{ alert.title }}</span>
            </div>
            <span style="font-size:11px;color:var(--text-muted)">{{ alert.time }}</span>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">{{ alert.detail }}</div>
        </div>
      </div>
    </div>

    <!-- Detail -->
    <aside class="ti-detail">
      <div class="panel-header"><span class="panel-title">Entity Detail</span></div>
      <div v-if="selected" style="padding:12px;display:flex;flex-direction:column;gap:10px">
        <div><div class="detail-label">Name</div><div style="font-size:15px;font-weight:700">{{ selected.label }}</div></div>
        <div>
          <div class="detail-label">Type</div>
          <span class="badge" :style="{ background: CAT_COLORS[selected.category] + '22', color: CAT_COLORS[selected.category] }">
            {{ categories[selected.category] }}
          </span>
        </div>
        <div v-if="outgoing(selected.id).length">
          <div class="detail-label">Uses / Leads To</div>
          <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">
            <div v-for="e in outgoing(selected.id)" :key="e.target" style="font-size:12px;display:flex;gap:6px;align-items:center">
              <span class="dot" :style="{ background: CAT_COLORS[nodeCategory(e.target)] }"></span>
              <span style="color:var(--text-muted);font-size:10px;min-width:72px">{{ e.label }}</span>
              <span>{{ nodeLabel(e.target) }}</span>
            </div>
          </div>
        </div>
        <div v-if="incoming(selected.id).length">
          <div class="detail-label">Attributed From</div>
          <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">
            <div v-for="e in incoming(selected.id)" :key="e.source" style="font-size:12px;display:flex;gap:6px;align-items:center">
              <span class="dot" :style="{ background: CAT_COLORS[nodeCategory(e.source)] }"></span>
              <span style="color:var(--text-muted);font-size:10px;min-width:72px">{{ e.label }}</span>
              <span>{{ nodeLabel(e.source) }}</span>
            </div>
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
  { key: 'apt29-campaign',       label: 'APT29 Campaign',        desc: 'SVR / Cozy Bear MITRE ATT&CK graph', color: '#f2495c' },
  { key: 'ransomware-killchain', label: 'Ransomware Kill-Chain',  desc: 'Initial access → encryption → extortion', color: '#ff9830' },
]

// Threat actors=red, Tactics=orange, Techniques=yellow, Malware=purple, Infra=grey, Targets=blue
const CAT_COLORS = ['#f2495c','#ff9830','#fade2a','#b877d9','#8e8e8e','#5794f2','#73bf69']

const EDGE_COLORS: Record<string, string> = {
  USES: '#fade2a', ATTRIBUTED_TO: '#f2495c', PART_OF: '#ff9830',
  IMPLEMENTS: '#b877d9', HOSTS: '#8e8e8e', TARGETS: '#5794f2',
  ENABLES: '#73bf69', EXPLOITS: '#f2495c',
}

const TABS = [
  { key: 'killchain',  label: 'Kill Chain'      },
  { key: 'techniques', label: 'Technique Space' },
  { key: 'matrix',     label: 'Coverage Matrix' },
  { key: 'alerts',     label: 'Alert Feed'      },
] as const

interface GNode { id: string; label: string; category: number; value: number; symbol_size: number }
interface GEdge { source: string; target: string; label: string; weight: number }
interface GVec  { id: string; label: string; x: number; y: number; cluster: number }

const template   = ref('apt29-campaign')
const nodes      = ref<GNode[]>([])
const edges      = ref<GEdge[]>([])
const vectors    = ref<GVec[]>([])
const categories = ref<string[]>([])
const tab        = ref<typeof TABS[number]['key']>('killchain')
const selected   = ref<GNode | null>(null)

const killchainEl  = ref<HTMLElement | null>(null)
const techniquesEl = ref<HTMLElement | null>(null)
const matrixEl     = ref<HTMLElement | null>(null)
let charts: echarts.ECharts[] = []

function nodeLabel(id: string) { return nodes.value.find(n => n.id === id)?.label ?? id }
function nodeCategory(id: string) { return nodes.value.find(n => n.id === id)?.category ?? 0 }
function outgoing(id: string) { return edges.value.filter(e => e.source === id) }
function incoming(id: string) { return edges.value.filter(e => e.target === id) }
function countCat(cat: number) { return nodes.value.filter(n => n.category === cat).length }

const alertFeed = computed(() => {
  const malware = nodes.value.filter(n => n.category === 3)
  const techniques = nodes.value.filter(n => n.category === 2)
  const times = ['2m ago','7m ago','14m ago','23m ago','38m ago','55m ago','1h ago','2h ago']
  const alerts: { id: string; nodeId: string; severity: string; color: string; title: string; detail: string; time: string }[] = []
  malware.forEach((m, i) => {
    alerts.push({ id: m.id, nodeId: m.id, severity: 'CRITICAL', color: '#f2495c', title: `${m.label} detected`, detail: `Malware signature matched on endpoint. Immediate containment advised.`, time: times[i % times.length] })
  })
  techniques.slice(0, 5).forEach((t, i) => {
    alerts.push({ id: t.id + '-a', nodeId: t.id, severity: 'HIGH', color: '#ff9830', title: `${t.label} observed`, detail: `Technique activity detected in network telemetry.`, time: times[(i + 3) % times.length] })
  })
  return alerts.sort(() => Math.random() - 0.5)
})

async function loadTemplate(t: string) {
  template.value = t; selected.value = null
  try {
    const r = await fetch(`${BASE}/threat/graph/${t}`)
    const d = await r.json()
    nodes.value      = d.nodes      ?? []
    edges.value      = d.edges      ?? []
    vectors.value    = d.vectors    ?? []
    categories.value = d.categories ?? []
  } catch { nodes.value = []; edges.value = []; vectors.value = []; categories.value = [] }
  nextTick(() => { initAll(); charts.forEach(c => c.resize()) })
}

function switchTab(t: typeof tab.value) {
  tab.value = t; nextTick(() => { initAll(); charts.forEach(c => c.resize()) })
}

function initAll() {
  if (tab.value === 'killchain')  initKillchain()
  if (tab.value === 'techniques') initTechniques()
  if (tab.value === 'matrix')     initMatrix()
}

function initKillchain() {
  const el = killchainEl.value; if (!el) return
  let c = echarts.getInstanceByDom(el)
  if (!c) { c = echarts.init(el, 'dark', { renderer: 'canvas' }); charts.push(c) }
  c.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: (p: any) => p.dataType === 'node'
      ? `<b>${p.data.name}</b><br/>${categories.value[p.data.category] ?? ''}`
      : `<b>${p.data.label}</b>` },
    series: [{
      type: 'graph', layout: 'force', roam: true, draggable: true,
      force: { repulsion: 220, edgeLength: [70, 160], gravity: 0.04 },
      categories: categories.value.map((name, i) => ({ name, itemStyle: { color: CAT_COLORS[i] } })),
      data: nodes.value.map(n => ({
        id: n.id, name: n.label, category: n.category,
        symbolSize: n.symbol_size * 0.55,
        itemStyle: { color: CAT_COLORS[n.category] },
        label: { show: n.category <= 1 || n.category === 3, fontSize: 10, color: '#fff' },
      })),
      edges: edges.value.map(e => ({
        source: e.source, target: e.target, label: e.label,
        lineStyle: { color: EDGE_COLORS[e.label] ?? '#555', width: Math.max(1, e.weight * 0.5), opacity: 0.7 },
        symbol: ['none', 'arrow'],
      })),
      emphasis: { focus: 'adjacency' },
    }],
  })
  c.on('click', (p: any) => { if (p.dataType === 'node') selected.value = nodes.value.find(n => n.id === p.data.id) ?? null })
}

function initTechniques() {
  const el = techniquesEl.value; if (!el) return
  let c = echarts.getInstanceByDom(el)
  if (!c) { c = echarts.init(el, 'dark', { renderer: 'canvas' }); charts.push(c) }
  const byCat = categories.value.map((name, i) => ({
    name, type: 'scatter' as const,
    data: vectors.value.filter(v => nodes.value.find(n => n.id === v.id)?.category === i).map(v => ({
      value: [v.x, v.y], name: v.label, id: v.id,
      symbolSize: i === 0 ? 18 : i === 3 ? 14 : 10,
    })),
    itemStyle: { color: CAT_COLORS[i], opacity: 0.9 },
    label: { show: i <= 1, formatter: (p: any) => p.name, fontSize: 10, position: 'top', color: '#ccc' },
  }))
  c.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: (p: any) => `<b>${p.name}</b><br/>${categories.value[nodes.value.find(n => n.id === p.data?.id)?.category ?? 0] ?? ''}` },
    legend: { bottom: 8, textStyle: { color: '#aaa', fontSize: 11 } },
    xAxis: { name: 'Semantic Dim 1', splitLine: { lineStyle: { color: '#2a2a2a' } } },
    yAxis: { name: 'Semantic Dim 2', splitLine: { lineStyle: { color: '#2a2a2a' } } },
    series: byCat,
  })
  c.on('click', (p: any) => { selected.value = nodes.value.find(n => n.id === p.data?.id) ?? null })
}

function initMatrix() {
  const el = matrixEl.value; if (!el) return
  let c = echarts.getInstanceByDom(el)
  if (!c) { c = echarts.init(el, 'dark', { renderer: 'canvas' }); charts.push(c) }
  const malware = nodes.value.filter(n => n.category === 3)
  const tactics  = nodes.value.filter(n => n.category === 1)
  if (!malware.length || !tactics.length) return
  const data: [number, number, number][] = []
  malware.forEach((m, mi) => {
    tactics.forEach((tac, ti) => {
      // path: malware → technique → tactic
      const techniques = outgoing(m.id).map(e => e.target)
      const connected = techniques.some(tech => outgoing(tech).some(e => e.target === tac.id))
      data.push([ti, mi, connected ? 1 : 0])
    })
  })
  c.setOption({
    backgroundColor: 'transparent',
    tooltip: { position: 'top', formatter: (p: any) => `${malware[p.value[1]]?.label} → ${tactics[p.value[0]]?.label}: ${p.value[2] ? '✓' : '✗'}` },
    grid: { top: 10, bottom: 80, left: 130, right: 20 },
    xAxis: { type: 'category', data: tactics.map(t => t.label), axisLabel: { color: '#aaa', fontSize: 9, rotate: 30 }, position: 'top' },
    yAxis: { type: 'category', data: malware.map(m => m.label), axisLabel: { color: '#aaa', fontSize: 11 } },
    visualMap: { min: 0, max: 1, show: false, inRange: { color: ['#1a1a2e','#f2495c'] } },
    series: [{ type: 'heatmap', data, label: { show: true, formatter: (p: any) => p.value[2] ? '✓' : '', color: '#fff', fontSize: 12 }, emphasis: { itemStyle: { shadowBlur: 8 } } }],
  })
}

function onResize() { charts.forEach(c => c.resize()) }
onMounted(() => { loadTemplate('apt29-campaign'); window.addEventListener('resize', onResize) })
onUnmounted(() => { charts.forEach(c => c.dispose()); window.removeEventListener('resize', onResize) })
</script>

<style scoped>
.ti-shell { display:flex; height:100%; overflow:hidden; }
.ti-sidebar { width:210px; flex-shrink:0; border-right:1px solid var(--border); display:flex; flex-direction:column; overflow-y:auto; }
.ti-main { flex:1; min-width:0; display:flex; flex-direction:column; }
.ti-detail { width:220px; flex-shrink:0; border-left:1px solid var(--border); overflow-y:auto; }
.dataset-btn { display:flex; flex-direction:column; padding:8px 10px; background:transparent; border:1px solid var(--border); border-radius:6px; cursor:pointer; color:var(--text-primary); text-align:left; transition:all 0.15s; }
.dataset-btn:hover { border-color:var(--primary); }
.dataset-btn.active { border-color:var(--primary); background:rgba(87,148,242,0.1); }
.severity-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
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
.alert-row { padding:10px 12px; border:1px solid var(--border); border-radius:6px; cursor:pointer; transition:background 0.1s; }
.alert-row:hover { background:rgba(255,255,255,0.04); }
.sev-badge { padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; }
.detail-label { font-size:10px; text-transform:uppercase; letter-spacing:0.06em; color:var(--text-muted); margin-bottom:3px; }
</style>

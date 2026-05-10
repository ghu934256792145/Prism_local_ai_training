<template>
  <div class="dd-shell">
    <!-- Left panel: compound filter -->
    <aside class="dd-sidebar">
      <div class="panel-header"><span class="panel-title">Compounds</span></div>
      <div class="filter-chips">
        <button
          v-for="cls in DRUG_CLASSES"
          :key="cls.key"
          class="chip"
          :class="{ active: activeClass === cls.key }"
          @click="activeClass = activeClass === cls.key ? null : cls.key"
        >{{ cls.label }}</button>
      </div>
      <div class="compound-list">
        <div
          v-for="c in filteredCompounds"
          :key="c.id"
          class="compound-item"
          :class="{ selected: selectedCompound === c.id }"
          @click="selectCompound(c.id)"
        >
          <span class="compound-dot" :style="{ background: drugClassColor(c.id) }"></span>
          <div>
            <div style="font-size:13px;font-weight:500">{{ c.label }}</div>
            <div style="font-size:11px;color:var(--text-muted)">{{ drugClassLabel(c.id) }}</div>
          </div>
        </div>
      </div>

      <div class="panel-header" style="margin-top:12px"><span class="panel-title">Legend</span></div>
      <div class="legend-list">
        <div v-for="cat in CATEGORIES" :key="cat.label" class="legend-row">
          <span class="legend-dot" :style="{ background: cat.color }"></span>
          <span style="font-size:12px">{{ cat.label }}</span>
        </div>
      </div>
    </aside>

    <!-- Main area -->
    <div class="dd-main">
      <!-- Tab bar -->
      <div class="tab-bar">
        <button
          v-for="t in TABS"
          :key="t.key"
          class="tab-btn"
          :class="{ active: activeTab === t.key }"
          @click="switchTab(t.key)"
        >{{ t.label }}</button>
        <router-link to="/projects?industry=drug-discovery" class="projects-badge">Open in Projects →</router-link>
      </div>

      <!-- Tab: Network -->
      <div v-show="activeTab === 'network'" class="tab-content">
        <div ref="networkChart" class="chart-fill"></div>
      </div>

      <!-- Tab: Embedding -->
      <div v-show="activeTab === 'embedding'" class="tab-content">
        <div ref="embeddingChart" class="chart-fill"></div>
      </div>

      <!-- Tab: Activity Matrix -->
      <div v-show="activeTab === 'activity'" class="tab-content">
        <div ref="activityChart" class="chart-fill"></div>
      </div>

      <!-- Tab: ADMET -->
      <div v-show="activeTab === 'admet'" class="tab-content">
        <div style="padding:12px 16px;display:flex;gap:8px;flex-wrap:wrap">
          <button
            v-for="c in COMPOUNDS"
            :key="c.id"
            class="chip"
            :class="{ active: admetSelected.includes(c.id) }"
            @click="toggleAdmet(c.id)"
          >{{ c.label }}</button>
        </div>
        <div ref="admetChart" style="flex:1;min-height:0"></div>
      </div>
    </div>

    <!-- Right panel: node detail -->
    <aside class="dd-detail">
      <div class="panel-header"><span class="panel-title">Detail</span></div>
      <div v-if="detail" style="padding:12px;display:flex;flex-direction:column;gap:10px">
        <div>
          <div class="detail-label">Name</div>
          <div class="detail-value">{{ detail.label }}</div>
        </div>
        <div>
          <div class="detail-label">Type</div>
          <span class="badge" :style="{ background: CATEGORIES[detail.category]?.color + '22', color: CATEGORIES[detail.category]?.color, border: '1px solid ' + CATEGORIES[detail.category]?.color + '55' }">
            {{ CATEGORIES[detail.category]?.label }}
          </span>
        </div>
        <div v-if="detail.category === 0">
          <div class="detail-label">Drug Class</div>
          <div class="detail-value">{{ drugClassLabel(detail.id) }}</div>
        </div>
        <div v-if="detail.category === 0">
          <div class="detail-label">ADMET Summary</div>
          <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">
            <div v-for="(val, dim) in admetProfile(detail.id)" :key="dim" style="display:flex;align-items:center;gap:8px">
              <span style="width:80px;font-size:11px;color:var(--text-muted)">{{ dim }}</span>
              <div style="flex:1;height:6px;background:var(--bg-input);border-radius:3px">
                <div :style="{ width: (val * 10) + '%', height: '100%', background: admetColor(val), borderRadius: '3px' }"></div>
              </div>
              <span style="width:20px;font-size:11px;text-align:right">{{ val }}</span>
            </div>
          </div>
        </div>
        <div>
          <div class="detail-label">Connections</div>
          <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px">
            <div v-for="conn in nodeConnections(detail.id)" :key="conn.id" style="font-size:12px;display:flex;gap:6px;align-items:center">
              <span class="legend-dot" :style="{ background: CATEGORIES[conn.category]?.color }"></span>
              <span style="color:var(--text-muted);font-size:10px;min-width:56px">{{ conn.rel }}</span>
              <span>{{ conn.label }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-else style="padding:16px;color:var(--text-muted);font-size:12px">
        Click a node to inspect it.
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'

// ── Static dataset ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { label: 'Compound',         color: '#5794f2' },
  { label: 'Protein Target',   color: '#ff9830' },
  { label: 'Signaling Pathway',color: '#73bf69' },
  { label: 'Disease',          color: '#f2495c' },
  { label: 'Side Effect',      color: '#b877d9' },
]

const NODES = [
  { id: 'aspirin',       label: 'Aspirin',                category: 0, value: 8, symbol_size: 38 },
  { id: 'ibuprofen',     label: 'Ibuprofen',              category: 0, value: 7, symbol_size: 34 },
  { id: 'gefitinib',     label: 'Gefitinib',              category: 0, value: 9, symbol_size: 42 },
  { id: 'erlotinib',     label: 'Erlotinib',              category: 0, value: 8, symbol_size: 38 },
  { id: 'vemurafenib',   label: 'Vemurafenib',            category: 0, value: 9, symbol_size: 40 },
  { id: 'methotrexate',  label: 'Methotrexate',           category: 0, value: 7, symbol_size: 34 },
  { id: 'dexamethasone', label: 'Dexamethasone',          category: 0, value: 8, symbol_size: 36 },
  { id: 'cox-1',         label: 'COX-1 (PTGS1)',          category: 1, value: 7, symbol_size: 34 },
  { id: 'cox-2',         label: 'COX-2 (PTGS2)',          category: 1, value: 8, symbol_size: 36 },
  { id: 'egfr',          label: 'EGFR (HER1)',            category: 1, value: 9, symbol_size: 42 },
  { id: 'braf',          label: 'BRAF V600E',             category: 1, value: 9, symbol_size: 40 },
  { id: 'dhfr',          label: 'DHFR',                   category: 1, value: 6, symbol_size: 30 },
  { id: 'gr',            label: 'GR (NR3C1)',             category: 1, value: 6, symbol_size: 30 },
  { id: 'prostaglandin-syn',  label: 'Prostaglandin Synthesis', category: 2, value: 6, symbol_size: 30 },
  { id: 'mapk',               label: 'MAPK / ERK Signaling',    category: 2, value: 8, symbol_size: 36 },
  { id: 'folate-met',         label: 'Folate Metabolism',       category: 2, value: 5, symbol_size: 28 },
  { id: 'glucocorticoid-sig', label: 'Glucocorticoid Signaling',category: 2, value: 6, symbol_size: 30 },
  { id: 'pain-inflammation',    label: 'Pain / Inflammation',   category: 3, value: 8, symbol_size: 38 },
  { id: 'nsclc',                label: 'NSCLC',                 category: 3, value: 9, symbol_size: 42 },
  { id: 'melanoma',             label: 'Melanoma',              category: 3, value: 8, symbol_size: 38 },
  { id: 'rheumatoid-arthritis', label: 'Rheumatoid Arthritis',  category: 3, value: 7, symbol_size: 34 },
  { id: 'gi-bleeding',    label: 'GI Bleeding',    category: 4, value: 5, symbol_size: 28 },
  { id: 'hepatotoxicity', label: 'Hepatotoxicity', category: 4, value: 6, symbol_size: 30 },
  { id: 'cardiotoxicity', label: 'Cardiotoxicity', category: 4, value: 5, symbol_size: 28 },
]

const EDGES = [
  { source: 'aspirin',       target: 'cox-1',               label: 'INHIBITS',   weight: 4 },
  { source: 'aspirin',       target: 'cox-2',               label: 'INHIBITS',   weight: 3 },
  { source: 'ibuprofen',     target: 'cox-1',               label: 'INHIBITS',   weight: 3 },
  { source: 'ibuprofen',     target: 'cox-2',               label: 'INHIBITS',   weight: 4 },
  { source: 'gefitinib',     target: 'egfr',                label: 'INHIBITS',   weight: 5 },
  { source: 'erlotinib',     target: 'egfr',                label: 'INHIBITS',   weight: 4 },
  { source: 'vemurafenib',   target: 'braf',                label: 'INHIBITS',   weight: 5 },
  { source: 'methotrexate',  target: 'dhfr',                label: 'INHIBITS',   weight: 4 },
  { source: 'dexamethasone', target: 'gr',                  label: 'ACTIVATES',  weight: 4 },
  { source: 'aspirin',       target: 'ibuprofen',           label: 'SIMILAR_TO', weight: 3 },
  { source: 'gefitinib',     target: 'erlotinib',           label: 'SIMILAR_TO', weight: 4 },
  { source: 'cox-1', target: 'prostaglandin-syn',  label: 'DRIVES',     weight: 3 },
  { source: 'cox-2', target: 'prostaglandin-syn',  label: 'DRIVES',     weight: 4 },
  { source: 'egfr',  target: 'mapk',              label: 'ACTIVATES',  weight: 3 },
  { source: 'braf',  target: 'mapk',              label: 'ACTIVATES',  weight: 4 },
  { source: 'dhfr',  target: 'folate-met',        label: 'CATALYZES',  weight: 3 },
  { source: 'gr',    target: 'glucocorticoid-sig', label: 'MEDIATES',   weight: 3 },
  { source: 'prostaglandin-syn',  target: 'pain-inflammation',    label: 'PROMOTES',   weight: 3 },
  { source: 'mapk',               target: 'nsclc',                label: 'PROMOTES',   weight: 3 },
  { source: 'mapk',               target: 'melanoma',             label: 'PROMOTES',   weight: 4 },
  { source: 'folate-met',         target: 'rheumatoid-arthritis', label: 'LINKED_TO',  weight: 2 },
  { source: 'glucocorticoid-sig', target: 'pain-inflammation',    label: 'SUPPRESSES', weight: 3 },
  { source: 'aspirin',       target: 'pain-inflammation',    label: 'TREATS', weight: 4 },
  { source: 'ibuprofen',     target: 'pain-inflammation',    label: 'TREATS', weight: 4 },
  { source: 'gefitinib',     target: 'nsclc',                label: 'TREATS', weight: 5 },
  { source: 'erlotinib',     target: 'nsclc',                label: 'TREATS', weight: 4 },
  { source: 'vemurafenib',   target: 'melanoma',             label: 'TREATS', weight: 5 },
  { source: 'methotrexate',  target: 'rheumatoid-arthritis', label: 'TREATS', weight: 3 },
  { source: 'dexamethasone', target: 'pain-inflammation',    label: 'TREATS', weight: 3 },
  { source: 'aspirin',      target: 'gi-bleeding',    label: 'CAUSES', weight: 3 },
  { source: 'ibuprofen',    target: 'gi-bleeding',    label: 'CAUSES', weight: 2 },
  { source: 'methotrexate', target: 'hepatotoxicity', label: 'CAUSES', weight: 3 },
  { source: 'gefitinib',    target: 'cardiotoxicity', label: 'CAUSES', weight: 2 },
]

// 2D embedding vectors
const VECTORS = [
  { id: 'aspirin',       x: -2.2, y:  1.0, cluster: 0 },
  { id: 'ibuprofen',     x: -2.5, y:  0.7, cluster: 0 },
  { id: 'gefitinib',     x:  1.2, y:  2.3, cluster: 0 },
  { id: 'erlotinib',     x:  1.5, y:  2.0, cluster: 0 },
  { id: 'vemurafenib',   x:  1.8, y:  1.5, cluster: 0 },
  { id: 'methotrexate',  x: -0.5, y: -2.2, cluster: 0 },
  { id: 'dexamethasone', x:  2.5, y: -1.0, cluster: 0 },
  { id: 'cox-1', x:  0.4, y:  0.6, cluster: 1 },
  { id: 'cox-2', x:  0.7, y:  0.3, cluster: 1 },
  { id: 'egfr',  x:  0.2, y:  1.1, cluster: 1 },
  { id: 'braf',  x:  0.5, y:  0.9, cluster: 1 },
  { id: 'dhfr',  x: -0.3, y: -0.5, cluster: 1 },
  { id: 'gr',    x:  1.1, y: -0.5, cluster: 1 },
  { id: 'prostaglandin-syn',  x: -3.0, y:  0.0, cluster: 2 },
  { id: 'mapk',               x: -0.5, y:  1.5, cluster: 2 },
  { id: 'folate-met',         x: -2.5, y: -1.5, cluster: 2 },
  { id: 'glucocorticoid-sig', x:  2.0, y:  0.5, cluster: 2 },
  { id: 'pain-inflammation',    x: -2.0, y: -1.5, cluster: 3 },
  { id: 'nsclc',                x:  1.5, y: -1.0, cluster: 3 },
  { id: 'melanoma',             x:  2.0, y: -2.0, cluster: 3 },
  { id: 'rheumatoid-arthritis', x: -1.5, y: -2.5, cluster: 3 },
  { id: 'gi-bleeding',    x: -1.0, y: -3.0, cluster: 4 },
  { id: 'hepatotoxicity', x:  0.5, y: -3.0, cluster: 4 },
  { id: 'cardiotoxicity', x:  1.5, y: -3.0, cluster: 4 },
]

// ADMET profiles: Absorption/Distribution/Metabolism/Excretion/Toxicity (0-10)
const ADMET: Record<string, Record<string, number>> = {
  aspirin:       { Absorption: 8, Distribution: 7, Metabolism: 8, Excretion: 7, Toxicity: 5 },
  ibuprofen:     { Absorption: 9, Distribution: 8, Metabolism: 8, Excretion: 7, Toxicity: 4 },
  gefitinib:     { Absorption: 7, Distribution: 8, Metabolism: 6, Excretion: 5, Toxicity: 6 },
  erlotinib:     { Absorption: 8, Distribution: 7, Metabolism: 6, Excretion: 5, Toxicity: 5 },
  vemurafenib:   { Absorption: 6, Distribution: 9, Metabolism: 7, Excretion: 4, Toxicity: 6 },
  methotrexate:  { Absorption: 7, Distribution: 5, Metabolism: 4, Excretion: 8, Toxicity: 7 },
  dexamethasone: { Absorption: 9, Distribution: 9, Metabolism: 5, Excretion: 6, Toxicity: 6 },
}

// Activity matrix: compound × target (0 = no activity, 9 = max)
const ACTIVITY_TARGETS = ['COX-1', 'COX-2', 'EGFR', 'BRAF', 'DHFR', 'GR']
const ACTIVITY_DATA: number[][] = [
//                    COX-1  COX-2  EGFR  BRAF  DHFR  GR
  /* aspirin */       [  9,    7,    0,    0,    0,    0 ],
  /* ibuprofen */     [  8,    8,    0,    0,    0,    0 ],
  /* gefitinib */     [  0,    0,    9,    2,    0,    0 ],
  /* erlotinib */     [  0,    0,    8,    2,    0,    0 ],
  /* vemurafenib */   [  0,    0,    2,    9,    0,    0 ],
  /* methotrexate */  [  0,    0,    0,    0,    9,    1 ],
  /* dexamethasone */ [  0,    0,    0,    0,    0,    9 ],
]

const DRUG_CLASSES = [
  { key: 'nsaid',     label: 'NSAIDs',        ids: ['aspirin', 'ibuprofen'] },
  { key: 'kinase',    label: 'Kinase Inh.',   ids: ['gefitinib', 'erlotinib', 'vemurafenib'] },
  { key: 'antimetab', label: 'Antimetabolite', ids: ['methotrexate'] },
  { key: 'steroid',   label: 'Corticosteroid', ids: ['dexamethasone'] },
]

const DRUG_CLASS_COLORS: Record<string, string> = {
  nsaid: '#5794f2', kinase: '#ff9830', antimetab: '#73bf69', steroid: '#b877d9',
}

const COMPOUNDS = NODES.filter(n => n.category === 0)

// ── State ──────────────────────────────────────────────────────────────────────

const activeTab = ref<'network' | 'embedding' | 'activity' | 'admet'>('network')
const activeClass = ref<string | null>(null)
const selectedCompound = ref<string | null>(null)
const admetSelected = ref<string[]>(['aspirin', 'gefitinib', 'dexamethasone'])
const detail = ref<(typeof NODES)[0] | null>(null)

const TABS = [
  { key: 'network',   label: 'Network'        },
  { key: 'embedding', label: 'Embedding Space' },
  { key: 'activity',  label: 'Activity Matrix' },
  { key: 'admet',     label: 'ADMET Profile'   },
] as const

// ── Chart refs ─────────────────────────────────────────────────────────────────

const networkChart   = ref<HTMLElement | null>(null)
const embeddingChart = ref<HTMLElement | null>(null)
const activityChart  = ref<HTMLElement | null>(null)
const admetChart     = ref<HTMLElement | null>(null)

let chartInstances: echarts.ECharts[] = []

// ── Helpers ────────────────────────────────────────────────────────────────────

const filteredCompounds = computed(() => {
  if (!activeClass.value) return COMPOUNDS
  const cls = DRUG_CLASSES.find(c => c.key === activeClass.value)
  return COMPOUNDS.filter(c => cls?.ids.includes(c.id))
})

function drugClassLabel(id: string) {
  return DRUG_CLASSES.find(c => c.ids.includes(id))?.label ?? '—'
}

function drugClassColor(id: string) {
  const key = DRUG_CLASSES.find(c => c.ids.includes(id))?.key ?? ''
  return DRUG_CLASS_COLORS[key] ?? '#888'
}

function admetProfile(id: string) {
  return ADMET[id] ?? {}
}

function admetColor(val: number) {
  if (val >= 8) return '#73bf69'
  if (val >= 5) return '#ff9830'
  return '#f2495c'
}

function nodeConnections(id: string) {
  return EDGES
    .filter(e => e.source === id || e.target === id)
    .map(e => {
      const otherId = e.source === id ? e.target : e.source
      const other = NODES.find(n => n.id === otherId)!
      return { id: otherId, label: other.label, category: other.category, rel: e.label }
    })
}

function selectCompound(id: string) {
  selectedCompound.value = selectedCompound.value === id ? null : id
  detail.value = NODES.find(n => n.id === id) ?? null
}

function toggleAdmet(id: string) {
  const i = admetSelected.value.indexOf(id)
  if (i === -1) admetSelected.value.push(id)
  else admetSelected.value.splice(i, 1)
  updateAdmetChart()
}

// ── Tab switching ──────────────────────────────────────────────────────────────

function switchTab(tab: typeof activeTab.value) {
  activeTab.value = tab
  nextTick(() => {
    if (tab === 'network')   initNetworkChart()
    if (tab === 'embedding') initEmbeddingChart()
    if (tab === 'activity')  initActivityChart()
    if (tab === 'admet')     initAdmetChart()
    chartInstances.forEach(c => c.resize())
  })
}

// ── Network chart ──────────────────────────────────────────────────────────────

function edgeColor(label: string) {
  const map: Record<string, string> = {
    INHIBITS: '#f2495c', ACTIVATES: '#73bf69', TREATS: '#5794f2',
    CAUSES: '#b877d9', SIMILAR_TO: '#fade2a', PROMOTES: '#ff9830',
    SUPPRESSES: '#19dde2', DRIVES: '#ff9830', CATALYZES: '#73bf69',
    MEDIATES: '#73bf69', LINKED_TO: '#888', DEPENDS_ON: '#888',
  }
  return map[label] ?? '#555'
}

function initNetworkChart() {
  if (!networkChart.value) return
  let chart = echarts.getInstanceByDom(networkChart.value)
  if (!chart) {
    chart = echarts.init(networkChart.value, 'dark', { renderer: 'canvas' })
    chartInstances.push(chart)
  }
  const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]))
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        if (p.dataType === 'node') {
          const cat = CATEGORIES[p.data.category]
          return `<b>${p.data.name}</b><br/>${cat?.label}`
        }
        return `<b>${p.data.label}</b><br/>weight: ${p.data.weight}`
      },
    },
    legend: { show: false },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      force: { repulsion: 220, edgeLength: [80, 160], gravity: 0.06 },
      categories: CATEGORIES.map(c => ({ name: c.label, itemStyle: { color: c.color } })),
      data: NODES.map(n => ({
        id: n.id,
        name: n.label,
        category: n.category,
        symbolSize: n.symbol_size * 0.6,
        itemStyle: { color: CATEGORIES[n.category]?.color },
        label: { show: n.symbol_size >= 34, fontSize: 10, color: '#fff' },
      })),
      edges: EDGES.map(e => ({
        source: e.source,
        target: e.target,
        label: e.label,
        weight: e.weight,
        lineStyle: {
          color: edgeColor(e.label),
          width: Math.max(1, e.weight * 0.6),
          opacity: 0.7,
          type: e.label === 'SIMILAR_TO' ? 'dashed' : 'solid',
        },
        emphasis: { lineStyle: { width: 3 } },
      })),
      emphasis: { focus: 'adjacency', blurScope: 'global' },
    }],
  })
  chart.on('click', (p: any) => {
    if (p.dataType === 'node') {
      detail.value = NODES.find(n => n.id === p.data.id) ?? null
      selectedCompound.value = p.data.id
    }
  })
}

// ── Embedding scatter ──────────────────────────────────────────────────────────

function initEmbeddingChart() {
  if (!embeddingChart.value) return
  let chart = echarts.getInstanceByDom(embeddingChart.value)
  if (!chart) {
    chart = echarts.init(embeddingChart.value, 'dark', { renderer: 'canvas' })
    chartInstances.push(chart)
  }
  const seriesByCategory = CATEGORIES.map((cat, idx) => {
    const pts = VECTORS.filter(v => {
      const node = NODES.find(n => n.id === v.id)
      return node?.category === idx
    })
    return {
      name: cat.label,
      type: 'scatter',
      data: pts.map(v => {
        const node = NODES.find(n => n.id === v.id)!
        return {
          value: [v.x, v.y],
          name: node.label,
          id: v.id,
          symbolSize: node.symbol_size * 0.55,
        }
      }),
      itemStyle: { color: cat.color, opacity: 0.85 },
      label: { show: idx === 0, formatter: (p: any) => p.name, fontSize: 10, position: 'top', color: '#ccc' },
      emphasis: { label: { show: true, fontSize: 11 } },
    }
  })
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: (p: any) => `<b>${p.name}</b><br/>${CATEGORIES[NODES.find(n=>n.id===p.data.id)?.category??0]?.label}` },
    legend: { bottom: 10, textStyle: { color: '#aaa', fontSize: 11 } },
    xAxis: { name: 'Embedding Dim 1', nameLocation: 'middle', nameGap: 28, splitLine: { lineStyle: { color: '#333' } } },
    yAxis: { name: 'Embedding Dim 2', nameLocation: 'middle', nameGap: 36, splitLine: { lineStyle: { color: '#333' } } },
    series: seriesByCategory,
  })
  chart.on('click', (p: any) => {
    detail.value = NODES.find(n => n.id === p.data.id) ?? null
  })
}

// ── Activity heatmap ───────────────────────────────────────────────────────────

function initActivityChart() {
  if (!activityChart.value) return
  let chart = echarts.getInstanceByDom(activityChart.value)
  if (!chart) {
    chart = echarts.init(activityChart.value, 'dark', { renderer: 'canvas' })
    chartInstances.push(chart)
  }
  const rows = COMPOUNDS.map(c => c.label)
  const heatData: [number, number, number][] = []
  ACTIVITY_DATA.forEach((row, ri) => {
    row.forEach((val, ci) => { heatData.push([ci, ri, val]) })
  })
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      formatter: (p: any) => `<b>${rows[p.value[1]]}</b> × <b>${ACTIVITY_TARGETS[p.value[0]]}</b><br/>Activity: ${p.value[2]}`,
    },
    grid: { top: 20, bottom: 80, left: 120, right: 40 },
    xAxis: { type: 'category', data: ACTIVITY_TARGETS, axisLabel: { color: '#aaa' }, position: 'top' },
    yAxis: { type: 'category', data: rows, axisLabel: { color: '#aaa', fontSize: 11 } },
    visualMap: {
      min: 0, max: 9,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 10,
      inRange: { color: ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560', '#ff9830'] },
      textStyle: { color: '#aaa' },
    },
    series: [{
      type: 'heatmap',
      data: heatData,
      label: { show: true, formatter: (p: any) => p.value[2] === 0 ? '' : p.value[2], color: '#fff', fontSize: 12 },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
    }],
  })
}

// ── ADMET radar ────────────────────────────────────────────────────────────────

function initAdmetChart() {
  if (!admetChart.value) return
  let chart = echarts.getInstanceByDom(admetChart.value)
  if (!chart) {
    chart = echarts.init(admetChart.value, 'dark', { renderer: 'canvas' })
    chartInstances.push(chart)
  }
  updateAdmetChart(chart)
}

function updateAdmetChart(existingChart?: echarts.ECharts) {
  const el = admetChart.value
  if (!el) return
  const chart = existingChart ?? echarts.getInstanceByDom(el)
  if (!chart) return
  const dims = ['Absorption', 'Distribution', 'Metabolism', 'Excretion', 'Toxicity']
  const seriesColors = ['#5794f2', '#ff9830', '#73bf69', '#f2495c', '#b877d9', '#fade2a', '#19dde2']
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {},
    legend: { bottom: 10, textStyle: { color: '#aaa', fontSize: 11 } },
    radar: {
      indicator: dims.map(d => ({ name: d, max: 10 })),
      axisName: { color: '#aaa' },
      splitLine: { lineStyle: { color: '#333' } },
      splitArea: { areaStyle: { color: ['rgba(255,255,255,0.02)', 'transparent'] } },
    },
    series: [{
      type: 'radar',
      data: admetSelected.value.map((id, i) => ({
        name: NODES.find(n => n.id === id)?.label ?? id,
        value: dims.map(d => ADMET[id]?.[d] ?? 0),
        areaStyle: { opacity: 0.15 },
        lineStyle: { color: seriesColors[i % seriesColors.length] },
        itemStyle: { color: seriesColors[i % seriesColors.length] },
      })),
    }],
  })
}

// ── Resize ─────────────────────────────────────────────────────────────────────

function onResize() { chartInstances.forEach(c => c.resize()) }

// ── Lifecycle ──────────────────────────────────────────────────────────────────

onMounted(() => {
  nextTick(() => initNetworkChart())
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  chartInstances.forEach(c => c.dispose())
  window.removeEventListener('resize', onResize)
})

watch(admetSelected, () => updateAdmetChart(), { deep: true })
</script>

<style scoped>
.dd-shell {
  display: flex;
  height: 100%;
  overflow: hidden;
  gap: 0;
}

.dd-sidebar {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.dd-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.dd-detail {
  width: 220px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  overflow-y: auto;
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px;
}

.chip {
  padding: 3px 8px;
  font-size: 11px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.chip.active, .chip:hover {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.compound-list {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.compound-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  cursor: pointer;
  transition: background 0.1s;
}
.compound-item:hover { background: var(--bg-panel-hover, rgba(255,255,255,0.04)); }
.compound-item.selected { background: var(--primary-subtle, rgba(87,148,242,0.12)); }

.compound-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tab-bar {
  display: flex;
  border-bottom: 1px solid var(--border);
  padding: 0 12px;
  gap: 0;
}

.tab-btn {
  padding: 10px 16px;
  font-size: 13px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.tab-btn:hover { color: var(--text-primary); }
.tab-btn.active {
  color: var(--primary, #5794f2);
  border-bottom-color: var(--primary, #5794f2);
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

.tab-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.chart-fill {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.detail-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-bottom: 3px;
}

.detail-value {
  font-size: 13px;
  font-weight: 500;
}
</style>

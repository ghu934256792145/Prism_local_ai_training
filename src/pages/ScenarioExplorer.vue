<template>
  <div class="scenarios-page">
    <!-- Scenario tabs -->
    <div class="scenario-tabs">
      <button
        v-for="s in SCENARIOS"
        :key="s.id"
        class="scenario-tab"
        :class="{ active: activeId === s.id }"
        @click="selectScenario(s.id)"
      >
        <span class="tab-icon" v-html="s.icon"></span>
        <div class="tab-text">
          <span class="tab-label">{{ s.label }}</span>
          <span class="tab-sub">{{ s.tags[0] }}</span>
        </div>
      </button>
    </div>

    <!-- Active scenario content -->
    <div class="scenario-content" v-if="active">
      <!-- Description row -->
      <div class="desc-row panel">
        <div style="padding:10px 16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          <p style="font-size:13px;color:var(--text-secondary);flex:1;min-width:200px">{{ active.description }}</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <span v-for="tag in active.tags" :key="tag" class="badge badge-cyan" style="font-size:10px">{{ tag }}</span>
          </div>
          <div style="display:flex;gap:8px">
            <button
              v-for="op in matrixOps"
              :key="op.key"
              class="btn"
              :class="{ 'btn-primary': matrixOp === op.key }"
              style="padding:4px 10px;font-size:11px"
              @click="switchMatrixOp(op.key)"
            >{{ op.label }}</button>
          </div>
        </div>
      </div>

      <!-- Three-panel grid -->
      <div class="panels-grid">
        <!-- Graph -->
        <div class="panel" style="grid-area:graph">
          <div class="panel-header">
            <span class="panel-title">{{ active.label }} — Dependency Graph</span>
            <div style="display:flex;gap:6px;align-items:center">
              <span class="badge" :style="{ background: active.badgeBg, color: active.badgeColor }">
                {{ graphData?.nodes.length ?? 0 }} nodes · {{ graphData?.edges.length ?? 0 }} edges
              </span>
              <span v-if="loading" class="text-muted" style="font-size:11px">Loading…</span>
            </div>
          </div>
          <div style="flex:1;min-height:0">
            <VChart v-if="graphOption" :option="graphOption" autoresize style="width:100%;height:100%" />
            <div v-else class="placeholder-area">
              <span class="text-muted">{{ loading ? 'Fetching graph…' : 'No data' }}</span>
            </div>
          </div>
        </div>

        <!-- Matrix -->
        <div class="panel" style="grid-area:matrix">
          <div class="panel-header">
            <span class="panel-title">{{ active.matrixLabel }}</span>
            <span class="badge badge-purple" style="font-size:10px">{{ matrixOp }}</span>
          </div>
          <div style="flex:1;min-height:0">
            <VChart v-if="matrixOption" :option="matrixOption" autoresize style="width:100%;height:100%" />
            <div v-else class="placeholder-area">
              <span class="text-muted">{{ loading ? 'Fetching matrix…' : 'No data' }}</span>
            </div>
          </div>
        </div>

        <!-- Vector -->
        <div class="panel" style="grid-area:vector">
          <div class="panel-header">
            <span class="panel-title">{{ active.vectorLabel }}</span>
            <span class="badge badge-blue" style="font-size:10px">{{ vectorData?.clusterNames.length ?? 0 }} clusters · {{ vectorData?.points.length ?? 0 }} pts</span>
          </div>
          <div style="flex:1;min-height:0">
            <VChart v-if="vectorOption" :option="vectorOption" autoresize style="width:100%;height:100%" />
            <div v-else class="placeholder-area">
              <span class="text-muted">{{ loading ? 'Fetching vectors…' : 'No data' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { GraphChart, HeatmapChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent, TooltipComponent, LegendComponent,
  VisualMapComponent, MarkPointComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import { usePrismAPI } from '@/composables/usePrismAPI'

use([CanvasRenderer, GraphChart, HeatmapChart, ScatterChart, GridComponent, TooltipComponent, LegendComponent, VisualMapComponent, MarkPointComponent])

const api = usePrismAPI()

// ── Scenario metadata ──────────────────────────────────────────────────────────

interface ScenarioDef {
  id: string
  label: string
  description: string
  tags: string[]
  icon: string
  badgeBg: string
  badgeColor: string
  matrixLabel: string
  vectorLabel: string
  categoryColors: string[]
}

const SCENARIOS: ScenarioDef[] = [
  {
    id: 'network_security',
    label: 'Network Security',
    description: 'Attack graph: threat actors, CVE exploitation paths, lateral movement, SIEM monitoring, and firewall segmentation.',
    tags: ['security', 'attack-graph', 'CVE', 'incident-response'],
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    badgeBg: 'rgba(242,73,92,0.15)', badgeColor: '#f2495c',
    matrixLabel: 'Threat Incident Heatmap (CVE category × Month)',
    vectorLabel: 'Security Event Embedding Space',
    categoryColors: ['#f2495c', '#ff9830', '#f2cc0c', '#b877d9', '#19dde2', '#5794f2'],
  },
  {
    id: 'network_topology',
    label: 'Network Topology',
    description: 'BGP routing fabric: core/edge routers, AS peering, Internet Exchange points, leaf-spine datacenter fabric.',
    tags: ['networking', 'BGP', 'routing', 'datacenter'],
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="17" y="2" width="5" height="5" rx="1"/><rect x="9" y="17" width="5" height="5" rx="1"/><line x1="4.5" y1="7" x2="4.5" y2="12"/><line x1="19.5" y1="7" x2="19.5" y2="12"/><line x1="4.5" y1="12" x2="11.5" y2="19"/><line x1="19.5" y1="12" x2="13" y2="19"/></svg>`,
    badgeBg: 'rgba(25,221,226,0.15)', badgeColor: '#19dde2',
    matrixLabel: 'RTT Latency Matrix (Router × Month, ms)',
    vectorLabel: 'Network Segment Embedding Space',
    categoryColors: ['#5794f2', '#73bf69', '#19dde2', '#f2cc0c', '#b877d9'],
  },
  {
    id: 'financial_contagion',
    label: 'Financial Contagion',
    description: 'Systemic risk graph: G-SIB exposure networks, clearing houses, hedge funds, and contagion propagation paths.',
    tags: ['finance', 'risk', 'contagion', 'stress-test'],
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    badgeBg: 'rgba(242,204,12,0.15)', badgeColor: '#f2cc0c',
    matrixLabel: 'Institution Exposure Matrix (Bn USD × Month)',
    vectorLabel: 'Institution Risk Profile Embeddings',
    categoryColors: ['#f2cc0c', '#5794f2', '#73bf69', '#ff9830', '#b877d9'],
  },
  {
    id: 'supply_chain',
    label: 'Supply Chain',
    description: 'ERP dependency graph: raw materials, manufacturers, distributors, logistics, retailers across global supply network.',
    tags: ['supply-chain', 'ERP', 'logistics', 'procurement'],
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
    badgeBg: 'rgba(115,191,105,0.15)', badgeColor: '#73bf69',
    matrixLabel: 'Lead-Time Matrix (Days × Month)',
    vectorLabel: 'Supplier Capability Embeddings',
    categoryColors: ['#ff9830', '#5794f2', '#73bf69', '#f2cc0c', '#b877d9', '#19dde2'],
  },
]

const MATRIX_OPS: Record<string, { key: string; label: string }[]> = {
  network_security:    [{ key: 'incidents', label: 'Incidents' }, { key: 'risk_score', label: 'Risk Score' }],
  network_topology:    [{ key: 'latency_ms', label: 'Latency' }, { key: 'risk_score', label: 'Risk Score' }],
  financial_contagion: [{ key: 'exposure_bn', label: 'Exposure' }, { key: 'risk_score', label: 'Risk Score' }],
  supply_chain:        [{ key: 'lead_days', label: 'Lead Days' }, { key: 'risk_score', label: 'Risk Score' }],
}

// ── State ──────────────────────────────────────────────────────────────────────

const activeId = ref(SCENARIOS[0].id)
const matrixOp = ref<string>('incidents')
const loading = ref(false)

interface GraphData { nodes: any[]; edges: any[]; categories: string[] }
interface MatrixData { rowLabels: string[]; colLabels: string[]; data: { row: number; col: number; value: number }[]; op: string }
interface VectorData { points: { id: string; x: number; y: number; cluster: number; label: string; score: number }[]; clusterNames: string[] }

const graphData = ref<GraphData | null>(null)
const matrixData = ref<MatrixData | null>(null)
const vectorData = ref<VectorData | null>(null)

const active = computed(() => SCENARIOS.find(s => s.id === activeId.value)!)
const matrixOps = computed(() => MATRIX_OPS[activeId.value] ?? [])

async function loadAll() {
  loading.value = true
  const id = activeId.value
  const op = matrixOps.value[0]?.key ?? 'default'
  matrixOp.value = op

  const [g, m, v] = await Promise.all([
    api.getScenarioGraph(id),
    api.postScenarioMatrix(id, op, {}),
    api.getScenarioVector(id),
  ])
  if (id !== activeId.value) return // stale response — another tab was clicked
  graphData.value = g as GraphData
  matrixData.value = m as MatrixData
  vectorData.value = v as VectorData
  loading.value = false
}

async function switchMatrixOp(op: string) {
  matrixOp.value = op
  const m = await api.postScenarioMatrix(activeId.value, op, {})
  matrixData.value = m as MatrixData
}

function selectScenario(id: string) {
  activeId.value = id
}

watch(activeId, () => loadAll())
onMounted(() => loadAll())

// ── ECharts options ────────────────────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: '#1f2330',
  borderColor: '#2c3235',
  textStyle: { color: '#d0d0d0', fontSize: 12 },
}

const graphOption = computed(() => {
  if (!graphData.value) return null
  const { nodes, edges, categories } = graphData.value
  const colors = active.value.categoryColors
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      ...TOOLTIP_STYLE,
      formatter: (p: any) => p.dataType === 'node'
        ? `<b>${p.data.name}</b><br/>Category: ${categories[p.data.category] ?? '?'}`
        : `${p.data.source} → ${p.data.target}<br/><span style="color:#19dde2">${p.data.label}</span>`,
    },
    legend: {
      data: categories.map((c, i) => ({ name: c, icon: 'circle', itemStyle: { color: colors[i] ?? '#888' } })),
      textStyle: { color: '#8e8e8e', fontSize: 10 },
      bottom: 4,
      itemWidth: 8,
      itemHeight: 8,
    },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      symbol: 'circle',
      categories: categories.map((name, i) => ({ name, itemStyle: { color: colors[i] ?? '#888' } })),
      data: nodes.map((n: any) => ({
        id: n.id,
        name: n.label,
        category: n.category,
        symbolSize: n.symbolSize ?? 24,
        label: { show: n.symbolSize > 28, fontSize: 10, color: '#d0d0d0' },
      })),
      edges: edges.map((e: any) => ({
        source: e.source,
        target: e.target,
        label: e.label,
        lineStyle: { width: Math.max(1, (e.weight ?? 1) * 0.6), opacity: 0.7 },
      })),
      force: { repulsion: 220, edgeLength: [60, 180], gravity: 0.08 },
      lineStyle: { curveness: 0.2, color: 'source', opacity: 0.5 },
      emphasis: { focus: 'adjacency', lineStyle: { width: 3 } },
    }],
  }
})

const matrixOption = computed(() => {
  if (!matrixData.value) return null
  const { rowLabels, colLabels, data } = matrixData.value
  const vals = data.map((d: any) => d.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  return {
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      ...TOOLTIP_STYLE,
      formatter: (p: any) => `${rowLabels[p.data[1]]} / ${colLabels[p.data[0]]}<br/><b>${p.data[2]}</b>`,
    },
    grid: { top: 10, bottom: 56, left: 100, right: 20 },
    xAxis: { type: 'category', data: colLabels, axisLabel: { color: '#8e8e8e', fontSize: 10 }, axisLine: { lineStyle: { color: '#2c3235' } } },
    yAxis: { type: 'category', data: rowLabels, inverse: true, axisLabel: { color: '#8e8e8e', fontSize: 10 }, axisLine: { lineStyle: { color: '#2c3235' } } },
    visualMap: {
      min, max,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      textStyle: { color: '#8e8e8e', fontSize: 10 },
      inRange: { color: ['#0a1628', '#5794f2', '#73bf69', '#f2cc0c', '#f2495c'] },
    },
    series: [{
      type: 'heatmap',
      data: data.map((d: any) => [d.col, d.row, d.value]),
      label: { show: false },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.6)' } },
    }],
  }
})

const vectorOption = computed(() => {
  if (!vectorData.value) return null
  const { points, clusterNames } = vectorData.value
  const CLUSTER_COLORS = ['#5794f2', '#73bf69', '#b877d9', '#19dde2', '#ff9830', '#f2cc0c']
  const seriesData = clusterNames.map((name, ci) => ({
    name,
    type: 'scatter',
    data: points.filter((p: any) => p.cluster === ci).map((p: any) => ({
      value: [p.x, p.y],
      name: p.label,
      score: p.score,
    })),
    symbolSize: (d: any) => 6 + (d.score ?? 0.6) * 10,
    itemStyle: { color: CLUSTER_COLORS[ci % CLUSTER_COLORS.length], opacity: 0.85 },
    emphasis: { scale: 1.4 },
  }))

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      ...TOOLTIP_STYLE,
      formatter: (p: any) => `<b>${p.data.name}</b><br/>Score: ${p.data.score?.toFixed(2) ?? '–'}<br/><span style="color:#19dde2">${p.seriesName}</span>`,
    },
    legend: {
      data: clusterNames,
      textStyle: { color: '#8e8e8e', fontSize: 10 },
      bottom: 4,
      itemWidth: 8,
      itemHeight: 8,
    },
    grid: { top: 10, bottom: 40, left: 30, right: 20 },
    xAxis: { type: 'value', scale: true, axisLabel: { color: '#555', fontSize: 9 }, axisLine: { lineStyle: { color: '#2c3235' } }, splitLine: { lineStyle: { color: '#1e2530' } } },
    yAxis: { type: 'value', scale: true, axisLabel: { color: '#555', fontSize: 9 }, axisLine: { lineStyle: { color: '#2c3235' } }, splitLine: { lineStyle: { color: '#1e2530' } } },
    series: seriesData,
  }
})
</script>

<style scoped>
.scenarios-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: calc(100vh - var(--header-height) - 28px);
}

.scenario-tabs {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.scenario-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: var(--panel-radius);
  background: var(--bg-panel);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
  flex: 1;
  min-width: 0;
}
.scenario-tab:hover {
  border-color: var(--border-hover);
  color: var(--text-primary);
  background: var(--bg-panel-hover);
}
.scenario-tab.active {
  border-color: var(--accent-blue);
  background: rgba(87,148,242,0.08);
  color: var(--accent-blue);
}
.tab-icon { flex-shrink: 0; display: flex; align-items: center; }
.tab-text { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
.tab-label { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tab-sub { font-size: 10px; color: var(--text-muted); margin-top: 1px; }
.scenario-tab.active .tab-sub { color: var(--accent-blue); opacity: 0.7; }

.desc-row { flex-shrink: 0; }

.scenario-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panels-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-areas:
    "graph matrix"
    "graph vector";
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 10px;
}

.placeholder-area {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>

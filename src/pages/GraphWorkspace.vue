<template>
  <div class="workspace-page">

    <!-- ── Layer panel ── -->
    <aside class="layer-panel panel">
      <div class="panel-header">
        <span class="panel-title">Layers</span>
        <button class="btn btn-sm" @click="showAdd = !showAdd">{{ showAdd ? '✕' : '+ Add' }}</button>
      </div>

      <!-- Add-layer form -->
      <div v-if="showAdd" class="add-form">
        <select v-model="addSource" class="ctrl-select w-full">
          <optgroup label="── Scenarios ──">
            <option value="scenario:service-graph">Service Mesh</option>
            <option value="scenario:network-security">Network Security</option>
            <option value="scenario:network-topology">Network Topology</option>
            <option value="scenario:financial-contagion">Financial Contagion</option>
            <option value="scenario:supply-chain">Supply Chain</option>
          </optgroup>
          <optgroup label="── Live Store ──">
            <option value="store:live">Live Store (dynamic)</option>
          </optgroup>
        </select>
        <button class="btn btn-sm btn-primary w-full" :disabled="adding" @click="addLayer">
          {{ adding ? 'Loading…' : '+ Add Layer' }}
        </button>
      </div>

      <!-- Layer list -->
      <div v-if="layers.length === 0" class="empty-hint text-muted">
        Add a layer to begin exploring.
      </div>
      <div v-for="layer in layers" :key="layer.id" class="layer-item">
        <div class="layer-row">
          <button
            class="vis-btn"
            :style="{ color: layer.visible ? layer.color : 'var(--text-muted)' }"
            :title="layer.visible ? 'Hide layer' : 'Show layer'"
            @click="layer.visible = !layer.visible"
          >{{ layer.visible ? '●' : '○' }}</button>
          <div
            class="color-dot"
            :style="{ background: layer.color }"
            title="Cycle color"
            @click="cycleColor(layer)"
          />
          <div class="layer-info">
            <div class="layer-name">{{ layer.name }}</div>
            <div class="layer-stat text-muted">{{ layer.nodes.length }}n · {{ layer.edges.length }}e</div>
          </div>
          <button class="rm-btn text-muted" title="Remove" @click="removeLayer(layer.id)">✕</button>
        </div>
        <div class="opacity-row">
          <span class="op-label text-muted">α</span>
          <input
            type="range" min="0.1" max="1" step="0.05"
            :value="layer.opacity"
            class="opacity-slider"
            :style="{ accentColor: layer.color }"
            @input="layer.opacity = +($event.target as HTMLInputElement).value"
          />
          <span class="op-val text-muted">{{ Math.round(layer.opacity * 100) }}%</span>
        </div>
      </div>

      <!-- Totals -->
      <div v-if="layers.length > 0" class="layer-totals text-muted">
        <span>{{ totalNodes }} nodes · {{ totalEdges }} edges visible</span>
      </div>
    </aside>

    <!-- ── Edge filter panel ── -->
    <aside class="filter-panel panel">
      <div class="panel-header">
        <span class="panel-title">Edge Types</span>
        <button class="btn btn-sm" @click="toggleAllEdgeFilters">
          {{ hiddenLabels.size === 0 ? 'Hide all' : 'Show all' }}
        </button>
      </div>
      <div v-if="edgeLabels.length === 0" class="empty-hint text-muted">No edges yet.</div>
      <div v-for="label in edgeLabels" :key="label" class="filter-row">
        <label class="filter-label">
          <input
            type="checkbox"
            class="filter-check"
            :checked="!hiddenLabels.has(label)"
            @change="toggleEdgeLabel(label)"
          />
          <span class="filter-text">{{ label }}</span>
        </label>
        <span class="filter-count text-muted">{{ edgeLabelCount[label] }}</span>
      </div>
    </aside>

    <!-- ── Main canvas ── -->
    <div class="canvas-area">
      <div v-if="layers.length === 0" class="canvas-hint">
        <div class="hint-icon">⬡</div>
        <div class="hint-text">Add layers from the left panel to begin.</div>
        <div class="hint-sub text-muted">Each layer is independently colored and toggled.</div>
      </div>
      <VChart v-else ref="chartRef" :option="chartOption" autoresize class="echarts-canvas" />

      <!-- Canvas toolbar -->
      <div v-if="layers.length > 0" class="canvas-toolbar">
        <button class="btn btn-sm" title="Reset zoom" @click="resetView">⊕ Fit</button>
        <div class="canvas-legend">
          <span
            v-for="layer in visibleLayers"
            :key="layer.id"
            class="legend-chip"
            :style="{ borderColor: layer.color, color: layer.color }"
          >{{ layer.name }}</span>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { usePrismAPI } from '@/composables/usePrismAPI'

use([CanvasRenderer, GraphChart, TooltipComponent, LegendComponent])

const api = usePrismAPI()
const chartRef = ref()

// ── Layer palette ──────────────────────────────────────────────────────────────
const PALETTE = [
  '#5794f2', '#73bf69', '#f2cc0c', '#ff7b3b',
  '#b877d9', '#56a64b', '#e02f44', '#37872d',
]

interface GraphLayer {
  id: string
  name: string
  visible: boolean
  color: string
  opacity: number
  nodes: any[]
  edges: any[]
}

const layers = ref<GraphLayer[]>([])
const showAdd = ref(false)
const adding = ref(false)
const addSource = ref('scenario:service-graph')

function layerColor(idx: number) {
  return PALETTE[idx % PALETTE.length]
}

function cycleColor(layer: GraphLayer) {
  const idx = PALETTE.indexOf(layer.color)
  layer.color = PALETTE[(idx + 1) % PALETTE.length]
}

function removeLayer(id: string) {
  layers.value = layers.value.filter(l => l.id !== id)
}

async function addLayer() {
  if (adding.value) return
  adding.value = true
  showAdd.value = false

  const id = crypto.randomUUID()
  const color = layerColor(layers.value.length)

  try {
    const [kind, key] = addSource.value.split(':')
    let nodes: any[] = []
    let edges: any[] = []
    let name = key

    if (kind === 'scenario') {
      const g: any = await api.getScenarioGraph(key)
      if (g) { nodes = g.nodes ?? []; edges = g.edges ?? [] }
      const LABELS: Record<string, string> = {
        'service-graph': 'Service Mesh',
        'network-security': 'Network Security',
        'network-topology': 'Network Topology',
        'financial-contagion': 'Financial Contagion',
        'supply-chain': 'Supply Chain',
      }
      name = LABELS[key] ?? key
    } else if (kind === 'store') {
      const g: any = await api.getLiveGraph()
      if (g) { nodes = g.nodes ?? []; edges = g.edges ?? [] }
      name = 'Live Store'
    }

    layers.value.push({ id, name, visible: true, color, opacity: 1.0, nodes, edges })
  } finally {
    adding.value = false
  }
}

// ── Edge filter ────────────────────────────────────────────────────────────────
const hiddenLabels = ref<Set<string>>(new Set())

const edgeLabels = computed(() => {
  const labels = new Set<string>()
  for (const l of layers.value.filter(l => l.visible)) {
    for (const e of l.edges) if (e.label) labels.add(e.label)
  }
  return [...labels].sort()
})

const edgeLabelCount = computed(() => {
  const counts: Record<string, number> = {}
  for (const l of layers.value.filter(l => l.visible)) {
    for (const e of l.edges) {
      if (!e.label) continue
      counts[e.label] = (counts[e.label] ?? 0) + 1
    }
  }
  return counts
})

function toggleEdgeLabel(label: string) {
  const s = new Set(hiddenLabels.value)
  if (s.has(label)) s.delete(label); else s.add(label)
  hiddenLabels.value = s
}

function toggleAllEdgeFilters() {
  if (hiddenLabels.value.size === 0) {
    hiddenLabels.value = new Set(edgeLabels.value)
  } else {
    hiddenLabels.value = new Set()
  }
}

// ── Derived state ──────────────────────────────────────────────────────────────
const visibleLayers = computed(() => layers.value.filter(l => l.visible))

const totalNodes = computed(() =>
  visibleLayers.value.reduce((s, l) => s + l.nodes.length, 0)
)
const totalEdges = computed(() =>
  visibleLayers.value.reduce((s, l) => {
    return s + l.edges.filter((e: any) => !hiddenLabels.value.has(e.label)).length
  }, 0)
)

// ── ECharts option ─────────────────────────────────────────────────────────────
const chartOption = computed(() => {
  const cats: any[] = []
  const nodes: any[] = []
  const links: any[] = []

  for (const [li, layer] of visibleLayers.value.entries()) {
    cats.push({ name: layer.name, itemStyle: { color: layer.color } })

    for (const nd of layer.nodes) {
      nodes.push({
        id: `${layer.id}::${nd.id}`,
        name: nd.label ?? nd.id,
        value: nd.value ?? 5,
        symbolSize: nd.symbolSize ?? nd.symbol_size ?? 26,
        category: li,
        itemStyle: { color: layer.color, opacity: layer.opacity },
        label: {
          show: true,
          fontSize: 10,
          color: '#c8c8c8',
        },
      })
    }

    for (const ed of layer.edges) {
      if (hiddenLabels.value.has(ed.label)) continue
      links.push({
        source: `${layer.id}::${ed.source}`,
        target: `${layer.id}::${ed.target}`,
        label: {
          show: false,
          formatter: ed.label,
          fontSize: 9,
        },
        lineStyle: {
          color: layer.color,
          opacity: layer.opacity * 0.65,
          width: Math.max(1, (ed.weight ?? 1) / 3),
          curveness: 0.08,
        },
      })
    }
  }

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        if (p.dataType === 'edge') return `${p.data.label ?? '→'}`
        const layerName = cats[p.data.category]?.name ?? ''
        return `<b>${p.name}</b><br/><span style="opacity:.7">${layerName}</span>`
      },
    },
    legend: {
      data: cats.map(c => c.name),
      orient: 'horizontal',
      top: 8,
      right: 16,
      textStyle: { color: '#c8c8c8', fontSize: 11 },
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      animation: true,
      animationDuration: 800,
      force: {
        repulsion: 280,
        edgeLength: [80, 220],
        gravity: 0.05,
        layoutAnimation: true,
      },
      emphasis: {
        focus: 'adjacency',
        lineStyle: { width: 3 },
      },
      categories: cats,
      data: nodes,
      links,
    }],
  }
})

// Watch visible layer changes and reset hidden edge labels for newly revealed labels
watch(edgeLabels, (newLabels) => {
  const s = new Set(hiddenLabels.value)
  for (const l of s) {
    if (!newLabels.includes(l)) s.delete(l)
  }
  hiddenLabels.value = s
})

function resetView() {
  chartRef.value?.chart?.dispatchAction({ type: 'restore' })
}
</script>

<style scoped>
.workspace-page {
  display: grid;
  grid-template-columns: 220px 160px 1fr;
  grid-template-rows: 1fr;
  gap: 8px;
  height: 100%;
  overflow: hidden;
}

/* ── Layer panel ── */
.layer-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow-y: auto;
  min-height: 0;
}

.add-form {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-bottom: 1px solid var(--border);
}

.w-full { width: 100%; }

.empty-hint {
  padding: 16px 12px;
  font-size: 12px;
  text-align: center;
}

.layer-item {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.layer-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.vis-btn {
  width: 18px;
  height: 18px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 0;
  transition: color 0.15s;
}

.color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s;
}
.color-dot:hover { transform: scale(1.3); }

.layer-info {
  flex: 1;
  min-width: 0;
}
.layer-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.layer-stat { font-size: 10px; }

.rm-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  padding: 2px 4px;
  flex-shrink: 0;
}
.rm-btn:hover { color: var(--accent-red, #e02f44); }

.opacity-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.op-label { font-size: 10px; flex-shrink: 0; }
.opacity-slider { flex: 1; height: 3px; cursor: pointer; }
.op-val { font-size: 10px; flex-shrink: 0; width: 28px; text-align: right; }

.layer-totals {
  padding: 10px 12px;
  font-size: 11px;
  margin-top: auto;
  border-top: 1px solid var(--border);
}

/* ── Filter panel ── */
.filter-panel {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
}

.filter-row {
  display: flex;
  align-items: center;
  padding: 5px 12px;
  gap: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.filter-label {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  cursor: pointer;
  min-width: 0;
}
.filter-check { flex-shrink: 0; cursor: pointer; }
.filter-text {
  font-size: 11px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.filter-count { font-size: 10px; flex-shrink: 0; }

/* ── Canvas ── */
.canvas-area {
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.echarts-canvas {
  width: 100%;
  height: 100%;
}

.canvas-hint {
  text-align: center;
  user-select: none;
}
.hint-icon {
  font-size: 56px;
  color: var(--border-hover);
  margin-bottom: 12px;
  line-height: 1;
}
.hint-text {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.hint-sub { font-size: 12px; }

.canvas-toolbar {
  position: absolute;
  bottom: 10px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.canvas-legend {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.legend-chip {
  font-size: 10px;
  padding: 2px 8px;
  border: 1px solid;
  border-radius: 3px;
  background: rgba(0,0,0,0.4);
  white-space: nowrap;
}
</style>

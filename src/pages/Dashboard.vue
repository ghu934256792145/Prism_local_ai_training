<template>
  <div class="dashboard-page">
    <!-- KPI row -->
    <div class="kpi-row">
      <div v-for="kpi in kpis" :key="kpi.label" class="kpi-card">
        <div class="kpi-value" :style="{ color: kpi.color }">{{ kpi.value }}</div>
        <div class="kpi-label">{{ kpi.label }}</div>
        <div class="kpi-delta" :class="kpi.deltaPos ? 'pos' : 'neg'">{{ kpi.delta }}</div>
      </div>
    </div>

    <!-- Toolbar row -->
    <div class="toolbar-row">
      <span class="text-muted" style="font-size:12px">{{ panels.filter(p => p.visible).length }} of {{ panels.length }} panels visible</span>
      <div style="display:flex;gap:6px;align-items:center">
        <button
          v-for="p in panels"
          :key="p.id"
          class="panel-chip"
          :class="{ active: p.visible }"
          @click="p.visible = !p.visible"
        >{{ p.label }}</button>
        <div class="toolbar-sep"></div>
        <button class="btn" style="padding:4px 10px;font-size:11px" title="Reset to default layout" @click="resetLayout">⟳ Reset</button>
        <button class="btn" style="padding:4px 10px;font-size:11px" title="Export dashboard config" @click="exportConfig">⬇ Export</button>
        <label class="btn" style="padding:4px 10px;font-size:11px;cursor:pointer" title="Import dashboard config">
          ⬆ Import
          <input type="file" accept=".json" style="display:none" @change="importConfig">
        </label>
      </div>
    </div>

    <!-- Draggable panels grid -->
    <div class="panel-grid">
      <template v-for="p in panels" :key="p.id">
        <div
          v-if="p.visible"
          class="panel-slot"
          :class="{ 'drag-over': dragOverId === p.id, 'is-dragging': dragSourceId === p.id }"
          :style="{ gridColumn: `span ${p.span}` }"
          draggable="true"
          @dragstart="onDragStart($event, p.id)"
          @dragover.prevent="onDragOver(p.id)"
          @drop.prevent="onDrop(p.id)"
          @dragend="onDragEnd"
          @dragleave="onDragLeave"
        >
          <div class="panel-drag-header">
            <span class="grip" title="Drag to reorder">⠿</span>
            <span class="panel-name">{{ p.label }}</span>
            <button
              class="resize-btn"
              :title="p.span === 1 ? 'Expand to full width' : 'Collapse to half width'"
              @click.stop="toggleSpan(p.id)"
            >{{ p.span === 1 ? '⤢' : '⤡' }}</button>
          </div>
          <div class="panel-body">
            <GraphPanel    v-if="p.id === 'graph'" />
            <MatrixHeatmap v-if="p.id === 'matrix'" />
            <VectorMap     v-if="p.id === 'vector'" />
            <AISummary     v-if="p.id === 'ai'" />
            <NVMeStats     v-if="p.id === 'nvme'" />
          </div>
        </div>
      </template>

      <!-- Plugin panel slots (driven by pluginStore) -->
      <template v-for="inst in pluginStore.panelPlugins" :key="'plugin:' + inst.id">
        <div class="panel-slot plugin-panel-slot">
          <div class="panel-drag-header">
            <span class="grip">⠿</span>
            <span class="panel-name">{{ inst.icon }} {{ inst.name }}</span>
            <router-link to="/plugins" class="resize-btn" title="Manage plugins" style="text-decoration:none">⚙</router-link>
          </div>
          <div class="panel-body">
            <component :is="getPluginComponent(inst.id)" />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, defineAsyncComponent, type Component } from 'vue'
import GraphPanel from '@/components/GraphPanel.vue'
import MatrixHeatmap from '@/components/MatrixHeatmap.vue'
import VectorMap from '@/components/VectorMap.vue'
import AISummary from '@/components/AISummary.vue'
import NVMeStats from '@/components/NVMeStats.vue'
import { usePluginStore } from '@/stores/pluginStore'

interface PanelConfig {
  id: string
  label: string
  visible: boolean
  span: 1 | 2
}

const STORAGE_KEY = 'prism-dashboard-config'

const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'graph',  label: 'Graph',  visible: true, span: 1 },
  { id: 'matrix', label: 'Matrix', visible: true, span: 1 },
  { id: 'vector', label: 'Vector', visible: true, span: 1 },
  { id: 'ai',     label: 'AI',     visible: true, span: 1 },
  { id: 'nvme',   label: 'NVMe',   visible: true, span: 1 },
]

function parsePanels(raw: unknown): PanelConfig[] {
  if (!Array.isArray(raw)) return DEFAULT_PANELS.map(p => ({ ...p }))
  const parsed = raw as Partial<PanelConfig>[]
  const result: PanelConfig[] = parsed
    .filter(p => DEFAULT_PANELS.some(d => d.id === p.id))
    .map(p => {
      const def = DEFAULT_PANELS.find(d => d.id === p.id)!
      return { ...def, visible: p.visible ?? def.visible, span: p.span === 2 ? 2 : 1 }
    })
  DEFAULT_PANELS.forEach(d => { if (!result.some(r => r.id === d.id)) result.push({ ...d }) })
  return result
}

function loadPanels(): PanelConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return parsePanels(JSON.parse(stored))
  } catch { /* ignore */ }
  return DEFAULT_PANELS.map(p => ({ ...p }))
}

const panels = ref<PanelConfig[]>(loadPanels())

watch(panels, val => localStorage.setItem(STORAGE_KEY, JSON.stringify(val)), { deep: true })

function toggleSpan(id: string) {
  const p = panels.value.find(p => p.id === id)
  if (p) p.span = p.span === 1 ? 2 : 1
}

function resetLayout() {
  panels.value = DEFAULT_PANELS.map(p => ({ ...p }))
}

// ── Drag-and-drop ──────────────────────────────────────────────────────────
const dragSourceId = ref<string | null>(null)
const dragOverId   = ref<string | null>(null)
let leaveTimer: number | null = null

function onDragStart(e: DragEvent, id: string) {
  dragSourceId.value = id
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(id: string) {
  if (leaveTimer !== null) { clearTimeout(leaveTimer); leaveTimer = null }
  if (id !== dragSourceId.value) dragOverId.value = id
}

function onDrop(targetId: string) {
  const sourceId = dragSourceId.value
  if (!sourceId || sourceId === targetId) { cleanup(); return }
  const arr = panels.value
  const si = arr.findIndex(p => p.id === sourceId)
  const ti = arr.findIndex(p => p.id === targetId)
  if (si !== -1 && ti !== -1) {
    ;[arr[si], arr[ti]] = [arr[ti], arr[si]]
  }
  cleanup()
}

function onDragLeave() {
  leaveTimer = window.setTimeout(() => { dragOverId.value = null }, 80)
}

function onDragEnd() { cleanup() }

function cleanup() {
  dragSourceId.value = null
  dragOverId.value   = null
  if (leaveTimer !== null) { clearTimeout(leaveTimer); leaveTimer = null }
}

// ── Export / Import ────────────────────────────────────────────────────────
function exportConfig() {
  const json = JSON.stringify(panels.value, null, 2)
  const url  = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'prism-dashboard.json' })
  a.click()
  URL.revokeObjectURL(url)
}

function importConfig(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = ev => {
    try { panels.value = parsePanels(JSON.parse(ev.target?.result as string)) } catch { /* ignore */ }
  }
  reader.readAsText(file)
}

// ── Plugin panel support ───────────────────────────────────────────────────
const pluginStore = usePluginStore()

const PLUGIN_COMPONENTS: Record<string, () => Promise<{ default: Component }>> = {
  'builtin.risk-heatmap': () => import('@/plugins/RiskHeatmapPanel.vue'),
}

function getPluginComponent(id: string): Component {
  const loader = PLUGIN_COMPONENTS[id]
  return loader ? defineAsyncComponent(loader) : { template: '<div class="text-muted" style="padding:8px;font-size:11px">No component registered</div>' }
}

const kpis = ref([
  { label: 'Graph Nodes',   value: '20',    delta: '+2 today',   deltaPos: true,  color: '#5794f2' },
  { label: 'Vector Dims',   value: '512',   delta: 'stable',     deltaPos: true,  color: '#b877d9' },
  { label: 'Matrix Ops/s',  value: '24K',   delta: '+8% vs avg', deltaPos: true,  color: '#73bf69' },
  { label: 'NVMe IOPS',     value: '485K',  delta: '42µs lat',   deltaPos: true,  color: '#19dde2' },
  { label: 'AI Tokens/s',   value: '2.4K',  delta: 'local',      deltaPos: true,  color: '#ff9830' },
  { label: 'Query Latency', value: '0.3ms', delta: 'p99: 1.2ms', deltaPos: true,  color: '#f2cc0c' },
])
</script>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: calc(100vh - var(--header-height) - 28px);
}

/* ── KPI ─────────────────────────────────────────────────────────────────── */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
  flex-shrink: 0;
}
.kpi-card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--panel-radius);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.kpi-value  { font-size: 22px; font-weight: 700; font-family: var(--font-mono); line-height: 1; }
.kpi-label  { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.kpi-delta  { font-size: 11px; margin-top: 4px; }
.kpi-delta.pos { color: var(--accent-green); }
.kpi-delta.neg { color: var(--accent-red); }

/* ── Toolbar ─────────────────────────────────────────────────────────────── */
.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 8px;
}
.panel-chip {
  padding: 3px 10px; border-radius: 12px;
  border: 1px solid var(--border); background: var(--bg-secondary);
  color: var(--text-muted); font-size: 11px; cursor: pointer;
  transition: all 0.15s;
}
.panel-chip.active {
  border-color: var(--accent-blue);
  background: rgba(87,148,242,0.1);
  color: var(--accent-blue);
}
.panel-chip:hover:not(.active) { border-color: var(--border-hover); color: var(--text-primary); }
.toolbar-sep { width: 1px; height: 20px; background: var(--border); flex-shrink: 0; }

/* ── Panel grid ──────────────────────────────────────────────────────────── */
.panel-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-rows: minmax(0, 1fr);
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.panel-slot {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--panel-radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
  min-height: 0;
}
.panel-slot.drag-over {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(87,148,242,0.3);
}
.panel-slot.is-dragging { opacity: 0.45; }

/* ── Panel drag header ───────────────────────────────────────────────────── */
.panel-drag-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  flex-shrink: 0;
  cursor: grab;
  user-select: none;
}
.panel-drag-header:active { cursor: grabbing; }

.grip { color: var(--text-muted); font-size: 14px; line-height: 1; }
.panel-name {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
}

.resize-btn {
  background: none;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  padding: 1px 4px;
  border-radius: 3px;
  line-height: 1;
  transition: color 0.15s, border-color 0.15s;
}
.resize-btn:hover { color: var(--text-primary); border-color: var(--border); }

/* ── Panel body ──────────────────────────────────────────────────────────── */
.panel-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Plugin panel slot ───────────────────────────────────────────────────── */
.plugin-panel-slot {
  border-color: rgba(87,148,242,0.35);
}
</style>

<template>
  <div class="compare-page">

    <!-- Toolbar -->
    <div class="compare-toolbar">
      <div class="toolbar-left">
        <span class="section-title">Graph Compare</span>
        <span class="badge badge-cyan" style="font-size:10px">LIVE STORE vs TARGET</span>
      </div>
      <div class="toolbar-right">
        <label class="ctrl-label">Target dataset</label>
        <select v-model="targetDataset" class="ctrl-select">
          <option v-for="ds in datasets" :key="ds.name" :value="ds.name">
            {{ ds.label }} ({{ ds.nodeCount }}n / {{ ds.edgeCount }}e)
          </option>
        </select>
        <label class="ctrl-label">Operation</label>
        <select v-model="operation" class="ctrl-select">
          <option value="compare">Compare (diff)</option>
          <option value="union">Union (merge)</option>
          <option value="intersection">Intersection</option>
          <option value="difference">Difference</option>
        </select>
        <button class="btn btn-primary" :disabled="running" @click="runCompare">
          {{ running ? '…' : '▶ Run' }}
        </button>
        <button
          v-if="computeResult && operation !== 'compare'"
          class="btn btn-warn"
          :disabled="applying"
          @click="applyResult"
        >
          {{ applying ? 'Applying…' : '⬇ Apply to Store' }}
        </button>
      </div>
    </div>

    <!-- Similarity summary bar (compare mode) -->
    <div v-if="diff" class="sim-bar panel">
      <div class="sim-item">
        <span class="sim-label">Node similarity</span>
        <div class="sim-track"><div class="sim-fill blue" :style="{ width: pct(diff.nodeSimilarity) }" /></div>
        <span class="sim-val">{{ (diff.nodeSimilarity * 100).toFixed(1) }}%</span>
      </div>
      <div class="sim-item">
        <span class="sim-label">Edge similarity</span>
        <div class="sim-track"><div class="sim-fill green" :style="{ width: pct(diff.edgeSimilarity) }" /></div>
        <span class="sim-val">{{ (diff.edgeSimilarity * 100).toFixed(1) }}%</span>
      </div>
      <div class="sim-item">
        <span class="sim-label">Overall (Jaccard)</span>
        <div class="sim-track"><div class="sim-fill yellow" :style="{ width: pct(diff.similarity) }" /></div>
        <span class="sim-val">{{ (diff.similarity * 100).toFixed(1) }}%</span>
      </div>
      <div class="sim-counts">
        <span class="diff-chip added">+{{ diff.addedNodes.length }} nodes</span>
        <span class="diff-chip removed">-{{ diff.removedNodes.length }} nodes</span>
        <span class="diff-chip common">{{ diff.commonNodes.length }} common</span>
        <span class="diff-chip added">+{{ diff.addedEdges.length }} edges</span>
        <span class="diff-chip removed">-{{ diff.removedEdges.length }} edges</span>
      </div>
    </div>

    <!-- Compute result summary -->
    <div v-if="computeResult" class="sim-bar panel">
      <span class="sim-label" style="text-transform:capitalize">{{ computeResult.operation }}</span>
      <span class="diff-chip common">{{ computeResult.nodeCount }} nodes</span>
      <span class="diff-chip common">{{ computeResult.edgeCount }} edges</span>
      <span v-if="applied" class="diff-chip added">✓ Applied to store</span>
    </div>

    <!-- Three-column diff view -->
    <div v-if="diff" class="diff-columns">
      <!-- Current graph -->
      <div class="diff-col panel">
        <div class="col-header"><span class="col-title">Current (Live Store)</span><span class="col-count">{{ currentNodes.length }}n / {{ currentEdges.length }}e</span></div>
        <div class="node-list">
          <div
            v-for="n in currentNodes"
            :key="n.id"
            class="node-row"
            :class="nodeClass(n.id, 'current')"
          >
            <span class="node-indicator" :class="nodeClass(n.id, 'current')" />
            <span class="node-id mono">{{ n.id }}</span>
            <span class="node-label text-secondary">{{ n.label }}</span>
          </div>
        </div>
      </div>

      <!-- Diff panel -->
      <div class="diff-col diff-center panel">
        <div class="col-header"><span class="col-title">Diff</span></div>

        <div class="diff-section">
          <div class="diff-section-title added-title">Added nodes</div>
          <div v-if="diff.addedNodes.length === 0" class="diff-empty text-secondary">none</div>
          <div v-for="n in diff.addedNodes" :key="'a-'+n.id" class="diff-row added">
            <span class="diff-sign">+</span>
            <span class="mono">{{ n.id }}</span>
            <span class="text-secondary">{{ n.label }}</span>
          </div>
        </div>

        <div class="diff-section">
          <div class="diff-section-title removed-title">Removed nodes</div>
          <div v-if="diff.removedNodes.length === 0" class="diff-empty text-secondary">none</div>
          <div v-for="n in diff.removedNodes" :key="'r-'+n.id" class="diff-row removed">
            <span class="diff-sign">-</span>
            <span class="mono">{{ n.id }}</span>
            <span class="text-secondary">{{ n.label }}</span>
          </div>
        </div>

        <div class="diff-section">
          <div class="diff-section-title added-title">Added edges</div>
          <div v-if="diff.addedEdges.length === 0" class="diff-empty text-secondary">none</div>
          <div v-for="e in diff.addedEdges" :key="`ae-${e.source}-${e.target}`" class="diff-row added">
            <span class="diff-sign">+</span>
            <span class="mono">{{ e.source }} → {{ e.target }}</span>
            <span class="label-chip">{{ e.label }}</span>
          </div>
        </div>

        <div class="diff-section">
          <div class="diff-section-title removed-title">Removed edges</div>
          <div v-if="diff.removedEdges.length === 0" class="diff-empty text-secondary">none</div>
          <div v-for="e in diff.removedEdges" :key="`re-${e.source}-${e.target}`" class="diff-row removed">
            <span class="diff-sign">-</span>
            <span class="mono">{{ e.source }} → {{ e.target }}</span>
            <span class="label-chip">{{ e.label }}</span>
          </div>
        </div>
      </div>

      <!-- Target graph -->
      <div class="diff-col panel">
        <div class="col-header"><span class="col-title">Target ({{ targetDataset }})</span><span class="col-count">{{ targetNodes.length }}n / {{ targetEdges.length }}e</span></div>
        <div class="node-list">
          <div
            v-for="n in targetNodes"
            :key="n.id"
            class="node-row"
            :class="nodeClass(n.id, 'target')"
          >
            <span class="node-indicator" :class="nodeClass(n.id, 'target')" />
            <span class="node-id mono">{{ n.id }}</span>
            <span class="node-label text-secondary">{{ n.label }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Compute result table -->
    <div v-if="computeResult && operation !== 'compare'" class="result-section">
      <div class="result-tabs">
        <button class="tab-btn" :class="{ active: resultTab === 'nodes' }" @click="resultTab = 'nodes'">Nodes ({{ computeResult.nodeCount }})</button>
        <button class="tab-btn" :class="{ active: resultTab === 'edges' }" @click="resultTab = 'edges'">Edges ({{ computeResult.edgeCount }})</button>
      </div>
      <div class="table-wrap panel">
        <table v-if="resultTab === 'nodes'" class="data-table">
          <thead><tr><th>ID</th><th>Label</th><th>Cat</th><th>Value</th></tr></thead>
          <tbody>
            <tr v-for="n in computeResult.nodes" :key="n.id">
              <td class="mono text-accent-blue">{{ n.id }}</td>
              <td>{{ n.label }}</td>
              <td>{{ n.category }}</td>
              <td>{{ n.value }}</td>
            </tr>
          </tbody>
        </table>
        <table v-else class="data-table">
          <thead><tr><th>Source</th><th>Target</th><th>Label</th><th>Weight</th></tr></thead>
          <tbody>
            <tr v-for="e in computeResult.edges" :key="`${e.source}->${e.target}`">
              <td class="mono text-accent-blue">{{ e.source }}</td>
              <td class="mono text-accent-green">{{ e.target }}</td>
              <td><span class="label-chip">{{ e.label }}</span></td>
              <td>{{ e.weight }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!diff && !computeResult && !running" class="empty-state text-secondary">
      Select a target dataset and click Run to compare or compute.
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePrismAPI, type NodeRecord, type EdgeRecord, type DatasetInfo, type GraphDiff, type ComputeResult } from '@/composables/usePrismAPI'

const api = usePrismAPI()

const datasets      = ref<DatasetInfo[]>([])
const targetDataset = ref('k8s')
const operation     = ref('compare')
const running       = ref(false)
const applying      = ref(false)
const applied       = ref(false)

const diff          = ref<GraphDiff | null>(null)
const computeResult = ref<ComputeResult | null>(null)
const resultTab     = ref<'nodes' | 'edges'>('nodes')

const currentNodes  = ref<NodeRecord[]>([])
const currentEdges  = ref<EdgeRecord[]>([])
const targetNodes   = ref<NodeRecord[]>([])
const targetEdges   = ref<EdgeRecord[]>([])

// Node ID sets for diff colouring
const addedNodeIds   = computed(() => new Set(diff.value?.addedNodes.map(n => n.id) ?? []))
const removedNodeIds = computed(() => new Set(diff.value?.removedNodes.map(n => n.id) ?? []))
const commonNodeIds  = computed(() => new Set(diff.value?.commonNodes.map(n => n.id) ?? []))

function nodeClass(id: string, side: 'current' | 'target') {
  if (side === 'current') {
    if (removedNodeIds.value.has(id)) return 'removed'
    if (commonNodeIds.value.has(id))  return 'common'
    return ''
  }
  if (addedNodeIds.value.has(id))  return 'added'
  if (commonNodeIds.value.has(id)) return 'common'
  return ''
}

function pct(v: number) { return `${Math.round(v * 100)}%` }

async function runCompare() {
  running.value = true
  diff.value = null
  computeResult.value = null
  applied.value = false

  if (operation.value === 'compare') {
    const res = await api.postGraphCompare(targetDataset.value, 'compare')
    if (res?.diff) {
      diff.value = res.diff
      // Populate side lists from diff data
      currentNodes.value = [...res.diff.commonNodes, ...res.diff.removedNodes]
      currentEdges.value = [...res.diff.commonEdges, ...res.diff.removedEdges]
      targetNodes.value  = [...res.diff.commonNodes, ...res.diff.addedNodes]
      targetEdges.value  = [...res.diff.commonEdges, ...res.diff.addedEdges]
    }
  } else {
    const res = await api.postGraphCompute(targetDataset.value, operation.value, false)
    if (res?.result) computeResult.value = res.result
  }

  running.value = false
}

async function applyResult() {
  applying.value = true
  await api.postGraphCompute(targetDataset.value, operation.value, true)
  applied.value = true
  applying.value = false
}

onMounted(async () => {
  const res = await api.getDatasets()
  if (res) datasets.value = res.datasets
})
</script>

<style scoped>
.compare-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  overflow: auto;
}

/* Toolbar */
.compare-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.toolbar-left  { display: flex; align-items: center; gap: 10px; }
.toolbar-right { display: flex; align-items: center; gap: 8px; margin-left: auto; flex-wrap: wrap; }
.section-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.ctrl-label  { font-size: 11px; color: var(--text-muted); }
.ctrl-select {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 4px; padding: 5px 10px; color: var(--text-primary);
  font-size: 12px;
}
.btn-primary { background: rgba(87,148,242,0.15); border-color: rgba(87,148,242,0.4); color: var(--accent-blue); }
.btn-primary:hover { background: rgba(87,148,242,0.25); }
.btn-warn { background: rgba(250,222,42,0.1); border-color: rgba(250,222,42,0.4); color: #fade2a; }
.btn-warn:hover { background: rgba(250,222,42,0.2); }

/* Similarity bar */
.sim-bar {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 10px 14px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.sim-item { display: flex; align-items: center; gap: 8px; }
.sim-label { font-size: 11px; color: var(--text-muted); white-space: nowrap; min-width: 110px; }
.sim-track { width: 120px; height: 6px; border-radius: 3px; background: var(--bg-secondary); overflow: hidden; }
.sim-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
.sim-fill.blue   { background: var(--accent-blue); }
.sim-fill.green  { background: var(--accent-green); }
.sim-fill.yellow { background: #fade2a; }
.sim-val { font-size: 12px; font-weight: 600; color: var(--text-primary); min-width: 40px; font-family: var(--font-mono); }
.sim-counts { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }

.diff-chip {
  font-size: 10px; padding: 2px 8px; border-radius: 10px; font-weight: 600;
}
.diff-chip.added   { background: rgba(115,191,105,0.15); color: var(--accent-green); border: 1px solid rgba(115,191,105,0.3); }
.diff-chip.removed { background: rgba(242,73,92,0.15);   color: #f2495c;             border: 1px solid rgba(242,73,92,0.3); }
.diff-chip.common  { background: rgba(87,148,242,0.12);  color: var(--accent-blue);  border: 1px solid rgba(87,148,242,0.3); }

/* Three-column diff */
.diff-columns {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1fr;
  gap: 10px;
  min-height: 0;
  flex: 1;
}
.diff-col {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 300px;
}
.col-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.col-title { font-size: 12px; font-weight: 600; color: var(--text-primary); }
.col-count { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); }
.node-list { overflow-y: auto; flex: 1; padding: 6px 0; }
.node-row {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 12px;
  font-size: 12px;
  transition: background 0.1s;
}
.node-row:hover { background: rgba(255,255,255,0.03); }
.node-row.added   { background: rgba(115,191,105,0.06); }
.node-row.removed { background: rgba(242,73,92,0.06); }
.node-row.common  { background: transparent; }
.node-indicator {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}
.node-indicator.added   { background: var(--accent-green); }
.node-indicator.removed { background: #f2495c; }
.node-indicator.common  { background: var(--accent-blue); }
.node-id    { min-width: 90px; }
.node-label { flex: 1; }

/* Center diff panel */
.diff-center { overflow-y: auto; }
.diff-section { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.diff-section-title {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em;
  font-weight: 600; margin-bottom: 5px;
}
.added-title   { color: var(--accent-green); }
.removed-title { color: #f2495c; }
.diff-empty { font-size: 11px; padding: 3px 0; }
.diff-row {
  display: flex; align-items: center; gap: 8px;
  font-size: 11px; padding: 3px 0;
}
.diff-row.added   { color: var(--accent-green); }
.diff-row.removed { color: #f2495c; }
.diff-sign { font-weight: 700; font-family: var(--font-mono); min-width: 12px; }

/* Result section */
.result-section { display: flex; flex-direction: column; gap: 8px; }
.result-tabs { display: flex; gap: 2px; }
.tab-btn {
  padding: 5px 14px; background: transparent; border: 1px solid var(--border);
  border-radius: 4px 4px 0 0; color: var(--text-muted); cursor: pointer; font-size: 12px;
}
.tab-btn.active { color: var(--accent-blue); border-color: var(--accent-blue); background: rgba(87,148,242,0.08); }

/* Table */
.table-wrap { overflow-x: auto; padding: 0; }
.data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.data-table th {
  text-align: left; padding: 7px 10px; color: var(--text-muted);
  font-weight: 500; border-bottom: 1px solid var(--border);
}
.data-table td {
  padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.03);
  color: var(--text-primary);
}
.data-table tr:hover td { background: rgba(255,255,255,0.02); }
.mono            { font-family: var(--font-mono); font-size: 11px; }
.text-accent-blue  { color: var(--accent-blue); }
.text-accent-green { color: var(--accent-green); }
.label-chip {
  font-family: var(--font-mono); font-size: 10px; padding: 2px 6px;
  border-radius: 3px; background: var(--bg-secondary); border: 1px solid var(--border);
}

/* Empty state */
.empty-state {
  flex: 1; display: flex; align-items: center; justify-content: center;
  font-size: 13px;
}
</style>

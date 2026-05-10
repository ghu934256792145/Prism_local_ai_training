<template>
  <div class="explorer-page">
    <!-- Query bar -->
    <div class="query-bar panel">
      <div class="panel-header">
        <span class="panel-title">PrismQL — Graph Query</span>
        <div style="display:flex;gap:8px">
          <button class="btn" @click="store.loadMockData()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.08-4.64"/></svg>
            Refresh
          </button>
          <button class="btn btn-primary" @click="runQuery">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Run
          </button>
        </div>
      </div>
      <div style="padding:10px 14px;position:relative">
        <textarea
          v-model="store.query"
          class="prism-ql"
          rows="2"
          spellcheck="false"
          @keydown="onTextareaKey"
          @focus="showSuggestions = true"
          @blur="hideSuggestionsDelayed"
        ></textarea>
        <!-- Autocomplete dropdown -->
        <div v-if="showSuggestions && suggestions.length" class="ac-dropdown">
          <div
            v-for="(s, i) in suggestions"
            :key="i"
            class="ac-item"
            :class="{ 'ac-active': i === acIndex }"
            @mousedown.prevent="applySuggestion(s)"
          >{{ s }}</div>
        </div>
        <div v-if="store.queryError" class="query-error">{{ store.queryError }}</div>
        <div v-if="historyIndex > -1" class="history-hint">history {{ historyIndex + 1 }}/{{ history.length }} — ↑↓ to navigate, Esc to cancel</div>

        <!-- EXPLAIN plan -->
        <div v-if="store.explainPlan" class="explain-panel">
          <div class="explain-title">Query Plan</div>
          <div v-for="s in store.explainPlan" :key="s.step" class="explain-step">
            <span class="explain-step-num">{{ s.step }}</span>
            <span class="explain-op">{{ s.operation }}</span>
            <span class="explain-detail">{{ s.detail }}</span>
            <span class="explain-cost">{{ s.estimatedCost }}</span>
          </div>
        </div>

        <!-- PATH result ribbon -->
        <div v-if="store.pathResult !== null" class="path-ribbon-bar">
          <span v-if="store.pathResult.length === 0" class="text-secondary" style="font-size:11px">No path found</span>
          <template v-else>
            <span class="path-hop-count">{{ store.pathResult.length - 1 }} hops</span>
            <span v-for="(id, i) in store.pathResult" :key="id" class="path-hop-id">
              {{ id }}<span v-if="i < store.pathResult.length - 1" class="path-sep">›</span>
            </span>
          </template>
        </div>
      </div>
    </div>

    <!-- Main split -->
    <div class="explorer-body">
      <!-- Graph canvas -->
      <div class="graph-canvas panel">
        <div class="panel-header">
          <span class="panel-title">Graph Visualization</span>
          <div style="display:flex;gap:8px">
            <span class="badge badge-blue">{{ store.nodeCount }} nodes</span>
            <span class="badge badge-cyan">{{ store.edgeCount }} edges</span>
          </div>
        </div>
        <div class="panel-body" style="position:relative">
          <VChart v-if="!store.loading && store.nodes.length" :option="chartOption" autoresize style="width:100%;height:100%" @click="onNodeClick" />
          <div v-else class="chart-placeholder">
            <div class="spinner"></div>
            <span>{{ store.loading ? 'Traversing…' : 'Run a query to see the graph' }}</span>
          </div>
        </div>
      </div>

      <!-- Side panel -->
      <div class="graph-sidebar">
        <!-- Legend -->
        <div class="panel" style="flex-shrink:0">
          <div class="panel-header"><span class="panel-title">Categories</span></div>
          <div style="padding:10px 12px;display:flex;flex-direction:column;gap:6px">
            <div v-for="(cat, i) in categoryItems" :key="cat.name" style="display:flex;align-items:center;gap:8px;font-size:12px">
              <span :style="{ width:'10px', height:'10px', borderRadius:'50%', background: cat.color, flexShrink:0, display:'inline-block' }"></span>
              <span class="text-secondary">{{ cat.name }}</span>
              <span class="text-muted" style="margin-left:auto">{{ cat.count }}</span>
            </div>
          </div>
        </div>

        <!-- Selected node detail -->
        <div class="panel" style="flex:1">
          <div class="panel-header"><span class="panel-title">Node Detail</span></div>
          <div style="padding:12px">
            <div v-if="store.selectedNode">
              <div class="detail-row">
                <span class="text-muted">ID</span>
                <span class="text-blue" style="font-family:var(--font-mono);font-size:12px">{{ store.selectedNode }}</span>
              </div>
              <div class="detail-row" v-if="selectedNodeData">
                <span class="text-muted">Label</span>
                <span>{{ selectedNodeData.label }}</span>
              </div>
              <div class="detail-row" v-if="selectedNodeData">
                <span class="text-muted">Category</span>
                <span class="badge badge-blue">{{ store.categoryNames[selectedNodeData.category] }}</span>
              </div>
              <div class="detail-row" v-if="selectedNodeData">
                <span class="text-muted">Connections</span>
                <span>{{ selectedNodeData.value }}</span>
              </div>
              <div class="divider"></div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">EDGES</div>
              <div v-for="e in selectedEdges" :key="e.source+e.target" style="font-size:11px;padding:3px 0;border-bottom:1px solid var(--border);display:flex;gap:6px">
                <span class="text-muted">{{ e.source === store.selectedNode ? '→' : '←' }}</span>
                <span style="font-family:var(--font-mono)">{{ e.source === store.selectedNode ? e.target : e.source }}</span>
                <span class="badge badge-orange" style="margin-left:auto;font-size:9px">{{ e.label }}</span>
              </div>
            </div>
            <div v-else class="text-muted" style="font-size:12px">Click a node to inspect</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useGraph } from '@/composables/useGraph'
import { useQueryHistory } from '@/composables/useQueryHistory'
import { getSuggestions } from '@/lib/prismql'

use([CanvasRenderer, GraphChart, TooltipComponent, LegendComponent])

const { chartOption, store } = useGraph()
const CATEGORY_COLORS = ['#5794f2', '#73bf69', '#f2cc0c', '#19dde2', '#ff9830', '#b877d9']

// ── Query history ──────────────────────────────────────────────────────────────
const { history, historyIndex, push, onKeydown, reset } = useQueryHistory('prismql-graph-history')

function runQuery() {
  push(store.query)
  store.runQuery()
}

// ── Autocomplete ───────────────────────────────────────────────────────────────
const showSuggestions = ref(false)
const acIndex = ref(-1)

const suggestions = computed(() =>
  getSuggestions(store.query, store.nodes.map(n => n.id))
)

function applySuggestion(s: string) {
  store.query = s
  showSuggestions.value = false
  acIndex.value = -1
}

function hideSuggestionsDelayed() {
  setTimeout(() => { showSuggestions.value = false }, 150)
}

function onTextareaKey(e: KeyboardEvent) {
  // History navigation
  if (e.key === 'Escape') { reset(); return }

  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    // If autocomplete is open, navigate it
    if (showSuggestions.value && suggestions.value.length) {
      e.preventDefault()
      if (e.key === 'ArrowDown') acIndex.value = Math.min(acIndex.value + 1, suggestions.value.length - 1)
      else acIndex.value = Math.max(acIndex.value - 1, -1)
      return
    }
    // Otherwise navigate history
    const next = onKeydown(e, store.query)
    if (next !== null) store.query = next
    return
  }

  if (e.key === 'Tab' && showSuggestions.value && suggestions.value.length) {
    e.preventDefault()
    const pick = acIndex.value >= 0 ? suggestions.value[acIndex.value] : suggestions.value[0]
    applySuggestion(pick)
    return
  }

  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    runQuery()
    return
  }

  // Reset autocomplete index on any other key
  acIndex.value = -1
}

// ── Chart ──────────────────────────────────────────────────────────────────────
function onNodeClick(params: any) {
  if (params.dataType === 'node') store.selectedNode = params.data.id ?? null
}

const categoryItems = computed(() =>
  store.categoryNames.map((name, i) => ({
    name,
    color: CATEGORY_COLORS[i],
    count: store.nodes.filter(n => n.category === i).length
  }))
)

const selectedNodeData = computed(() =>
  store.nodes.find(n => n.id === store.selectedNode) ?? null
)

const selectedEdges = computed(() =>
  store.edges.filter(e => e.source === store.selectedNode || e.target === store.selectedNode)
)
</script>

<style scoped>
.explorer-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - var(--header-height) - 28px);
}

.query-bar { flex-shrink: 0; }

.query-error {
  color: var(--accent-red);
  font-size: 12px;
  margin-top: 6px;
}

.ac-dropdown {
  position: absolute;
  top: calc(100% - 10px);
  left: 14px;
  right: 14px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 4px;
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.ac-item {
  padding: 5px 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ac-item:hover, .ac-active {
  background: rgba(87,148,242,0.12);
  color: var(--text-primary);
}

.history-hint {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 4px;
  font-family: var(--font-mono);
}

.explain-panel { margin-top:8px;border:1px solid rgba(87,148,242,.2);border-radius:4px;overflow:hidden; }
.explain-title { font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);padding:4px 8px;background:rgba(87,148,242,.07); }
.explain-step { display:grid;grid-template-columns:18px 110px 1fr 56px;gap:6px;align-items:baseline;padding:3px 8px;border-top:1px solid rgba(255,255,255,.05);font-size:11px; }
.explain-step-num { font-family:var(--font-mono);color:var(--text-muted);font-size:10px; }
.explain-op { color:#5794f2;font-family:var(--font-mono);font-size:10px; }
.explain-detail { color:var(--text-secondary); }
.explain-cost { font-family:var(--font-mono);color:#73bf69;font-size:10px;text-align:right; }

.path-ribbon-bar { display:flex;align-items:center;flex-wrap:wrap;gap:3px;margin-top:6px;padding:4px 6px;background:rgba(250,222,42,.07);border-radius:4px;font-size:11px; }
.path-hop-count { color:#fade2a;font-family:var(--font-mono);font-size:10px;margin-right:4px; }
.path-hop-id { font-family:var(--font-mono);color:var(--text-secondary); }
.path-sep { color:var(--text-muted);margin:0 2px; }

.explorer-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 12px;
  min-height: 0;
}

.graph-canvas { height: 100%; }
.graph-sidebar { display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }

.chart-placeholder {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; color: var(--text-muted); font-size: 13px;
}
.spinner {
  width: 28px; height: 28px; border: 2px solid var(--border);
  border-top-color: var(--accent-blue); border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.detail-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 5px 0; border-bottom: 1px solid var(--border); font-size: 12px;
}
</style>

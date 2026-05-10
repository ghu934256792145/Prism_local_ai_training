<template>
  <div class="explorer-page">
    <!-- Query bar -->
    <div class="panel query-bar">
      <div class="panel-header">
        <span class="panel-title">PrismQL — Vector Query</span>
        <div style="display:flex;gap:8px">
          <input v-model="store.topK" type="number" min="1" max="30" class="topk-input" title="Top K" />
          <button class="btn btn-primary" @click="runQuery">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Search
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
        <div v-if="showSuggestions && suggestions.length" class="ac-dropdown">
          <div v-for="(s, i) in suggestions" :key="i" class="ac-item" :class="{ 'ac-active': i === acIndex }" @mousedown.prevent="applySuggestion(s)">{{ s }}</div>
        </div>
        <div v-if="store.queryError" class="query-error">{{ store.queryError }}</div>
        <div v-if="historyIndex > -1" class="history-hint">history {{ historyIndex + 1 }}/{{ history.length }} — ↑↓ to navigate</div>
      </div>
    </div>

    <!-- Body -->
    <div class="explorer-body">
      <!-- Scatter -->
      <div class="panel" style="height:100%">
        <div class="panel-header">
          <span class="panel-title">Embedding Space (t-SNE 2D)</span>
          <div style="display:flex;gap:8px">
            <span class="badge badge-purple">{{ store.points.length }} vectors</span>
            <span v-if="store.selectedId" class="badge badge-orange">Selected: {{ store.selectedId }}</span>
          </div>
        </div>
        <div class="panel-body" style="position:relative">
          <VChart
            v-if="!store.loading && store.points.length"
            :option="chartOption"
            autoresize
            style="width:100%;height:100%"
            @click="onPointClick"
          />
          <div v-else class="chart-placeholder">
            <div class="spinner"></div>
            <span>{{ store.loading ? 'Computing…' : 'Run a query' }}</span>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="sidebar">
        <!-- Clusters -->
        <div class="panel">
          <div class="panel-header"><span class="panel-title">Clusters</span></div>
          <div style="padding:10px 12px;display:flex;flex-direction:column;gap:6px">
            <div v-for="(name, i) in store.clusterNames" :key="name" class="cluster-row">
              <span :style="{ width:'10px', height:'10px', borderRadius:'50%', background: CLUSTER_COLORS[i], flexShrink:0, display:'inline-block' }"></span>
              <span style="font-size:12px;flex:1">{{ name }}</span>
              <span class="badge" :style="{ background: CLUSTER_COLORS[i]+'22', color: CLUSTER_COLORS[i], fontSize:'10px' }">
                {{ store.points.filter(p => p.cluster === i).length }}
              </span>
            </div>
          </div>
        </div>

        <!-- Selected point -->
        <div class="panel">
          <div class="panel-header"><span class="panel-title">Selected Vector</span></div>
          <div style="padding:12px">
            <div v-if="store.selectedPoint">
              <div class="detail-row"><span class="text-muted">ID</span><span class="text-purple" style="font-family:var(--font-mono);font-size:11px">{{ store.selectedPoint.id }}</span></div>
              <div class="detail-row"><span class="text-muted">Score</span><span class="text-green">{{ store.selectedPoint.score.toFixed(4) }}</span></div>
              <div class="detail-row"><span class="text-muted">Cluster</span><span>{{ store.clusterNames[store.selectedPoint.cluster] }}</span></div>
              <div class="detail-row"><span class="text-muted">Tags</span>
                <div style="display:flex;gap:3px;flex-wrap:wrap">
                  <span v-for="t in store.selectedPoint.tags" :key="t" class="tag" style="font-size:10px">{{ t }}</span>
                </div>
              </div>
            </div>
            <div v-else class="text-muted" style="font-size:12px">Click a point to inspect</div>
          </div>
        </div>

        <!-- Nearest neighbors -->
        <div class="panel" style="flex:1">
          <div class="panel-header">
            <span class="panel-title">Nearest Neighbors</span>
            <span class="badge badge-orange">Top {{ store.topK }}</span>
          </div>
          <div style="overflow-y:auto;height:calc(100% - 37px)">
            <div v-if="store.nearestNeighbors.length">
              <div v-for="(nb, idx) in store.nearestNeighbors" :key="nb.id" class="nb-row" @click="store.selectedId = nb.id">
                <span class="text-muted" style="font-size:10px;width:16px">{{ idx+1 }}</span>
                <span style="font-size:11px;flex:1;font-family:var(--font-mono)">{{ nb.label }}</span>
                <span class="text-secondary" style="font-size:10px">{{ nb.dist.toFixed(3) }}</span>
              </div>
            </div>
            <div v-else class="text-muted" style="font-size:12px;padding:12px">Select a point first</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { ScatterChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useVector } from '@/composables/useVector'
import { useQueryHistory } from '@/composables/useQueryHistory'
import { getSuggestions } from '@/lib/prismql'

use([CanvasRenderer, ScatterChart, TooltipComponent, LegendComponent, GridComponent])

const CLUSTER_COLORS = ['#5794f2', '#73bf69', '#b877d9', '#ff9830']

const { chartOption, store } = useVector()

function onPointClick(params: any) {
  store.selectedId = params.data?.id ?? null
}

const { history, historyIndex, push, onKeydown, reset } = useQueryHistory('prismql-vector-history')

function runQuery() { push(store.query); store.runQuery() }

const showSuggestions = ref(false)
const acIndex = ref(-1)
const suggestions = computed(() => getSuggestions(store.query))

function applySuggestion(s: string) { store.query = s; showSuggestions.value = false; acIndex.value = -1 }
function hideSuggestionsDelayed() { setTimeout(() => { showSuggestions.value = false }, 150) }
function onTextareaKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { reset(); return }
  if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && showSuggestions.value && suggestions.value.length) {
    e.preventDefault()
    acIndex.value = e.key === 'ArrowDown' ? Math.min(acIndex.value + 1, suggestions.value.length - 1) : Math.max(acIndex.value - 1, -1)
    return
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { const n = onKeydown(e, store.query); if (n !== null) store.query = n; return }
  if (e.key === 'Tab' && showSuggestions.value && suggestions.value.length) {
    e.preventDefault(); applySuggestion(suggestions.value[acIndex.value >= 0 ? acIndex.value : 0]); return
  }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runQuery() }
  acIndex.value = -1
}
</script>

<style scoped>
.explorer-page { display: flex; flex-direction: column; gap: 12px; height: calc(100vh - var(--header-height) - 28px); }
.query-bar { flex-shrink: 0; }
.query-error { color: var(--accent-red); font-size: 12px; margin-top: 6px; }
.ac-dropdown { position:absolute;top:calc(100% - 10px);left:14px;right:14px;background:var(--bg-panel);border:1px solid var(--border);border-radius:4px;z-index:100;max-height:200px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.4); }
.ac-item { padding:5px 10px;font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.ac-item:hover,.ac-active { background:rgba(87,148,242,.12);color:var(--text-primary); }
.history-hint { font-size:10px;color:var(--text-muted);margin-top:4px;font-family:var(--font-mono); }
.explorer-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 240px; gap: 12px; }
.sidebar { display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.chart-placeholder {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; color: var(--text-muted); font-size: 13px;
}
.spinner {
  width: 28px; height: 28px; border: 2px solid var(--border);
  border-top-color: var(--accent-purple); border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.cluster-row { display: flex; align-items: center; gap: 8px; }
.detail-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
.nb-row { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-bottom: 1px solid var(--border); cursor: pointer; }
.nb-row:hover { background: var(--bg-panel-hover); }
.topk-input { width: 56px; background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-primary); padding: 5px 8px; border-radius: 4px; font-size: 13px; outline: none; text-align: center; }
</style>

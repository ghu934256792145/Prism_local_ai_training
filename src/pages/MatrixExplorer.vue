<template>
  <div class="explorer-page">
    <!-- Query bar -->
    <div class="panel query-bar">
      <div class="panel-header">
        <span class="panel-title">PrismQL — Matrix Query</span>
        <div style="display:flex;gap:8px">
          <select v-model="store.selectedOp" class="op-select">
            <option v-for="op in store.ops" :key="op" :value="op">{{ op }}</option>
          </select>
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
        <div v-if="showSuggestions && suggestions.length" class="ac-dropdown">
          <div v-for="(s, i) in suggestions" :key="i" class="ac-item" :class="{ 'ac-active': i === acIndex }" @mousedown.prevent="applySuggestion(s)">{{ s }}</div>
        </div>
        <div v-if="store.queryError" class="query-error">{{ store.queryError }}</div>
        <div v-if="historyIndex > -1" class="history-hint">history {{ historyIndex + 1 }}/{{ history.length }} — ↑↓ to navigate</div>
      </div>
    </div>

    <!-- Body -->
    <div class="explorer-body">
      <!-- Heatmap -->
      <div class="panel" style="height:100%">
        <div class="panel-header">
          <span class="panel-title">P&L Matrix Heatmap</span>
          <div style="display:flex;gap:8px">
            <span class="badge badge-green">{{ store.rowLabels.length }}×{{ store.colLabels.length }}</span>
            <span class="tag">FY {{ new Date().getFullYear() }}</span>
          </div>
        </div>
        <div class="panel-body" style="position:relative">
          <VChart v-if="!store.loading && store.data.length" :option="chartOption" autoresize style="width:100%;height:100%" />
          <div v-else class="chart-placeholder">
            <div class="spinner"></div>
            <span>{{ store.loading ? 'Applying operation…' : 'Run a query' }}</span>
          </div>
        </div>
      </div>

      <!-- Stats sidebar -->
      <div class="sidebar">
        <div class="panel">
          <div class="panel-header"><span class="panel-title">Summary</span></div>
          <div style="padding:12px;display:flex;flex-direction:column;gap:10px">
            <div class="stat-row">
              <span class="text-muted">Total Revenue</span>
              <span class="text-green" style="font-family:var(--font-mono)">${{ store.totalSum.toLocaleString() }}M</span>
            </div>
            <div class="stat-row">
              <span class="text-muted">Min Cell</span>
              <span style="font-family:var(--font-mono)">${{ store.minValue }}M</span>
            </div>
            <div class="stat-row">
              <span class="text-muted">Max Cell</span>
              <span style="font-family:var(--font-mono)">${{ store.maxValue }}M</span>
            </div>
            <div class="stat-row">
              <span class="text-muted">Operation</span>
              <span class="badge badge-green">{{ store.selectedOp }}</span>
            </div>
            <div class="stat-row">
              <span class="text-muted">Compute</span>
              <span class="text-cyan" style="font-family:var(--font-mono)">0.08ms</span>
            </div>
            <div class="stat-row">
              <span class="text-muted">Backend</span>
              <span class="text-secondary">NVMe + SIMD</span>
            </div>
          </div>
        </div>

        <div class="panel" style="flex:1">
          <div class="panel-header"><span class="panel-title">Row Totals</span></div>
          <div style="padding:8px 12px;overflow-y:auto;height:calc(100% - 37px)">
            <div v-for="(row, ri) in store.rowLabels" :key="row" class="row-total">
              <span class="text-secondary" style="font-size:12px">{{ row }}</span>
              <div class="row-bar-wrap">
                <div class="row-bar" :style="{ width: rowPct(ri) + '%', background: rowColor(ri) }"></div>
              </div>
              <span style="font-size:11px;font-family:var(--font-mono);min-width:40px;text-align:right">${{ rowSum(ri) }}</span>
            </div>
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
import { HeatmapChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, VisualMapComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useMatrix } from '@/composables/useMatrix'
import { useQueryHistory } from '@/composables/useQueryHistory'
import { getSuggestions } from '@/lib/prismql'

use([CanvasRenderer, HeatmapChart, TooltipComponent, GridComponent, VisualMapComponent])

const { chartOption, store } = useMatrix()

const { history, historyIndex, push, onKeydown, reset } = useQueryHistory('prismql-matrix-history')

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

const ROW_COLORS = ['#5794f2', '#f2495c', '#73bf69', '#ff9830', '#b877d9', '#f2cc0c', '#19dde2', '#8e8e8e', '#73bf69', '#5794f2']

function rowSum(ri: number) {
  return store.data.filter(d => d.row === ri).reduce((s, d) => s + d.value, 0)
}

const maxRowSum = computed(() =>
  Math.max(...store.rowLabels.map((_, ri) => rowSum(ri)))
)

function rowPct(ri: number) {
  return maxRowSum.value ? (rowSum(ri) / maxRowSum.value) * 100 : 0
}

function rowColor(ri: number) {
  return ROW_COLORS[ri % ROW_COLORS.length]
}
</script>

<style scoped>
.explorer-page {
  display: flex; flex-direction: column; gap: 12px;
  height: calc(100vh - var(--header-height) - 28px);
}
.query-bar { flex-shrink: 0; }
.query-error { color: var(--accent-red); font-size: 12px; margin-top: 6px; }
.ac-dropdown { position:absolute;top:calc(100% - 10px);left:14px;right:14px;background:var(--bg-panel);border:1px solid var(--border);border-radius:4px;z-index:100;max-height:200px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.4); }
.ac-item { padding:5px 10px;font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.ac-item:hover,.ac-active { background:rgba(87,148,242,.12);color:var(--text-primary); }
.history-hint { font-size:10px;color:var(--text-muted);margin-top:4px;font-family:var(--font-mono); }
.explorer-body {
  flex: 1; min-height: 0;
  display: grid; grid-template-columns: 1fr 220px; gap: 12px;
}
.sidebar { display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }
.chart-placeholder {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; color: var(--text-muted); font-size: 13px;
}
.spinner {
  width: 28px; height: 28px; border: 2px solid var(--border);
  border-top-color: var(--accent-green); border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.stat-row {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; padding: 4px 0; border-bottom: 1px solid var(--border);
}
.row-total { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--border); }
.row-bar-wrap { flex: 1; height: 6px; background: var(--bg-primary); border-radius: 3px; overflow: hidden; }
.row-bar { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
.op-select {
  background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-primary);
  padding: 5px 10px; border-radius: 4px; font-size: 13px; outline: none;
}
</style>

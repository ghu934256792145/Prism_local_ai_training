<template>
  <div class="panel vector-panel">
    <div class="panel-header">
      <span class="panel-title">Vector Space</span>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="badge badge-purple">{{ store.points.length }} vectors</span>
        <span class="badge badge-orange">4 clusters</span>
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
      <div v-else-if="store.loading" class="chart-placeholder">
        <div class="spinner"></div>
        <span>Computing embeddings…</span>
      </div>
      <div v-else class="chart-placeholder">
        <span class="text-muted">No vector data</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { ScatterChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useVector } from '@/composables/useVector'

use([CanvasRenderer, ScatterChart, TooltipComponent, LegendComponent, GridComponent])

const { chartOption, store } = useVector()
onMounted(() => { if (!store.points.length) store.loadMockData() })

function onPointClick(params: any) {
  store.selectedId = params.data.id ?? null
}
</script>

<style scoped>
.vector-panel { height: 100%; }
.chart-placeholder {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; color: var(--text-muted); font-size: 13px;
}
.spinner {
  width: 28px; height: 28px;
  border: 2px solid var(--border);
  border-top-color: var(--accent-purple);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>

<template>
  <div class="panel matrix-panel">
    <div class="panel-header">
      <span class="panel-title">Matrix Engine</span>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="badge badge-green">{{ store.rowLabels.length }}×{{ store.colLabels.length }}</span>
        <span v-if="store.data.length" class="tag">Total: ${{ totalFormatted }}M</span>
      </div>
    </div>
    <div class="panel-body" style="position:relative">
      <VChart v-if="!store.loading && store.data.length" :option="chartOption" autoresize style="width:100%;height:100%" />
      <div v-else-if="store.loading" class="chart-placeholder">
        <div class="spinner"></div>
        <span>Applying matrix operation…</span>
      </div>
      <div v-else class="chart-placeholder">
        <span class="text-muted">No matrix data — run a query</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { HeatmapChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, VisualMapComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useMatrix } from '@/composables/useMatrix'

use([CanvasRenderer, HeatmapChart, TooltipComponent, GridComponent, VisualMapComponent])

const { chartOption, store } = useMatrix()
onMounted(() => { if (!store.data.length) store.loadMockData() })

const totalFormatted = computed(() =>
  store.totalSum.toLocaleString()
)
</script>

<style scoped>
.matrix-panel { height: 100%; }
.chart-placeholder {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; color: var(--text-muted); font-size: 13px;
}
.spinner {
  width: 28px; height: 28px;
  border: 2px solid var(--border);
  border-top-color: var(--accent-green);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>

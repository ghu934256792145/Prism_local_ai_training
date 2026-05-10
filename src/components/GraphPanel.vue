<template>
  <div class="panel graph-panel">
    <div class="panel-header">
      <span class="panel-title">Graph Engine</span>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="badge badge-blue">{{ store.nodeCount }} nodes</span>
        <span class="badge badge-cyan">{{ store.edgeCount }} edges</span>
        <span v-if="store.loading" class="text-muted" style="font-size:11px">Loading…</span>
      </div>
    </div>
    <div class="panel-body" style="position:relative">
      <VChart v-if="!store.loading && store.nodes.length" :option="chartOption" autoresize style="width:100%;height:100%" @click="onNodeClick" />
      <div v-else-if="store.loading" class="chart-placeholder">
        <div class="spinner"></div>
        <span>Traversing graph…</span>
      </div>
      <div v-else class="chart-placeholder">
        <span class="text-muted">No graph data — run a query</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useGraph } from '@/composables/useGraph'

use([CanvasRenderer, GraphChart, TooltipComponent, LegendComponent])

const { chartOption, store } = useGraph()

onMounted(() => { if (!store.nodes.length) store.loadMockData() })

function onNodeClick(params: any) {
  if (params.dataType === 'node') store.selectedNode = params.data.id ?? null
}
</script>

<style scoped>
.graph-panel { height: 100%; }
.chart-placeholder {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; color: var(--text-muted); font-size: 13px;
}
.spinner {
  width: 28px; height: 28px;
  border: 2px solid var(--border);
  border-top-color: var(--accent-blue);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>

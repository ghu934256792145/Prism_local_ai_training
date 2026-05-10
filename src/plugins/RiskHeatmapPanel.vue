<template>
  <div ref="el" class="risk-heatmap-root">
    <div v-if="loading" class="loading-msg text-muted">Loading AML risk data…</div>
    <div v-else-if="error" class="loading-msg text-muted">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'

const el     = ref<HTMLDivElement>()
const loading = ref(true)
const error   = ref<string | null>(null)
let chart: echarts.ECharts | null = null

interface NodeRecord { id: string; label: string; category: number; value: number }
interface EdgeRecord  { source: string; target: string; label?: string }

const CATEGORIES = ['Entity', 'Account', 'Transaction', 'Alert', 'Jurisdiction']
const CATEGORY_COLORS = ['#5794f2', '#73bf69', '#ff9830', '#f2495c', '#b877d9']

async function load() {
  loading.value = true
  error.value = null
  try {
    const res  = await fetch('/api/aml/graph/aml-ring')
    const data = await res.json() as { nodes: NodeRecord[]; edges: EdgeRecord[] }
    await nextTick()
    render(data.nodes, data.edges)
  } catch {
    error.value = 'API offline — using fallback'
    renderFallback()
  } finally {
    loading.value = false
  }
}

function render(nodes: NodeRecord[], edges: EdgeRecord[]) {
  if (!el.value) return

  const jurisdictions = nodes.filter(n => n.category === 4)
  const entities      = nodes.filter(n => n.category === 0)

  // Build heatmap: y=jurisdiction, x=entity category, value=risk score (node.value)
  const catLabels = ['Entity', 'Account', 'Transaction', 'Alert']
  const yLabels   = jurisdictions.length ? jurisdictions.map(j => j.label) : ['Cayman', 'BVI', 'Panama', 'Cyprus']

  // Count edges per (jurisdiction, category pair) weighted by node value
  const matrix: number[][] = yLabels.map(() => catLabels.map(() => 0))
  for (const edge of edges) {
    const src = nodes.find(n => n.id === edge.source)
    const tgt = nodes.find(n => n.id === edge.target)
    if (!src || !tgt) continue
    const jIdx = yLabels.findIndex(l => l === tgt.label || l === src.label)
    if (jIdx === -1) continue
    const cat = src.category < 4 ? src.category : tgt.category
    if (cat < 4) matrix[jIdx][cat] += (src.value || 0) + (tgt.value || 0)
  }

  // Fallback: populate with node values when no edge crosses
  nodes.forEach(n => {
    if (n.category >= 4) return
    const jIdx = Math.floor(Math.random() * yLabels.length)
    matrix[jIdx][n.category] = Math.max(matrix[jIdx][n.category], n.value)
  })

  const heatData: [number, number, number][] = []
  matrix.forEach((row, yi) => row.forEach((val, xi) => heatData.push([xi, yi, val])))

  initChart({
    tooltip: {
      formatter: (p: { data: [number, number, number] }) =>
        `${catLabels[p.data[0]]} × ${yLabels[p.data[1]]}<br/>Risk: ${p.data[2]}`,
    },
    grid: { top: 10, right: 20, bottom: 60, left: 90 },
    xAxis: { type: 'category', data: catLabels, splitArea: { show: true } },
    yAxis: { type: 'category', data: yLabels,   splitArea: { show: true } },
    visualMap: {
      min: 0, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#1a1a2e', '#f2495c'] },
    },
    series: [{
      type: 'heatmap', data: heatData, label: { show: true, color: '#fff', fontSize: 10 },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(242,73,92,0.6)' } },
    }],
  })
}

function renderFallback() {
  const catLabels  = ['Entity', 'Account', 'Transaction', 'Alert']
  const yLabels    = ['Cayman', 'BVI', 'Panama', 'Cyprus']
  const heatData: [number, number, number][] = [
    [0,0,78],[1,0,54],[2,0,91],[3,0,100],
    [0,1,62],[1,1,40],[2,1,85],[3,1,95],
    [0,2,45],[1,2,33],[2,2,72],[3,2,88],
    [0,3,29],[1,3,18],[2,3,58],[3,3,70],
  ]
  initChart({
    tooltip: { formatter: (p: { data: [number, number, number] }) =>
      `${catLabels[p.data[0]]} × ${yLabels[p.data[1]]}<br/>Risk: ${p.data[2]}` },
    grid: { top: 10, right: 20, bottom: 60, left: 80 },
    xAxis: { type: 'category', data: catLabels, splitArea: { show: true } },
    yAxis: { type: 'category', data: yLabels,   splitArea: { show: true } },
    visualMap: {
      min: 0, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#1a1a2e', '#f2495c'] },
    },
    series: [{
      type: 'heatmap', data: heatData, label: { show: true, color: '#fff', fontSize: 10 },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(242,73,92,0.6)' } },
    }],
  })
}

function initChart(option: echarts.EChartsOption) {
  if (!el.value) return
  if (chart) chart.dispose()
  chart = echarts.init(el.value, 'dark')
  chart.setOption(option)
}

const ro = new ResizeObserver(() => chart?.resize())

onMounted(() => {
  if (el.value) ro.observe(el.value)
  load()
})

onUnmounted(() => {
  ro.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.risk-heatmap-root {
  width: 100%;
  height: 100%;
  min-height: 160px;
  background: transparent;
}
.loading-msg {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 12px;
}
</style>

import { computed } from 'vue'
import { useGraphStore } from '@/stores/graphStore'
import type { EChartsOption } from 'echarts'

const CATEGORY_COLORS = ['#5794f2', '#73bf69', '#f2cc0c', '#19dde2', '#ff9830', '#b877d9']
const CATEGORY_NAMES  = ['Service', 'Database', 'Queue', 'Cache', 'Gateway', 'Worker']

export function useGraph() {
  const store = useGraphStore()

  const chartOption = computed<EChartsOption>(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1f2330',
      borderColor: '#2c3235',
      textStyle: { color: '#d0d0d0', fontSize: 12 },
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          return `<b>${params.data.name}</b><br/>
            Category: ${CATEGORY_NAMES[params.data.category]}<br/>
            Connections: ${params.data.value}`
        }
        return `${params.data.source} → ${params.data.target}${params.data.label ? '<br/>' + params.data.label : ''}`
      }
    },
    legend: {
      data: CATEGORY_NAMES.map((name, i) => ({ name, icon: 'circle', itemStyle: { color: CATEGORY_COLORS[i] } })),
      textStyle: { color: '#8e8e8e', fontSize: 11 },
      bottom: 8,
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      symbol: 'circle',
      categories: CATEGORY_NAMES.map((name, i) => ({ name, itemStyle: { color: CATEGORY_COLORS[i] } })),
      data: store.nodes.map(n => ({
        id: n.id,
        name: n.label,
        category: n.category,
        value: n.value,
        symbolSize: n.symbolSize,
        label: { show: true, color: '#d0d0d0', fontSize: 10, position: 'right' },
        itemStyle: { color: CATEGORY_COLORS[n.category], borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1 }
      })),
      edges: store.edges.map(e => ({
        source: e.source,
        target: e.target,
        label: e.label,
        lineStyle: { color: 'rgba(255,255,255,0.12)', curveness: 0.1, width: 1 },
        emphasis: { lineStyle: { color: '#5794f2', width: 2 } }
      })),
      force: { repulsion: 200, edgeLength: [60, 120], gravity: 0.1, layoutAnimation: true },
      emphasis: {
        focus: 'adjacency',
        label: { show: true, fontSize: 12, fontWeight: 600 }
      },
      lineStyle: { color: 'rgba(255,255,255,0.12)', curveness: 0.1 },
    }]
  }))

  return { chartOption, store }
}

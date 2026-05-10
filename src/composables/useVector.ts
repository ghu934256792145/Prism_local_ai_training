import { computed } from 'vue'
import { useVectorStore } from '@/stores/vectorStore'
import type { EChartsOption } from 'echarts'

const CLUSTER_COLORS = ['#5794f2', '#73bf69', '#b877d9', '#ff9830']

export function useVector() {
  const store = useVectorStore()

  const chartOption = computed<EChartsOption>(() => {
    if (!store.points.length) return {}

    const series = store.clusterNames.map((name, ci) => ({
      name,
      type: 'scatter' as const,
      data: store.points
        .filter(p => p.cluster === ci)
        .map(p => ({
          value: [p.x, p.y],
          id: p.id,
          label_text: p.label,
          score: p.score,
          symbolSize: 8 + p.score * 10,
          itemStyle: {
            color: CLUSTER_COLORS[ci],
            opacity: store.selectedId && p.id !== store.selectedId ? 0.35 : 0.9,
            borderColor: p.id === store.selectedId ? '#fff' : 'transparent',
            borderWidth: 2
          }
        })),
      emphasis: { scale: 1.4 }
    }))

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: '#1f2330',
        borderColor: '#2c3235',
        textStyle: { color: '#d0d0d0', fontSize: 12 },
        formatter: (p: any) =>
          `<b>${p.data.label_text}</b><br/>Score: ${p.data.score.toFixed(3)}<br/>Cluster: ${store.clusterNames[p.seriesIndex]}`
      },
      legend: {
        data: store.clusterNames,
        textStyle: { color: '#8e8e8e', fontSize: 11 },
        bottom: 4,
        itemWidth: 10, itemHeight: 10
      },
      grid: { top: 16, bottom: 48, left: 24, right: 24 },
      xAxis: {
        type: 'value', scale: true,
        axisLine: { lineStyle: { color: '#2c3235' } },
        axisLabel: { color: '#6b6b6b', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1f2330' } }
      },
      yAxis: {
        type: 'value', scale: true,
        axisLine: { lineStyle: { color: '#2c3235' } },
        axisLabel: { color: '#6b6b6b', fontSize: 10 },
        splitLine: { lineStyle: { color: '#1f2330' } }
      },
      series
    }
  })

  return { chartOption, store }
}

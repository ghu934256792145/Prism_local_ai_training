import { computed } from 'vue'
import { useMatrixStore } from '@/stores/matrixStore'
import type { EChartsOption } from 'echarts'

export function useMatrix() {
  const store = useMatrixStore()

  const chartOption = computed<EChartsOption>(() => {
    if (!store.data.length) return {}

    const heatData = store.data.map(d => [d.col, d.row, d.value])

    return {
      backgroundColor: 'transparent',
      tooltip: {
        position: 'top',
        backgroundColor: '#1f2330',
        borderColor: '#2c3235',
        textStyle: { color: '#d0d0d0', fontSize: 12 },
        formatter: (p: any) =>
          `${store.rowLabels[p.data[1]]} / ${store.colLabels[p.data[0]]}<br/><b>$${p.data[2]}M</b>`
      },
      grid: { top: 20, bottom: 60, left: 80, right: 20 },
      xAxis: {
        type: 'category',
        data: store.colLabels,
        axisLine: { lineStyle: { color: '#2c3235' } },
        axisLabel: { color: '#8e8e8e', fontSize: 11 },
        splitLine: { show: false }
      },
      yAxis: {
        type: 'category',
        data: store.rowLabels,
        inverse: true,
        axisLine: { lineStyle: { color: '#2c3235' } },
        axisLabel: { color: '#8e8e8e', fontSize: 11 },
        splitLine: { show: false }
      },
      visualMap: {
        min: store.minValue,
        max: store.maxValue,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 8,
        textStyle: { color: '#8e8e8e', fontSize: 10 },
        inRange: { color: ['#1a3a5c', '#2d6a9f', '#4a9fd4', '#73bf69', '#f2cc0c', '#ff9830', '#f2495c'] }
      },
      series: [{
        type: 'heatmap',
        data: heatData,
        label: { show: true, fontSize: 10, color: '#d0d0d0',
          formatter: (p: any) => p.data[2] > 50 ? String(p.data[2]) : ''
        },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(87,148,242,0.5)' } },
        itemStyle: { borderColor: '#111217', borderWidth: 1 }
      }]
    }
  })

  return { chartOption, store }
}

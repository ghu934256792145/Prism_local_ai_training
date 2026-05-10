import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { usePrismAPI } from '@/composables/usePrismAPI'
import { parsePrismQL, type MatrixOp } from '@/lib/prismql'

export interface MatrixCell { row: number; col: number; value: number }

export const useMatrixStore = defineStore('matrix', () => {
  const api = usePrismAPI()
  const data = ref<MatrixCell[]>([])
  const rowLabels = ref<string[]>([])
  const colLabels = ref<string[]>([])
  const loading = ref(false)
  const query = ref('MATRIX APPLY op="risk_score" ON vector=customer_42')
  const queryError = ref<string | null>(null)
  const selectedOp = ref<MatrixOp>('pnl')

  const ops = ['pnl', 'risk_score', 'correlation', 'transition'] as const

  async function loadMockData() {
    loading.value = true
    const live = await api.postMatrixApply(selectedOp.value, { dataset: 'financials_fy2025', params: {} }) as {
      data: MatrixCell[]
      rowLabels: string[]
      colLabels: string[]
    } | null
    if (live?.data?.length && live?.rowLabels?.length && live?.colLabels?.length) {
      rowLabels.value = live.rowLabels
      colLabels.value = live.colLabels
      data.value = live.data
      loading.value = false
      return
    }

    const rows = ['Sales', 'COGS', 'Gross Profit', 'Marketing', 'R&D', 'G&A', 'EBITDA', 'CapEx', 'Free CF', 'Net Income']
    const cols = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    const base = [
      [420, 435, 448, 461, 475, 490, 510, 498, 515, 528, 542, 580],
      [210, 217, 224, 230, 237, 245, 255, 249, 257, 264, 271, 290],
      [210, 218, 224, 231, 238, 245, 255, 249, 258, 264, 271, 290],
      [ 42,  44,  45,  46,  47,  49,  51,  50,  51,  53,  54,  58],
      [ 38,  39,  40,  41,  43,  44,  46,  45,  46,  47,  49,  52],
      [ 21,  22,  22,  23,  24,  24,  25,  25,  26,  26,  27,  29],
      [109, 113, 117, 121, 124, 128, 133, 129, 135, 138, 141, 151],
      [ 25,  26,  27,  28,  29,  30,  31,  30,  32,  33,  34,  36],
      [ 84,  87,  90,  93,  95,  98, 102,  99, 103, 105, 107, 115],
      [ 67,  69,  72,  74,  76,  78,  82,  79,  82,  84,  86,  92],
    ]

    const cells: MatrixCell[] = []
    base.forEach((row, r) => row.forEach((val, c) => {
      cells.push({ row: r, col: c, value: val + Math.round((Math.random() - 0.5) * 10) })
    }))

    setTimeout(() => {
      rowLabels.value = rows
      colLabels.value = cols
      data.value = cells
      loading.value = false
    }, 250)
  }

  async function runQuery() {
    const parsed = parsePrismQL(query.value)
    queryError.value = parsed.error
    if (!parsed.ast) return
    if (parsed.ast.kind !== 'matrix') {
      queryError.value = 'This explorer expects a MATRIX query.'
      return
    }

    selectedOp.value = parsed.ast.op
    await loadMockData()
  }

  const minValue = computed(() => data.value.length ? Math.min(...data.value.map(d => d.value)) : 0)
  const maxValue = computed(() => data.value.length ? Math.max(...data.value.map(d => d.value)) : 100)
  const totalSum = computed(() => data.value.filter(d => d.row === 0).reduce((s, d) => s + d.value, 0))

  return { data, rowLabels, colLabels, loading, query, queryError, selectedOp, ops, loadMockData, runQuery, minValue, maxValue, totalSum }
})

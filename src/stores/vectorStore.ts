import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { usePrismAPI } from '@/composables/usePrismAPI'
import { parsePrismQL } from '@/lib/prismql'

export interface VectorPoint {
  id: string
  label: string
  x: number
  y: number
  cluster: number
  score: number
  tags: string[]
}

export const useVectorStore = defineStore('vector', () => {
  const api = usePrismAPI()
  const points = ref<VectorPoint[]>([])
  const loading = ref(false)
  const selectedId = ref<string | null>(null)
  const query = ref('VECTOR SIMILARITY id=vec-0-0 TOP 10')
  const queryError = ref<string | null>(null)
  const searchQuery = ref('')
  const topK = ref(10)

  async function loadMockData() {
    loading.value = true
    const live = await api.getVectors() as { points: VectorPoint[] } | null
    if (live?.points?.length) {
      points.value = live.points
      if (!selectedId.value) selectedId.value = live.points[0]?.id ?? null
      loading.value = false
      return
    }

    const clusters = [
      { cx: -3.5, cy: 2.0,  name: 'Financial Analytics', color: 0, tags: ['finance', 'BI', 'ERP'] },
      { cx:  3.0, cy: 3.5,  name: 'Graph Traversal',      color: 1, tags: ['graph', 'network', 'topology'] },
      { cx: -2.0, cy: -3.5, name: 'ML Embeddings',        color: 2, tags: ['ml', 'vector', 'AI'] },
      { cx:  3.5, cy: -2.5, name: 'NVMe Workloads',       color: 3, tags: ['nvme', 'io', 'storage'] },
    ]

    const generated: VectorPoint[] = []
    clusters.forEach((cl, ci) => {
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2
        const r = Math.random() * 1.8
        generated.push({
          id: `vec-${ci}-${i}`,
          label: `${cl.name.split(' ')[0]}-${i.toString().padStart(2, '0')}`,
          x: cl.cx + Math.cos(angle) * r,
          y: cl.cy + Math.sin(angle) * r,
          cluster: ci,
          score: 0.6 + Math.random() * 0.4,
          tags: cl.tags
        })
      }
    })

    setTimeout(() => {
      points.value = generated
      if (!selectedId.value) selectedId.value = generated[0]?.id ?? null
      loading.value = false
    }, 280)
  }

  async function runQuery() {
    const parsed = parsePrismQL(query.value)
    queryError.value = parsed.error
    if (!parsed.ast) return
    if (parsed.ast.kind !== 'vector') {
      queryError.value = 'This explorer expects a VECTOR query.'
      return
    }

    loading.value = true
    topK.value = parsed.ast.topK
    const live = await api.postVectorSearch(parsed.ast.id, parsed.ast.topK) as {
      query: VectorPoint
      points: VectorPoint[]
    } | null

    if (live?.points?.length) {
      points.value = live.points
      selectedId.value = live.query?.id ?? parsed.ast.id
      loading.value = false
      return
    }

    await loadMockData()
    selectedId.value = points.value.some(point => point.id === parsed.ast?.id) ? parsed.ast.id : points.value[0]?.id ?? null
  }

  const clusterNames = ['Financial Analytics', 'Graph Traversal', 'ML Embeddings', 'NVMe Workloads']
  const selectedPoint = computed(() => points.value.find(p => p.id === selectedId.value) ?? null)
  const nearestNeighbors = computed(() => {
    if (!selectedPoint.value) return []
    const sp = selectedPoint.value
    return [...points.value]
      .filter(p => p.id !== sp.id)
      .map(p => ({ ...p, dist: Math.hypot(p.x - sp.x, p.y - sp.y) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, topK.value)
  })

  return { points, loading, selectedId, query, queryError, searchQuery, topK, loadMockData, runQuery, clusterNames, selectedPoint, nearestNeighbors }
})

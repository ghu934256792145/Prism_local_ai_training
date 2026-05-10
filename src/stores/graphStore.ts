import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { usePrismAPI } from '@/composables/usePrismAPI'
import { parsePrismQL, type ExplainStep } from '@/lib/prismql'

export interface GraphNode {
  id: string
  label: string
  category: number
  value: number
  symbolSize: number
  x?: number
  y?: number
}

export interface GraphEdge {
  source: string
  target: string
  weight?: number
  label?: string
}

export const useGraphStore = defineStore('graph', () => {
  const api = usePrismAPI()
  const nodes = ref<GraphNode[]>([])
  const edges = ref<GraphEdge[]>([])
  const loading = ref(false)
  const selectedNode = ref<string | null>(null)
  const query = ref('GRAPH MATCH (a)-[DEPENDS_ON]->(b) RETURN a, b LIMIT 50')
  const queryError = ref<string | null>(null)
  const explainPlan = ref<ExplainStep[] | null>(null)
  const pathResult = ref<string[] | null>(null)

  const categories = ['service', 'database', 'queue', 'cache', 'gateway', 'worker']

  async function loadMockData() {
    loading.value = true
    const live = await api.getGraph() as { nodes: GraphNode[]; edges: GraphEdge[] } | null
    if (live?.nodes?.length && live?.edges?.length) {
      nodes.value = live.nodes
      edges.value = live.edges
      loading.value = false
      return
    }

    const mockNodes: GraphNode[] = [
      { id: 'api-gw',       label: 'API Gateway',      category: 4, value: 8, symbolSize: 40 },
      { id: 'auth-svc',     label: 'Auth Service',     category: 0, value: 6, symbolSize: 32 },
      { id: 'user-svc',     label: 'User Service',     category: 0, value: 5, symbolSize: 30 },
      { id: 'order-svc',    label: 'Order Service',    category: 0, value: 7, symbolSize: 36 },
      { id: 'product-svc',  label: 'Product Service',  category: 0, value: 5, symbolSize: 30 },
      { id: 'payment-svc',  label: 'Payment Service',  category: 0, value: 6, symbolSize: 32 },
      { id: 'notify-svc',   label: 'Notify Service',   category: 0, value: 3, symbolSize: 24 },
      { id: 'analytics-svc',label: 'Analytics',        category: 0, value: 4, symbolSize: 26 },
      { id: 'user-db',      label: 'User DB',          category: 1, value: 5, symbolSize: 28 },
      { id: 'order-db',     label: 'Order DB',         category: 1, value: 5, symbolSize: 28 },
      { id: 'product-db',   label: 'Product DB',       category: 1, value: 4, symbolSize: 26 },
      { id: 'payment-db',   label: 'Payment DB',       category: 1, value: 4, symbolSize: 26 },
      { id: 'redis-cache',  label: 'Redis Cache',      category: 3, value: 6, symbolSize: 30 },
      { id: 'kafka',        label: 'Kafka',            category: 2, value: 7, symbolSize: 34 },
      { id: 'elastic',      label: 'Elasticsearch',    category: 1, value: 4, symbolSize: 26 },
      { id: 'ml-worker',    label: 'ML Worker',        category: 5, value: 3, symbolSize: 22 },
      { id: 'report-worker',label: 'Report Worker',    category: 5, value: 2, symbolSize: 20 },
      { id: 'email-worker', label: 'Email Worker',     category: 5, value: 2, symbolSize: 20 },
      { id: 'sms-worker',   label: 'SMS Worker',       category: 5, value: 2, symbolSize: 20 },
      { id: 'cdn',          label: 'CDN',              category: 4, value: 5, symbolSize: 28 },
    ]

    const mockEdges: GraphEdge[] = [
      { source: 'api-gw',      target: 'auth-svc',      label: 'AUTH' },
      { source: 'api-gw',      target: 'user-svc',      label: 'ROUTE' },
      { source: 'api-gw',      target: 'order-svc',     label: 'ROUTE' },
      { source: 'api-gw',      target: 'product-svc',   label: 'ROUTE' },
      { source: 'api-gw',      target: 'redis-cache',   label: 'CACHE' },
      { source: 'auth-svc',    target: 'user-db',       label: 'READ' },
      { source: 'auth-svc',    target: 'redis-cache',   label: 'SESSION' },
      { source: 'user-svc',    target: 'user-db',       label: 'CRUD' },
      { source: 'order-svc',   target: 'order-db',      label: 'CRUD' },
      { source: 'order-svc',   target: 'product-svc',   label: 'DEPENDS_ON' },
      { source: 'order-svc',   target: 'payment-svc',   label: 'DEPENDS_ON' },
      { source: 'order-svc',   target: 'kafka',         label: 'PUBLISH' },
      { source: 'product-svc', target: 'product-db',    label: 'CRUD' },
      { source: 'product-svc', target: 'elastic',       label: 'INDEX' },
      { source: 'payment-svc', target: 'payment-db',    label: 'CRUD' },
      { source: 'payment-svc', target: 'kafka',         label: 'PUBLISH' },
      { source: 'kafka',       target: 'notify-svc',    label: 'CONSUME' },
      { source: 'kafka',       target: 'analytics-svc', label: 'CONSUME' },
      { source: 'kafka',       target: 'ml-worker',     label: 'CONSUME' },
      { source: 'notify-svc',  target: 'email-worker',  label: 'DISPATCH' },
      { source: 'notify-svc',  target: 'sms-worker',    label: 'DISPATCH' },
      { source: 'analytics-svc',target: 'elastic',      label: 'WRITE' },
      { source: 'ml-worker',   target: 'product-db',    label: 'READ' },
      { source: 'analytics-svc',target: 'report-worker',label: 'TRIGGER' },
      { source: 'cdn',         target: 'api-gw',        label: 'PROXY' },
    ]

    setTimeout(() => {
      nodes.value = mockNodes
      edges.value = mockEdges
      loading.value = false
    }, 300)
  }

  async function runQuery() {
    explainPlan.value = null
    pathResult.value  = null
    const parsed = parsePrismQL(query.value)
    queryError.value = parsed.error
    if (!parsed.ast) return

    // EXPLAIN — show query plan without executing
    if (parsed.ast.kind === 'explain') {
      explainPlan.value = parsed.ast.steps
      return
    }

    // GRAPH PATH — client-side BFS
    if (parsed.ast.kind === 'path') {
      await loadMockData()
      pathResult.value = clientBFS(parsed.ast.from, parsed.ast.to)
      return
    }

    if (parsed.ast.kind !== 'graph') {
      queryError.value = 'This explorer expects a GRAPH query.'
      return
    }

    await loadMockData()

    // Apply client-side WHERE filter
    let filteredNodes = nodes.value
    let filteredEdges = edges.value

    if (parsed.ast.relation && parsed.ast.relation !== '*') {
      filteredEdges = filteredEdges.filter(e => e.label?.toUpperCase() === parsed.ast!.relation)
    }
    if (parsed.ast.filter) {
      const { field, op, value } = parsed.ast.filter
      const numVal = Number(value)
      filteredNodes = filteredNodes.filter(n => {
        const nodeVal = (n as any)[field] ?? (n as any).value ?? 0
        if (!isNaN(numVal)) {
          if (op === '>') return nodeVal > numVal
          if (op === '<') return nodeVal < numVal
          if (op === '>=') return nodeVal >= numVal
          if (op === '<=') return nodeVal <= numVal
          if (op === '=') return nodeVal === numVal
          if (op === '!=') return nodeVal !== numVal
        }
        return true
      })
    }
    if (parsed.ast.limit) filteredEdges = filteredEdges.slice(0, parsed.ast.limit)

    const visibleIds = new Set(filteredEdges.flatMap(e => [e.source, e.target]))
    nodes.value = filteredNodes.filter(n => visibleIds.has(n.id))
    edges.value = filteredEdges
  }

  function clientBFS(src: string, tgt: string): string[] {
    if (src === tgt) return [src]
    const adj = new Map<string, string[]>()
    for (const e of edges.value) {
      if (!adj.has(e.source)) adj.set(e.source, [])
      adj.get(e.source)!.push(e.target)
    }
    const prev = new Map<string, string>()
    const seen = new Set([src])
    const queue = [src]
    let found = false
    while (queue.length && !found) {
      const cur = queue.shift()!
      for (const nb of (adj.get(cur) ?? [])) {
        if (!seen.has(nb)) {
          seen.add(nb); prev.set(nb, cur); queue.push(nb)
          if (nb === tgt) { found = true; break }
        }
      }
    }
    if (!found) return []
    const path: string[] = []
    let cur = tgt
    while (cur !== src) { path.push(cur); cur = prev.get(cur)! }
    path.push(src)
    return path.reverse()
  }

  const nodeCount = computed(() => nodes.value.length)
  const edgeCount = computed(() => edges.value.length)
  const categoryNames = computed(() => categories)

  return { nodes, edges, loading, selectedNode, query, queryError, explainPlan, pathResult, loadMockData, runQuery, nodeCount, edgeCount, categoryNames }
})

import { ref } from 'vue'
import axios from 'axios'

const BASE = '/api'

export interface StreamEvent {
  type: 'token' | 'done'
  content?: string
  sources?: string[]
}

// ── Store record types (mirror Rust structs) ──────────────────────────────────
export interface NodeRecord {
  id: string
  label: string
  category: number
  value: number
  symbolSize: number
}

export interface EdgeRecord {
  source: string
  target: string
  label: string
  weight: number
}

export interface VectorRecord {
  id: string
  label: string
  x: number
  y: number
  cluster: number
  score: number
  tags: string[]
}

export interface DatasetInfo {
  name: string
  label: string
  description: string
  tags: string[]
  nodeCount: number
  edgeCount: number
}

export interface GraphDiff {
  addedNodes: NodeRecord[]
  removedNodes: NodeRecord[]
  commonNodes: NodeRecord[]
  addedEdges: EdgeRecord[]
  removedEdges: EdgeRecord[]
  commonEdges: EdgeRecord[]
  nodeSimilarity: number
  edgeSimilarity: number
  similarity: number
}

export interface ComputeResult {
  nodes: NodeRecord[]
  edges: EdgeRecord[]
  operation: string
  nodeCount: number
  edgeCount: number
}

export interface TraverseResult {
  algorithm: string
  from: string
  order: string[]
  layers: string[][]
  edgesUsed: [string, string][]
  nodeCount: number
  edgeCount: number
  maxDepthReached: number
}

export interface CentralityScore {
  id: string
  label: string
  score: number
  rank: number
}

export interface CentralityResponse {
  metric: string
  top_n: number
  scores: CentralityScore[]
}

export function usePrismAPI() {
  const error = ref<string | null>(null)

  async function get<T>(path: string): Promise<T | null> {
    try {
      const res = await axios.get<T>(`${BASE}${path}`)
      return res.data
    } catch (e: any) {
      error.value = e.message
      return null
    }
  }

  async function post<T>(path: string, body: unknown): Promise<T | null> {
    try {
      const res = await axios.post<T>(`${BASE}${path}`, body)
      return res.data
    } catch (e: any) {
      error.value = e.message
      return null
    }
  }

  async function del<T>(path: string): Promise<T | null> {
    try {
      const res = await axios.delete<T>(`${BASE}${path}`)
      return res.data
    } catch (e: any) {
      error.value = e.message
      return null
    }
  }

  /**
   * POST /api/ai/stream — SSE streaming from Ollama (or mock fallback).
   * Calls onChunk for each token fragment; calls onDone with final source list.
   * Pass an AbortSignal to cancel mid-stream.
   */
  async function streamAI(
    prompt: string,
    opts: { model?: string; contextMode?: string },
    signal: AbortSignal,
    onChunk: (token: string) => void,
    onDone: (sources: string[]) => void,
  ): Promise<void> {
    let response: Response
    try {
      response = await fetch(`${BASE}/ai/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: opts.model,
          contextMode: opts.contextMode,
        }),
        signal,
      })
    } catch {
      onDone([])
      return
    }

    if (!response.ok || !response.body) {
      onDone([])
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE frames are separated by blank lines; each data line starts with "data: "
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''

        for (const frame of frames) {
          for (const line of frame.split('\n')) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (!raw || raw === 'keep-alive') continue
            try {
              const evt: StreamEvent = JSON.parse(raw)
              if (evt.type === 'token' && evt.content) {
                onChunk(evt.content)
              } else if (evt.type === 'done') {
                onDone(evt.sources ?? [])
                return
              }
            } catch {
              // malformed JSON from stream — ignore
            }
          }
        }
      }
    } catch {
      // aborted or network error
    } finally {
      reader.releaseLock()
    }

    onDone([])
  }

  // ── Graph + Matrix + Vector (fixture/static) ──────────────────────────────
  const getScenarios         = ()                                           => get('/scenarios')
  const getScenarioGraph     = (id: string)                                => get(`/scenarios/${id}/graph`)
  const postScenarioMatrix   = (id: string, op: string, payload: any)      => post(`/scenarios/${id}/matrix/${op}`, payload)
  const getScenarioVector    = (id: string)                                => get(`/scenarios/${id}/vector`)

  const getGraph             = ()                                           => get('/graph')
  const getGraphNode         = (id: string)                                => get(`/graph/node/${id}`)
  const getGraphNeighbors    = (id: string)                                => get(`/graph/${id}/neighbors`)
  const getGraphPath         = (source: string, target: string)            => get(`/graph/path/${encodeURIComponent(source)}/${encodeURIComponent(target)}`)
  const postMatrixApply      = (op: string, payload: any)                  => post(`/matrix/${op}`, payload)
  const getSparseCorrelation = (threshold?: number)                        => get(`/matrix/sparse/correlation${threshold != null ? `?threshold=${threshold}` : ''}`)
  const getVectors           = ()                                           => get('/vector')
  const postVectorSearch     = (id: string, topK: number, metric?: string) => post('/vector/search', { id, topK, metric })
  const getBI                = (query: string)                             => get(`/bi/query?q=${encodeURIComponent(query)}`)
  const postAISynthesize     = (prompt: string, ctx: any)                  => post('/ai/synthesize', { prompt, context: ctx })
  const getAIModels          = ()                                           => get<{ models: string[]; ollama: boolean }>('/ai/models')
  const getNVMeStats         = (deviceId?: string)                         => get(`/nvme/stats${deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : ''}`)
  const getNVMeDevices       = ()                                           => get('/nvme/devices')

  // ── Dynamic store — nodes ─────────────────────────────────────────────────
  const getStoreNodes   = ()                    => get<{ nodes: NodeRecord[] }>('/store/nodes')
  const postStoreNode   = (node: NodeRecord)    => post<{ ok: boolean }>('/store/nodes', node)
  const deleteStoreNode = (id: string)          => del<{ ok: boolean }>(`/store/nodes/${encodeURIComponent(id)}`)

  // ── Dynamic store — edges ─────────────────────────────────────────────────
  const getStoreEdges   = ()                    => get<{ edges: EdgeRecord[] }>('/store/edges')
  const postStoreEdge   = (edge: EdgeRecord)    => post<{ ok: boolean }>('/store/edges', edge)
  // id = "source->target"
  const deleteStoreEdge = (id: string)          => del<{ ok: boolean }>(`/store/edges/${encodeURIComponent(id)}`)

  // ── Dynamic store — vectors ───────────────────────────────────────────────
  const getStoreVectors   = ()                       => get<{ vectors: VectorRecord[] }>('/store/vectors')
  const postStoreVector   = (v: VectorRecord)        => post<{ ok: boolean }>('/store/vectors', v)
  const deleteStoreVector = (id: string)             => del<{ ok: boolean }>(`/store/vectors/${encodeURIComponent(id)}`)

  // ── Meta / self-graph ─────────────────────────────────────────────────────
  const getMetaGraph = () => get('/meta/graph')

  // ── Datasets ──────────────────────────────────────────────────────────────
  const getDatasets     = ()                    => get<{ datasets: DatasetInfo[] }>('/store/datasets')
  const postLoadDataset = (name: string)        => post<{ ok: boolean; dataset: string }>('/store/datasets/load', { name })

  // ── Live graph (dynamic store) ────────────────────────────────────────────
  const getLiveGraph      = ()            => get('/store/graph')
  const getLiveNode       = (id: string)  => get(`/store/graph/node/${id}`)
  const getLiveNeighbors  = (id: string)  => get(`/store/graph/${id}/neighbors`)

  // ── Graph traversal (BFS / DFS animation) ─────────────────────────────────
  const getLiveTraverse   = (from: string, algo = 'bfs', maxDepth = 20) =>
    get(`/store/graph/traverse?from=${encodeURIComponent(from)}&algo=${algo}&max_depth=${maxDepth}`)

  // ── Graph algorithms (live store, Rust engine) ───────────────────────────
  const postGraphTraverse = (from: string, algorithm = 'bfs', maxDepth = 20) =>
    post<TraverseResult>('/graph/traverse', { from, algorithm, max_depth: maxDepth })
  const getGraphCentrality = (metric = 'degree', topN = 20) =>
    get<CentralityResponse>(`/graph/centrality?metric=${metric}&top_n=${topN}`)

  // ── Flexible JSON import ──────────────────────────────────────────────────
  const postStoreImport = (nodes: NodeRecord[], edges: EdgeRecord[], merge = false) =>
    post<{ ok: boolean; nodeCount: number; edgeCount: number; merge: boolean }>(
      '/store/import',
      { nodes, edges, merge },
    )

  // ── Compare + Compute ────────────────────────────────────────────────────
  const postGraphCompare = (targetDataset: string | null, operation = 'compare') =>
    post<{ operation: string; diff?: GraphDiff; result?: ComputeResult }>(
      '/graph/compare',
      { targetDataset, operation },
    )

  const postGraphCompute = (targetDataset: string, operation: string, apply = false) =>
    post<{ operation: string; nodeCount: number; edgeCount: number; applied: boolean; result: ComputeResult }>(
      '/graph/compute',
      { targetDataset, operation, apply },
    )

  return {
    error,
    get, post,
    getScenarios, getScenarioGraph, postScenarioMatrix, getScenarioVector,
    getGraph, getGraphNode, getGraphNeighbors, getGraphPath,
    postMatrixApply, getSparseCorrelation,
    getVectors, postVectorSearch,
    getBI,
    postAISynthesize, getAIModels, streamAI,
    getNVMeStats, getNVMeDevices,
    // store CRUD
    getStoreNodes, postStoreNode, deleteStoreNode,
    getStoreEdges, postStoreEdge, deleteStoreEdge,
    getStoreVectors, postStoreVector, deleteStoreVector,
    // meta / self-graph
    getMetaGraph,
    // datasets
    getDatasets, postLoadDataset,
    // live graph
    getLiveGraph, getLiveNode, getLiveNeighbors,
    // traversal + algorithms
    getLiveTraverse, postGraphTraverse, getGraphCentrality,
    // import
    postStoreImport,
    // compare / compute
    postGraphCompare, postGraphCompute,
  }
}

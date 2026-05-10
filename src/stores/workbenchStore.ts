import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NodeRecord, EdgeRecord } from '@/composables/usePrismAPI'

const STORAGE_KEY = 'prism-local-brain'

export const useWorkbenchStore = defineStore('workbench', () => {
  const nodes = ref<NodeRecord[]>([])
  const edges = ref<EdgeRecord[]>([])
  const name  = ref('Local Brain')

  const nodeCount = computed(() => nodes.value.length)
  const edgeCount = computed(() => edges.value.length)

  function _save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      name: name.value,
      nodes: nodes.value,
      edges: edges.value,
    }))
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw)
      name.value  = data.name  ?? 'Local Brain'
      nodes.value = data.nodes ?? []
      edges.value = data.edges ?? []
    } catch { /* stale / corrupt */ }
  }

  function seed(ns: NodeRecord[], es: EdgeRecord[], datasetName = 'Local Brain') {
    nodes.value = ns.map(n => ({ ...n }))
    edges.value = es.map(e => ({ ...e }))
    name.value  = datasetName
    _save()
  }

  function addNode(n: NodeRecord) {
    nodes.value = nodes.value.filter(x => x.id !== n.id)
    nodes.value.push(n)
    _save()
  }

  function removeNode(id: string) {
    nodes.value = nodes.value.filter(n => n.id !== id)
    edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
    _save()
  }

  function addEdge(e: EdgeRecord) {
    edges.value = edges.value.filter(x => !(x.source === e.source && x.target === e.target))
    edges.value.push(e)
    _save()
  }

  function removeEdge(src: string, tgt: string) {
    edges.value = edges.value.filter(e => !(e.source === src && e.target === tgt))
    _save()
  }

  function updateNode(updated: NodeRecord) {
    const idx = nodes.value.findIndex(n => n.id === updated.id)
    if (idx >= 0) { nodes.value[idx] = updated; _save() }
  }

  function clear() {
    nodes.value = []
    edges.value = []
    _save()
  }

  load()

  return {
    nodes, edges, name, nodeCount, edgeCount,
    load, seed, addNode, removeNode, addEdge, removeEdge, updateNode, clear,
  }
})

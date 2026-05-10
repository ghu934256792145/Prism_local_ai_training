import { defineStore } from 'pinia'
import { ref, nextTick } from 'vue'
import { usePrismAPI } from '@/composables/usePrismAPI'

export interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  tokens?: number
  sources?: string[]
  streaming?: boolean
}

export const useAIStore = defineStore('ai', () => {
  const api = usePrismAPI()

  const messages  = ref<AIMessage[]>([])
  const generating = ref(false)
  const model     = ref('llama3:latest')
  const models    = ref<string[]>(['llama3:latest', 'mistral:latest'])
  const ollamaLive = ref(false)
  const contextMode = ref<'graph' | 'matrix' | 'vector' | 'full'>('full')
  const prompt    = ref('')

  let abortController: AbortController | null = null

  const systemPrompts: Record<string, string> = {
    graph:  'Analyze graph topology, detect critical paths and dependency risks.',
    matrix: 'Perform financial matrix analysis: P&L drivers, variance, risk scoring.',
    vector: 'Explain vector embeddings, cluster semantics, similarity reasoning.',
    full:   'Unified Prism Engine analysis across graph, matrix, vector, and NVMe workloads.',
  }

  async function fetchModels() {
    const result = await api.getAIModels()
    if (result) {
      models.value = result.models
      ollamaLive.value = result.ollama
      // default to first available model if current selection isn't in list
      if (!result.models.includes(model.value) && result.models.length > 0) {
        model.value = result.models[0]
      }
    }
  }

  async function sendMessage(content: string) {
    if (!content.trim() || generating.value) return

    messages.value.push({
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    })

    generating.value = true
    prompt.value = ''

    // Create a streaming assistant placeholder
    const assistantId = (Date.now() + 1).toString()
    messages.value.push({
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      streaming: true,
    })

    abortController = new AbortController()

    await api.streamAI(
      content,
      { model: model.value, contextMode: contextMode.value },
      abortController.signal,
      // onChunk — append token to the live message
      (token) => {
        const msg = messages.value.find(m => m.id === assistantId)
        if (msg) {
          msg.content += token
          // scroll happens via watcher in the component
        }
      },
      // onDone — finalise the message
      (sources) => {
        const msg = messages.value.find(m => m.id === assistantId)
        if (msg) {
          msg.streaming = false
          msg.sources = sources.length > 0 ? sources : undefined
          // rough token estimate: 0.75 tokens/word
          msg.tokens = Math.round(msg.content.split(/\s+/).length / 0.75)
        }
        generating.value = false
        abortController = null
      },
    )
  }

  function stopGenerating() {
    abortController?.abort()
    abortController = null
    // mark the current streaming message as done
    const msg = messages.value.find(m => m.streaming)
    if (msg) {
      msg.streaming = false
      if (!msg.content) msg.content = '*(generation stopped)*'
    }
    generating.value = false
  }

  function clearMessages() {
    stopGenerating()
    messages.value = []
  }

  return {
    messages,
    generating,
    model,
    models,
    ollamaLive,
    contextMode,
    prompt,
    systemPrompts,
    fetchModels,
    sendMessage,
    stopGenerating,
    clearMessages,
  }
})

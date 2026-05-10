import { ref, onUnmounted } from 'vue'

export function useWebSocket(
  path: string,
  onMessage: (data: any) => void,
) {
  const connected = ref(false)
  let ws: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let unmounted = false

  function connect() {
    if (unmounted) return
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${location.host}${path}`
    try {
      ws = new WebSocket(url)
    } catch {
      scheduleReconnect()
      return
    }

    ws.onopen = () => { connected.value = true }

    ws.onmessage = (evt) => {
      try { onMessage(JSON.parse(evt.data)) } catch {}
    }

    ws.onclose = () => {
      connected.value = false
      scheduleReconnect()
    }

    ws.onerror = () => { ws?.close() }
  }

  function scheduleReconnect() {
    if (!unmounted) {
      reconnectTimer = setTimeout(connect, 3000)
    }
  }

  connect()

  onUnmounted(() => {
    unmounted = true
    if (reconnectTimer) clearTimeout(reconnectTimer)
    ws?.close()
  })

  return { connected }
}

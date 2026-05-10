import { ref } from 'vue'

const MAX_HISTORY = 50

export function useQueryHistory(storageKey: string) {
  function loadHistory(): string[] {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? '[]') } catch { return [] }
  }

  const history = ref<string[]>(loadHistory())
  const historyIndex = ref(-1)
  // snapshot of the query before the user started navigating history
  let snapshot = ''

  function push(query: string) {
    const q = query.trim()
    if (!q) return
    // Deduplicate: remove existing entry then prepend
    const idx = history.value.indexOf(q)
    if (idx >= 0) history.value.splice(idx, 1)
    history.value.unshift(q)
    if (history.value.length > MAX_HISTORY) history.value.length = MAX_HISTORY
    localStorage.setItem(storageKey, JSON.stringify(history.value))
    historyIndex.value = -1
  }

  /**
   * Call from @keydown on the textarea.
   * Returns the query string to set, or null if no navigation happened.
   */
  function onKeydown(e: KeyboardEvent, current: string): string | null {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return null
    if (history.value.length === 0) return null

    // Only capture when cursor is on the first or last line (avoid blocking multi-line nav)
    const el = e.target as HTMLTextAreaElement
    const atTop = el.selectionStart === 0 || !el.value.slice(0, el.selectionStart).includes('\n')
    const atBottom = el.selectionEnd === el.value.length || !el.value.slice(el.selectionEnd).includes('\n')

    if (e.key === 'ArrowUp' && !atTop) return null
    if (e.key === 'ArrowDown' && !atBottom) return null

    e.preventDefault()

    // Save the current draft before first navigation
    if (historyIndex.value === -1) snapshot = current

    if (e.key === 'ArrowUp') {
      if (historyIndex.value < history.value.length - 1) historyIndex.value++
    } else {
      if (historyIndex.value > -1) historyIndex.value--
    }

    return historyIndex.value === -1 ? snapshot : history.value[historyIndex.value]
  }

  function reset() {
    historyIndex.value = -1
    snapshot = ''
  }

  return { history, historyIndex, push, onKeydown, reset }
}

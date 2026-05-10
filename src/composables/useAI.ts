import { computed } from 'vue'
import { useAIStore } from '@/stores/aiStore'
import { marked } from 'marked'

export function useAI() {
  const store = useAIStore()

  // Simple markdown-to-HTML using basic regex (avoids extra dep)
  function renderMarkdown(text: string): string {
    return text
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/^\s*\|(.+)\|$/gm, (_, row) => {
        const cells = row.split('|').map((c: string) => `<td>${c.trim()}</td>`).join('')
        return `<tr>${cells}</tr>`
      })
      .replace(/(<tr>.*<\/tr>\n?)+/g, m => `<table>${m}</table>`)
      .replace(/^#{3}\s(.+)$/gm, '<h3>$1</h3>')
      .replace(/^#{2}\s(.+)$/gm, '<h2>$1</h2>')
      .replace(/^#{1}\s(.+)$/gm, '<h1>$1</h1>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[a-z])(.+)$/gm, '<p>$1</p>')
  }

  const renderedMessages = computed(() =>
    store.messages.map(m => ({
      ...m,
      html: m.role === 'assistant' ? renderMarkdown(m.content) : m.content
    }))
  )

  const currentSystemPrompt = computed(() => store.systemPrompts[store.contextMode])

  return { store, renderedMessages, currentSystemPrompt }
}

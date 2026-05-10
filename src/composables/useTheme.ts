import { ref, watch } from 'vue'

export type Theme = 'dark' | 'darker' | 'high-contrast'
export const THEMES: Theme[] = ['dark', 'darker', 'high-contrast']
export const THEME_LABELS: Record<Theme, string> = {
  'dark': 'Dark',
  'darker': 'Darker',
  'high-contrast': 'High Contrast',
}

const stored = localStorage.getItem('prism-theme') as Theme | null
const theme = ref<Theme>(THEMES.includes(stored as Theme) ? (stored as Theme) : 'dark')

watch(
  theme,
  (t) => {
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('prism-theme', t)
  },
  { immediate: true },
)

export function useTheme() {
  function cycle() {
    const idx = THEMES.indexOf(theme.value)
    theme.value = THEMES[(idx + 1) % THEMES.length]
  }
  function set(t: Theme) {
    theme.value = t
  }
  return { theme, THEMES, THEME_LABELS, cycle, set }
}

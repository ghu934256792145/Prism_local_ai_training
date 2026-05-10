import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PrismPlugin, PluginInstance } from '@/types/plugin'

const STORAGE_KEY = 'prism-plugins-enabled'

export const usePluginStore = defineStore('plugins', () => {
  const instances = ref<PluginInstance[]>([])
  const loading   = ref(false)
  const error     = ref<string | null>(null)

  // ── Registration ───────────────────────────────────────────────────────────

  function register(plugin: PrismPlugin, enabledByDefault = true) {
    if (instances.value.some(i => i.plugin.id === plugin.id)) return
    const stored  = loadEnabledIds()
    const enabled = stored ? stored.includes(plugin.id) : enabledByDefault
    instances.value.push({ plugin, enabled, installedAt: new Date().toISOString() })
  }

  // ── Enable / disable ───────────────────────────────────────────────────────

  function toggle(id: string) {
    const inst = instances.value.find(i => i.plugin.id === id)
    if (inst) { inst.enabled = !inst.enabled; persist() }
  }

  // ── Fetch from API  ────────────────────────────────────────────────────────

  async function fetchFromApi() {
    loading.value = true
    error.value   = null
    try {
      const res  = await fetch('/api/plugins')
      const data = await res.json() as { plugins: Omit<PrismPlugin, 'type'>[] & { pluginType: string }[] }
      for (const raw of data.plugins as unknown as Array<Record<string, unknown>>) {
        const plugin: PrismPlugin = {
          id:          raw.id          as string,
          name:        raw.name        as string,
          version:     raw.version     as string,
          author:      raw.author      as string,
          type:        raw.pluginType  as PrismPlugin['type'],
          description: raw.description as string,
          icon:        raw.icon        as string,
          endpoint:    raw.endpoint    as string | undefined,
        }
        register(plugin)
      }
    } catch {
      error.value = 'Could not reach /api/plugins — engine offline'
    } finally {
      loading.value = false
    }
  }

  // ── Execute / fetch ────────────────────────────────────────────────────────

  async function execute(id: string, params?: Record<string, unknown>): Promise<unknown> {
    const inst = instances.value.find(i => i.plugin.id === id)
    if (!inst) throw new Error(`Plugin ${id} not found`)
    let result: unknown
    if (inst.plugin.execute) {
      result = await inst.plugin.execute(params)
    } else if (inst.plugin.endpoint) {
      const res = await fetch(inst.plugin.endpoint)
      result = await res.json()
    }
    inst.lastResult = result
    inst.lastRunAt  = new Date().toISOString()
    return result
  }

  async function fetchData(id: string, params?: Record<string, unknown>): Promise<unknown> {
    const inst = instances.value.find(i => i.plugin.id === id)
    if (!inst) throw new Error(`Plugin ${id} not found`)
    if (inst.plugin.fetchData) return inst.plugin.fetchData(params)
    if (inst.plugin.endpoint) {
      const url = inst.plugin.endpoint + (params?.module ? `/${params.module}` : '')
      return (await fetch(url)).json()
    }
    return null
  }

  // ── Computed views ─────────────────────────────────────────────────────────

  const allPlugins        = computed(() => instances.value.map(i => i.plugin))
  const enabledPlugins    = computed(() => instances.value.filter(i => i.enabled).map(i => i.plugin))
  const panelPlugins      = computed(() => enabledPlugins.value.filter(p => p.type === 'panel'))
  const datasourcePlugins = computed(() => enabledPlugins.value.filter(p => p.type === 'datasource'))
  const algorithmPlugins  = computed(() => enabledPlugins.value.filter(p => p.type === 'algorithm'))

  function isEnabled(id: string) {
    return instances.value.find(i => i.plugin.id === id)?.enabled ?? false
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  function loadEnabledIds(): string[] | null {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      return s ? JSON.parse(s) : null
    } catch { return null }
  }

  function persist() {
    const ids = instances.value.filter(i => i.enabled).map(i => i.plugin.id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  }

  return {
    instances, loading, error,
    register, toggle, fetchFromApi, execute, fetchData, isEnabled,
    allPlugins, enabledPlugins, panelPlugins, datasourcePlugins, algorithmPlugins,
  }
})

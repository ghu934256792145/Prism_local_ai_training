import type { Component } from 'vue'

export type PluginType = 'datasource' | 'panel' | 'algorithm'

export interface PrismPlugin {
  id: string
  name: string
  version: string
  author: string
  type: PluginType
  description: string
  icon: string
  endpoint?: string
  // Runtime-only (client-side enrichment):
  component?: () => Promise<{ default: Component }>
  execute?: (params?: Record<string, unknown>) => Promise<unknown>
  fetchData?: (params?: Record<string, unknown>) => Promise<unknown>
}

export interface PluginInstance {
  plugin: PrismPlugin
  enabled: boolean
  installedAt: string
  lastResult?: unknown
  lastRunAt?: string
}

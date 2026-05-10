<template>
  <div class="pm-page">
    <!-- Header bar -->
    <div class="pm-header">
      <div class="pm-header-left">
        <span class="text-muted" style="font-size:12px">
          {{ pluginStore.instances.length }} plugins installed ·
          {{ pluginStore.enabledPlugins.length }} enabled
        </span>
      </div>
      <div class="pm-header-right">
        <button class="btn" style="padding:4px 12px;font-size:11px" @click="refreshFromApi">
          ⟳ Refresh from Engine
        </button>
        <span v-if="pluginStore.loading" class="text-muted" style="font-size:11px">Loading…</span>
        <span v-if="pluginStore.error" class="text-accent-red" style="font-size:11px">
          {{ pluginStore.error }}
        </span>
      </div>
    </div>

    <!-- Algorithm run result drawer -->
    <div v-if="runResult" class="result-drawer">
      <div class="result-drawer-header">
        <span class="result-drawer-title">{{ runPlugin?.icon }} {{ runPlugin?.name }} — Results</span>
        <div style="display:flex;gap:6px;align-items:center">
          <span class="text-muted" style="font-size:10px">{{ runAt }}</span>
          <button class="btn" style="padding:2px 8px;font-size:11px" @click="runResult = null">✕ Close</button>
        </div>
      </div>
      <div class="result-body">
        <table class="result-table">
          <thead>
            <tr><th>#</th><th>Node</th><th>Score</th><th>Rank</th></tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in resultRows" :key="i">
              <td class="text-muted">{{ i + 1 }}</td>
              <td>{{ row.label ?? row.id ?? '—' }}</td>
              <td class="text-accent-blue font-mono">{{ row.score?.toFixed(5) ?? '—' }}</td>
              <td class="text-muted">#{{ row.rank ?? i + 1 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Data fetch result drawer -->
    <div v-if="fetchResult" class="result-drawer">
      <div class="result-drawer-header">
        <span class="result-drawer-title">{{ fetchPlugin?.icon }} {{ fetchPlugin?.name }} — Data Sample</span>
        <button class="btn" style="padding:2px 8px;font-size:11px" @click="fetchResult = null">✕ Close</button>
      </div>
      <div class="result-body">
        <pre class="json-preview">{{ JSON.stringify(fetchResult, null, 2).slice(0, 1200) }}…</pre>
      </div>
    </div>

    <!-- Plugin sections -->
    <div class="pm-sections">
      <!-- Datasources -->
      <section class="pm-section">
        <div class="pm-section-header">
          <span class="pm-section-title">Datasources</span>
          <span class="pm-section-count">{{ datasourceInstances.length }}</span>
        </div>
        <div class="plugin-grid">
          <div
            v-for="inst in datasourceInstances"
            :key="inst.plugin.id"
            class="plugin-card"
            :class="{ disabled: !inst.enabled }"
          >
            <div class="plugin-card-header">
              <span class="plugin-icon">{{ inst.plugin.icon }}</span>
              <div class="plugin-meta">
                <div class="plugin-name">{{ inst.plugin.name }}</div>
                <div class="plugin-version text-muted">v{{ inst.plugin.version }} · {{ inst.plugin.author }}</div>
              </div>
              <label class="toggle-switch" :title="inst.enabled ? 'Disable' : 'Enable'">
                <input type="checkbox" :checked="inst.enabled" @change="pluginStore.toggle(inst.plugin.id)">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <p class="plugin-desc text-muted">{{ inst.plugin.description }}</p>
            <div class="plugin-actions">
              <span v-if="inst.plugin.endpoint" class="endpoint-chip">
                {{ inst.plugin.endpoint }}
              </span>
              <button
                v-if="inst.enabled"
                class="btn btn-sm"
                :disabled="fetching === inst.plugin.id"
                @click="testConnection(inst.plugin)"
              >
                {{ fetching === inst.plugin.id ? '…' : '⚡ Test' }}
              </button>
            </div>
          </div>
          <div v-if="!datasourceInstances.length" class="empty-section text-muted">No datasource plugins installed</div>
        </div>
      </section>

      <!-- Panels -->
      <section class="pm-section">
        <div class="pm-section-header">
          <span class="pm-section-title">Panels</span>
          <span class="pm-section-count">{{ panelInstances.length }}</span>
        </div>
        <div class="plugin-grid">
          <div
            v-for="inst in panelInstances"
            :key="inst.plugin.id"
            class="plugin-card"
            :class="{ disabled: !inst.enabled }"
          >
            <div class="plugin-card-header">
              <span class="plugin-icon">{{ inst.plugin.icon }}</span>
              <div class="plugin-meta">
                <div class="plugin-name">{{ inst.plugin.name }}</div>
                <div class="plugin-version text-muted">v{{ inst.plugin.version }} · {{ inst.plugin.author }}</div>
              </div>
              <label class="toggle-switch" :title="inst.enabled ? 'Disable' : 'Enable'">
                <input type="checkbox" :checked="inst.enabled" @change="pluginStore.toggle(inst.plugin.id)">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <p class="plugin-desc text-muted">{{ inst.plugin.description }}</p>
            <div class="plugin-actions">
              <span class="type-badge badge-panel">Panel</span>
              <span v-if="inst.enabled" class="type-badge badge-active">Active in Dashboard</span>
            </div>
            <!-- Inline preview when enabled -->
            <div v-if="inst.enabled && inst.plugin.id === 'builtin.risk-heatmap'" class="panel-preview">
              <RiskHeatmapPanel />
            </div>
          </div>
          <div v-if="!panelInstances.length" class="empty-section text-muted">No panel plugins installed</div>
        </div>
      </section>

      <!-- Algorithms -->
      <section class="pm-section">
        <div class="pm-section-header">
          <span class="pm-section-title">Algorithms</span>
          <span class="pm-section-count">{{ algorithmInstances.length }}</span>
        </div>
        <div class="plugin-grid">
          <div
            v-for="inst in algorithmInstances"
            :key="inst.plugin.id"
            class="plugin-card"
            :class="{ disabled: !inst.enabled }"
          >
            <div class="plugin-card-header">
              <span class="plugin-icon">{{ inst.plugin.icon }}</span>
              <div class="plugin-meta">
                <div class="plugin-name">{{ inst.plugin.name }}</div>
                <div class="plugin-version text-muted">v{{ inst.plugin.version }} · {{ inst.plugin.author }}</div>
              </div>
              <label class="toggle-switch" :title="inst.enabled ? 'Disable' : 'Enable'">
                <input type="checkbox" :checked="inst.enabled" @change="pluginStore.toggle(inst.plugin.id)">
                <span class="toggle-slider"></span>
              </label>
            </div>
            <p class="plugin-desc text-muted">{{ inst.plugin.description }}</p>
            <div class="plugin-actions">
              <span v-if="inst.plugin.endpoint" class="endpoint-chip">{{ inst.plugin.endpoint }}</span>
              <button
                v-if="inst.enabled"
                class="btn btn-sm btn-primary"
                :disabled="running === inst.plugin.id"
                @click="runAlgorithm(inst)"
              >
                {{ running === inst.plugin.id ? '⏳ Running…' : '▶ Run' }}
              </button>
            </div>
            <div v-if="inst.lastRunAt" class="last-run text-muted">
              Last run: {{ formatTime(inst.lastRunAt) }}
            </div>
          </div>
          <div v-if="!algorithmInstances.length" class="empty-section text-muted">No algorithm plugins installed</div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePluginStore } from '@/stores/pluginStore'
import type { PrismPlugin, PluginInstance } from '@/types/plugin'
import RiskHeatmapPanel from '@/plugins/RiskHeatmapPanel.vue'

const pluginStore = usePluginStore()

const datasourceInstances = computed(() =>
  pluginStore.instances.filter(i => i.plugin.type === 'datasource'))
const panelInstances = computed(() =>
  pluginStore.instances.filter(i => i.plugin.type === 'panel'))
const algorithmInstances = computed(() =>
  pluginStore.instances.filter(i => i.plugin.type === 'algorithm'))

// ── Algorithm runner ───────────────────────────────────────────────────────
const running   = ref<string | null>(null)
const runResult = ref<unknown>(null)
const runPlugin = ref<PrismPlugin | null>(null)
const runAt     = ref<string>('')

const resultRows = computed(() => {
  if (!runResult.value) return []
  const d = runResult.value as { scores?: unknown[]; centrality?: unknown[] }
  return (d.scores ?? d.centrality ?? (Array.isArray(runResult.value) ? runResult.value : [])) as Array<{
    id?: string; label?: string; score?: number; rank?: number
  }>
})

async function runAlgorithm(inst: PluginInstance) {
  running.value   = inst.plugin.id
  runPlugin.value = inst.plugin
  runResult.value = null
  try {
    const result = await pluginStore.execute(inst.plugin.id)
    runResult.value = result
    runAt.value = new Date().toLocaleTimeString()
  } catch (e) {
    runResult.value = { error: String(e) }
  } finally {
    running.value = null
  }
}

// ── Datasource test ────────────────────────────────────────────────────────
const fetching    = ref<string | null>(null)
const fetchResult = ref<unknown>(null)
const fetchPlugin = ref<PrismPlugin | null>(null)

async function testConnection(plugin: PrismPlugin) {
  fetching.value    = plugin.id
  fetchPlugin.value = plugin
  fetchResult.value = null
  try {
    const result = await pluginStore.fetchData(plugin.id)
    fetchResult.value = result
  } catch (e) {
    fetchResult.value = { error: String(e) }
  } finally {
    fetching.value = null
  }
}

// ── Refresh ────────────────────────────────────────────────────────────────
async function refreshFromApi() {
  await pluginStore.fetchFromApi()
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString()
}

onMounted(() => {
  if (pluginStore.instances.length === 0) pluginStore.fetchFromApi()
})
</script>

<style scoped>
.pm-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - var(--header-height) - 28px);
  overflow: hidden;
}

/* Header */
.pm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 8px;
}
.pm-header-right { display: flex; align-items: center; gap: 8px; }

/* Result drawer */
.result-drawer {
  background: var(--bg-panel);
  border: 1px solid var(--accent-blue);
  border-radius: var(--panel-radius);
  flex-shrink: 0;
  max-height: 240px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.result-drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  flex-shrink: 0;
}
.result-drawer-title { font-size: 12px; font-weight: 600; }
.result-body { overflow-y: auto; flex: 1; }
.result-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.result-table th, .result-table td { padding: 5px 12px; border-bottom: 1px solid var(--border); text-align: left; }
.result-table th { background: var(--bg-secondary); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
.json-preview { font-size: 11px; font-family: var(--font-mono); padding: 10px 12px; white-space: pre-wrap; margin: 0; color: var(--text-secondary); }

/* Sections */
.pm-sections { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
.pm-section { display: flex; flex-direction: column; gap: 10px; }
.pm-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}
.pm-section-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); }
.pm-section-count {
  font-size: 10px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1px 7px;
  color: var(--text-muted);
}

/* Cards */
.plugin-grid { display: flex; flex-direction: column; gap: 8px; }
.plugin-card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--panel-radius);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.15s;
}
.plugin-card:hover { border-color: var(--border-hover); }
.plugin-card.disabled { opacity: 0.5; }

.plugin-card-header { display: flex; align-items: center; gap: 10px; }
.plugin-icon { font-size: 20px; flex-shrink: 0; }
.plugin-meta { flex: 1; }
.plugin-name { font-size: 13px; font-weight: 600; }
.plugin-version { font-size: 11px; }
.plugin-desc { font-size: 12px; line-height: 1.5; margin: 0; }

.plugin-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.endpoint-chip {
  font-size: 10px;
  font-family: var(--font-mono);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 6px;
  color: var(--text-muted);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn-sm { padding: 3px 10px; font-size: 11px; }
.btn-primary {
  background: rgba(87,148,242,0.15);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}
.btn-primary:hover { background: rgba(87,148,242,0.25); }

.type-badge {
  font-size: 10px;
  border-radius: 10px;
  padding: 2px 8px;
  border: 1px solid var(--border);
  color: var(--text-muted);
}
.badge-panel  { border-color: var(--accent-green); color: var(--accent-green); }
.badge-active { border-color: var(--accent-blue);  color: var(--accent-blue);  background: rgba(87,148,242,0.1); }

.last-run { font-size: 10px; }

/* Panel preview */
.panel-preview {
  height: 200px;
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}

/* Toggle switch */
.toggle-switch { position: relative; display: inline-block; width: 34px; height: 18px; flex-shrink: 0; cursor: pointer; }
.toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
.toggle-slider {
  position: absolute; inset: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 9px;
  transition: background 0.15s, border-color 0.15s;
}
.toggle-slider::after {
  content: '';
  position: absolute;
  width: 12px; height: 12px;
  background: var(--text-muted);
  border-radius: 50%;
  top: 2px; left: 2px;
  transition: transform 0.15s, background 0.15s;
}
.toggle-switch input:checked + .toggle-slider { background: rgba(87,148,242,0.2); border-color: var(--accent-blue); }
.toggle-switch input:checked + .toggle-slider::after { transform: translateX(16px); background: var(--accent-blue); }

.empty-section { font-size: 12px; padding: 12px 0; }

.text-accent-red { color: var(--accent-red); }
.text-accent-blue { color: var(--accent-blue); }
.font-mono { font-family: var(--font-mono); }
</style>

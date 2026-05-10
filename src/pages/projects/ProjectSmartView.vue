<template>
  <div class="psv-shell">

    <!-- ── Left sidebar ─────────────────────────────────────────────────────── -->
    <aside class="psv-sidebar">

      <!-- Back + project name -->
      <div class="psv-sidebar-top">
        <router-link :to="'/projects/' + projectId" class="back-link">← Detail</router-link>
        <div v-if="project" class="psv-proj-name">{{ project.name }}</div>
        <span v-if="project" class="industry-badge">{{ industryLabel(project.industry) }}</span>
      </div>

      <!-- Smart context KPIs -->
      <div class="panel-header"><span class="panel-title">Smart Context</span></div>
      <div class="psv-kpis" v-if="smartCtx">
        <div class="kpi-chip kpi-blue">
          <span class="kpi-val">{{ smartCtx.project_count }}</span>
          <span class="kpi-label">Projects</span>
        </div>
        <div class="kpi-chip kpi-amber">
          <span class="kpi-val">{{ smartCtx.open_task_count }}</span>
          <span class="kpi-label">Open Tasks</span>
        </div>
        <div class="kpi-chip kpi-red">
          <span class="kpi-val">{{ smartCtx.overdue_count }}</span>
          <span class="kpi-label">Overdue</span>
        </div>
      </div>
      <div v-else-if="smartLoading" class="psv-loading-sm">
        <div class="spinner-sm"></div>
        <span>Loading context…</span>
      </div>

      <!-- Recommendations -->
      <div v-if="smartCtx && smartCtx.recommendations.length" class="psv-recs">
        <div class="panel-subheader">Recommendations</div>
        <div
          v-for="(rec, i) in smartCtx.recommendations"
          :key="i"
          class="rec-chip"
        >
          <span class="rec-icon">{{ recIcon(rec) }}</span>
          <span class="rec-text">{{ rec }}</span>
        </div>
      </div>

      <!-- Task filter -->
      <div class="panel-header" style="margin-top:4px"><span class="panel-title">Task Filter</span></div>
      <div class="psv-filter-group">
        <label
          v-for="opt in FILTER_OPTIONS"
          :key="opt.value"
          class="filter-radio"
          :class="{ active: taskFilter === opt.value }"
        >
          <input
            type="radio"
            :value="opt.value"
            v-model="taskFilter"
            class="sr-only"
          />
          <span class="filter-dot" :style="{ background: opt.color }"></span>
          {{ opt.label }}
        </label>
      </div>

      <!-- Linked-only toggle -->
      <div class="psv-toggle-row">
        <span class="toggle-label">Show only linked nodes</span>
        <button
          class="toggle-btn"
          :class="{ on: linkedOnly }"
          @click="linkedOnly = !linkedOnly"
        >
          <div class="toggle-knob"></div>
        </button>
      </div>

      <!-- Node info panel -->
      <div v-if="selectedNode" class="node-info-panel">
        <div class="panel-header">
          <span class="panel-title">Node</span>
          <button class="popup-close" @click="selectedNode = null">✕</button>
        </div>
        <div class="nip-body">
          <div class="nip-id">{{ selectedNode.id ?? selectedNode.name }}</div>
          <div class="nip-name">{{ selectedNode.name ?? selectedNode.id }}</div>

          <!-- Tasks linked to this node -->
          <div v-if="nodeTaskList.length" class="nip-tasks">
            <div class="panel-subheader" style="margin-bottom:6px">Linked Tasks</div>
            <div
              v-for="t in nodeTaskList"
              :key="t.id"
              class="nip-task-row"
            >
              <span class="status-chip" :class="'status-' + t.status" style="font-size:10px">{{ t.status }}</span>
              <span class="nip-task-title">{{ t.title }}</span>
              <span v-if="t.assignee" class="nip-assignee" :title="t.assignee">{{ initials(t.assignee) }}</span>
            </div>
          </div>
          <div v-else class="nip-no-tasks">No tasks linked to this node.</div>

          <!-- Attach to task button -->
          <button
            class="btn btn-primary"
            style="font-size:11px;padding:4px 12px;margin-top:6px;width:100%;justify-content:center"
            @click="openAttachModal"
          >
            Attach to Task…
          </button>

          <router-link
            :to="'/projects/' + projectId"
            class="nip-detail-link"
          >
            Go to Detail ↗
          </router-link>
        </div>
      </div>

    </aside>

    <!-- ── Main graph area ──────────────────────────────────────────────────── -->
    <div class="psv-main">
      <div v-if="graphLoading" class="graph-loading">
        <div class="spinner"></div>
        <span>Loading industry graph…</span>
      </div>
      <div v-else-if="graphError" class="graph-error">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {{ graphError }}
        <button class="btn" @click="loadData">Retry</button>
      </div>
      <div ref="chartEl" class="chart-fill" v-show="!graphLoading && !graphError"></div>
    </div>

    <!-- ── Attach to Task modal ─────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="attachModalOpen" class="modal-overlay" @click.self="attachModalOpen = false">
        <div class="modal-box">
          <div class="modal-header">
            <span class="modal-title">Attach Node to Task</span>
            <button class="popup-close" @click="attachModalOpen = false">✕</button>
          </div>
          <div class="modal-body">
            <div v-if="selectedNode" class="modal-node-tag">
              Node: <span class="tc-node-badge">{{ selectedNode.id ?? selectedNode.name }}</span>
            </div>

            <label class="modal-label">Task</label>
            <select v-model="attachTaskId" class="tc-select" style="width:100%">
              <option value="" disabled>Select a task…</option>
              <option v-for="t in tasks" :key="t.id" :value="t.id">
                [{{ t.status }}] {{ t.title }}
              </option>
            </select>

            <label class="modal-label">Link Type</label>
            <select v-model="attachLinkType" class="tc-select" style="width:100%">
              <option value="references">references</option>
              <option value="blocks">blocks</option>
              <option value="implements">implements</option>
              <option value="validates">validates</option>
            </select>

            <label class="modal-label">Annotation</label>
            <input
              v-model="attachAnnotation"
              class="modal-input"
              type="text"
              placeholder="Optional note…"
            />

            <div v-if="attachError" class="attach-error">{{ attachError }}</div>

            <div class="modal-actions">
              <button
                class="btn btn-primary"
                :disabled="!attachTaskId || attachSaving"
                @click="doAttach"
              >
                <div v-if="attachSaving" class="spinner-sm"></div>
                {{ attachSaving ? 'Saving…' : 'Attach' }}
              </button>
              <button class="btn" @click="attachModalOpen = false">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts'
import {
  useProjectMgmt,
  type PmProject,
  type PmTask,
  type PmSmartContext,
} from '@/composables/useProjectMgmt'

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE = 'http://localhost:3000'

const FILTER_OPTIONS = [
  { value: 'all',         label: 'All',         color: '#6b7280' },
  { value: 'todo',        label: 'Todo',         color: '#9ca3af' },
  { value: 'in_progress', label: 'In Progress',  color: '#f59e0b' },
  { value: 'blocked',     label: 'Blocked',      color: '#ef4444' },
  { value: 'done',        label: 'Done',         color: '#22c55e' },
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function industryLabel(industry: string): string {
  const MAP: Record<string, string> = {
    pharma:          'Pharmaceuticals',
    genomics:        'Genomics',
    semiconductor:   'Semiconductor',
    'threat-intel':  'Threat Intelligence',
    mfg:             'Manufacturing',
    pipeline:        'Pipeline',
    scaffold:        'Scaffold',
    erp:             'ERP',
    'network-sec':   'Network Security',
  }
  return MAP[industry] ?? industry
}

function graphDatasetToApiUrl(dataset: string): string {
  const d = dataset.toLowerCase()
  if (d === 'drug-discovery')              return `${BASE}/api/pharma/graph`
  if (d === 'genomics-p53')                return `${BASE}/api/genomics/graph/p53`
  if (d === 'genomics-insulin')            return `${BASE}/api/genomics/graph/insulin`
  if (d === 'semiconductor-alu')           return `${BASE}/api/semiconductor/graph/alu`
  if (d === 'semiconductor-risc')          return `${BASE}/api/semiconductor/graph/risc`
  if (d === 'threat-intel-apt29')          return `${BASE}/api/threat/graph/apt29-campaign`
  if (d === 'threat-intel-ransomware')     return `${BASE}/api/threat/graph/ransomware-killchain`
  if (d === 'mfg-bicycle')                 return `${BASE}/api/mfg/graph/bicycle`
  if (d === 'mfg-pump')                    return `${BASE}/api/mfg/graph/pump`
  if (d === 'mfg-electronics')             return `${BASE}/api/mfg/graph/electronics`
  if (d === 'pipeline-process')            return `${BASE}/api/pipeline/graph/process`
  if (d === 'pipeline-water')              return `${BASE}/api/pipeline/graph/water`
  if (d.startsWith('scaffold-'))           return `${BASE}/api/scaffold/graph/${d.replace('scaffold-', '')}`
  if (d === 'network-sec')                 return `${BASE}/api/store/graph`
  if (d === 'erp' || d === 'erp-extended') return `${BASE}/api/erp/graph`
  return `${BASE}/api/store/graph`
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function recIcon(rec: string): string {
  const r = rec.toLowerCase()
  if (r.includes('warn') || r.includes('overdue') || r.includes('blocked')) return '⚠'
  if (r.includes('done') || r.includes('complete') || r.includes('success'))  return '✓'
  if (r.includes('metric') || r.includes('stat') || r.includes('data'))       return '📊'
  return '🔍'
}

// ── State ─────────────────────────────────────────────────────────────────────

const route  = useRoute()
const router = useRouter()

const { fetchProject, fetchTasks, fetchSmartView, linkTaskToNode } = useProjectMgmt()

const projectId = computed(() => route.params.id as string)

const project    = ref<PmProject | null>(null)
const tasks      = ref<PmTask[]>([])
const smartCtx   = ref<PmSmartContext | null>(null)
const smartLoading = ref(false)

// Graph
const chartEl    = ref<HTMLElement | null>(null)
const graphLoading = ref(false)
const graphError = ref<string | null>(null)
let chartInstance: echarts.ECharts | null = null

// Raw graph data
const rawNodes = ref<any[]>([])
const rawEdges = ref<any[]>([])
let graphDataset = ''

// Filters
const taskFilter = ref<string>('all')
const linkedOnly = ref(false)

// Selected node
const selectedNode = ref<any>(null)

// Attach modal
const attachModalOpen  = ref(false)
const attachTaskId     = ref('')
const attachLinkType   = ref('references')
const attachAnnotation = ref('')
const attachSaving     = ref(false)
const attachError      = ref<string | null>(null)

// ── Computed ──────────────────────────────────────────────────────────────────

const nodeTaskList = computed(() => {
  if (!selectedNode.value || !smartCtx.value) return []
  const nid = selectedNode.value.id ?? selectedNode.value.name
  const fromCtx = (smartCtx.value.node_task_map[nid] ?? []).map(t => ({
    id: t.id, title: t.title, status: t.status, assignee: undefined as string | undefined,
  }))
  // Enrich with assignee from local tasks list
  return fromCtx.map(ct => {
    const full = tasks.value.find(t => t.id === ct.id)
    return { ...ct, assignee: full?.assignee }
  })
})

// ── Industry-specific overlay functions ───────────────────────────────────────

function applyIndustryOverlays(nodes: any[], edges: any[], dataset: string): { nodes: any[]; edges: any[] } {
  const d = dataset.toLowerCase()

  // threat-intel: category-0 (actor) nodes get triangle symbol
  if (d.startsWith('threat-intel')) {
    nodes = nodes.map(n =>
      (n.category === 0) ? { ...n, symbol: 'triangle' } : n
    )
  }

  // semiconductor: edges with CARRY or CRITICAL in label get red thick lineStyle
  if (d.startsWith('semiconductor')) {
    edges = edges.map(e => {
      const lbl: string = (e.label ?? '').toUpperCase()
      if (lbl.includes('CARRY') || lbl.includes('CRITICAL')) {
        return { ...e, _critical: true }
      }
      return e
    })
  }

  // drug-discovery: compound nodes (category 0) get roundRect symbol
  if (d === 'drug-discovery') {
    nodes = nodes.map(n =>
      (n.category === 0) ? { ...n, symbol: 'roundRect' } : n
    )
  }

  // genomics: REGULATES edges get dashed line
  if (d.startsWith('genomics')) {
    edges = edges.map(e => {
      if ((e.label ?? '').toUpperCase() === 'REGULATES') {
        return { ...e, _dashed: true }
      }
      return e
    })
  }

  return { nodes, edges }
}

// ── Annotate nodes from smart context ────────────────────────────────────────

function annotateNodes(nodes: any[]): any[] {
  const ctx = smartCtx.value
  const filter = taskFilter.value

  return nodes.map(n => {
    const nodeId = n.id ?? n.name
    const ctxTasks = ctx ? (ctx.node_task_map[nodeId] ?? []) : []

    const hasBlocked  = ctxTasks.some(t => t.status === 'blocked')
    const hasProgress = ctxTasks.some(t => t.status === 'in_progress')
    const allDone     = ctxTasks.length > 0 && ctxTasks.every(t => t.status === 'done')
    const hasTasks    = ctxTasks.length > 0

    const color = hasBlocked ? '#ef4444' : hasProgress ? '#f59e0b' : allDone ? '#22c55e' : null

    // Filter-based dimming
    let opacity = 1
    if (linkedOnly.value && !hasTasks) {
      opacity = 0.15
    } else if (filter !== 'all') {
      if (!hasTasks) {
        opacity = 0.5
      } else {
        const matchesFilter = ctxTasks.some(t => t.status === filter)
        if (!matchesFilter) opacity = 0.2
      }
    }

    const labelText = hasTasks
      ? `${n.name ?? n.label ?? nodeId}\n(${ctxTasks.length})`
      : (n.name ?? n.label ?? nodeId)

    return {
      ...n,
      itemStyle: {
        ...(n.itemStyle ?? {}),
        ...(color ? { color } : {}),
        opacity,
      },
      label: {
        show: true,
        formatter: labelText,
        fontSize: 9,
        color: '#fff',
      },
    }
  })
}

// ── Build ECharts option ──────────────────────────────────────────────────────

function buildOption() {
  const overlaid = applyIndustryOverlays(rawNodes.value, rawEdges.value, graphDataset)
  const annotated = annotateNodes(overlaid.nodes)

  const nodes = annotated.map((n: any) => {
    const base = {
      id: n.id ?? n.name,
      name: n.name ?? n.label ?? n.id,
      category: n.category ?? 0,
      symbolSize: n.symbolSize ?? n.symbol_size ?? 24,
      symbol: n.symbol ?? 'circle',
      itemStyle: n.itemStyle ?? {},
      label: n.label,
    }
    return base
  })

  const edges = overlaid.edges.map((e: any) => ({
    source: e.source,
    target: e.target,
    lineStyle: e._critical
      ? { color: '#ef4444', width: 2, opacity: 0.85, curveness: 0.08 }
      : e._dashed
        ? { color: '#334155', width: 1.2, opacity: 0.6, type: 'dashed', curveness: 0.08 }
        : { color: '#334155', width: 1.2, opacity: 0.55, curveness: 0.08 },
    label: e.label ? {
      show: true,
      formatter: e.label,
      fontSize: 9,
      color: '#64748b',
    } : { show: false },
    symbol: ['none', 'arrow'],
    symbolSize: [0, 5],
  }))

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        if (p.dataType !== 'node') return ''
        const nodeId = p.data.id
        const ctxTasks = smartCtx.value?.node_task_map[nodeId] ?? []
        let html = `<b>${p.data.name}</b>`
        if (ctxTasks.length) {
          html += `<br/><span style="font-size:11px;color:#f59e0b">${ctxTasks.length} task${ctxTasks.length > 1 ? 's' : ''}</span>`
        }
        return html
      },
    },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      force: {
        repulsion: 220,
        edgeLength: [80, 200],
        gravity: 0.04,
        layoutAnimation: true,
      },
      data: nodes,
      edges,
      emphasis: { focus: 'adjacency', blurScope: 'global' },
    }],
  }
}

// ── Init / update chart ───────────────────────────────────────────────────────

function initChart() {
  if (!chartEl.value || !rawNodes.value.length) return

  if (!chartInstance) {
    chartInstance = echarts.init(chartEl.value, 'dark', { renderer: 'canvas' })
  }

  chartInstance.setOption(buildOption(), { notMerge: true })

  // Node click
  chartInstance.off('click')
  chartInstance.on('click', (params: any) => {
    if (params.dataType !== 'node') return
    selectedNode.value = params.data
  })

  // Node contextmenu (right-click) → open attach modal
  chartInstance.off('contextmenu')
  chartInstance.on('contextmenu', (params: any) => {
    if (params.dataType !== 'node') return
    selectedNode.value = params.data
    openAttachModal()
  })
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadGraphData(dataset: string) {
  graphLoading.value = true
  graphError.value   = null
  try {
    const url = graphDatasetToApiUrl(dataset)
    const r = await fetch(url)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const d = await r.json()
    rawNodes.value = d.nodes ?? []
    rawEdges.value = d.edges ?? []
  } catch (e: any) {
    graphError.value = `Failed to load graph: ${e.message}`
    rawNodes.value = []
    rawEdges.value = []
  } finally {
    graphLoading.value = false
  }
}

async function loadSmartContext(industry: string) {
  smartLoading.value = true
  const ctx = await fetchSmartView(industry)
  smartCtx.value = ctx
  smartLoading.value = false
}

async function loadData() {
  const id = projectId.value
  graphError.value = null

  // Load project
  const proj = await fetchProject(id)
  if (proj) {
    project.value = proj
  } else {
    // Minimal fallback
    project.value = {
      id,
      name: 'Project ' + id,
      industry: 'pharma',
      graph_dataset: 'drug-discovery',
      status: 'active',
      priority: 'medium',
      task_count: 0,
      done_count: 0,
    }
  }

  // Load tasks
  const t = await fetchTasks(id)
  tasks.value = t

  // Load smart context and graph in parallel
  const industry = project.value.industry
  graphDataset   = project.value.graph_dataset

  await Promise.all([
    loadSmartContext(industry),
    loadGraphData(graphDataset),
  ])

  nextTick(() => initChart())
}

// ── Attach to task ────────────────────────────────────────────────────────────

function openAttachModal() {
  attachTaskId.value     = ''
  attachLinkType.value   = 'references'
  attachAnnotation.value = ''
  attachError.value      = null
  attachModalOpen.value  = true
}

async function doAttach() {
  if (!attachTaskId.value || !selectedNode.value) return
  attachSaving.value = true
  attachError.value  = null

  const nodeId = selectedNode.value.id ?? selectedNode.value.name
  const result = await linkTaskToNode(
    attachTaskId.value,
    graphDataset,
    nodeId,
    attachLinkType.value,
    attachAnnotation.value || undefined,
  )

  if (result) {
    attachModalOpen.value = false
    // Re-fetch smart context and re-annotate
    await loadSmartContext(project.value?.industry ?? '')
    nextTick(() => initChart())
  } else {
    attachError.value = 'Failed to attach. Check the API is running.'
  }

  attachSaving.value = false
}

// ── Watchers ──────────────────────────────────────────────────────────────────

watch([taskFilter, linkedOnly, smartCtx], () => {
  if (chartInstance && rawNodes.value.length) nextTick(() => initChart())
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────

function onResize() { chartInstance?.resize() }

onMounted(() => {
  loadData()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  chartInstance?.dispose()
  chartInstance = null
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.psv-shell {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
}

/* ── Left sidebar ────────────────────────────────────────────────────────────── */

.psv-sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--bg-panel);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.psv-sidebar-top {
  padding: 14px 14px 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  border-bottom: 1px solid var(--border);
}

.back-link {
  font-size: 12px;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.15s;
}
.back-link:hover { color: var(--accent-blue); }

.psv-proj-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
}

.industry-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(20,184,166,0.15);
  color: #14b8a6;
  align-self: flex-start;
}

/* KPI chips */
.psv-kpis {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.kpi-chip {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 7px 4px;
  border-radius: 6px;
  border: 1px solid var(--border);
}
.kpi-blue   { background: rgba(87,148,242,0.08);  border-color: rgba(87,148,242,0.25); }
.kpi-amber  { background: rgba(245,158,11,0.08);  border-color: rgba(245,158,11,0.25); }
.kpi-red    { background: rgba(239,68,68,0.08);   border-color: rgba(239,68,68,0.25); }

.kpi-val {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.kpi-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 3px;
}

/* Recommendations */
.psv-recs {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  border-bottom: 1px solid var(--border);
}

.panel-subheader {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
}

.rec-chip {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(245,158,11,0.07);
  border: 1px solid rgba(245,158,11,0.2);
  border-radius: 5px;
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.rec-icon {
  flex-shrink: 0;
  font-size: 12px;
  line-height: 1.4;
}

.rec-text { flex: 1; }

/* Task filter */
.psv-filter-group {
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-bottom: 1px solid var(--border);
}

.filter-radio {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  transition: background 0.1s;
}
.filter-radio:hover { background: var(--bg-panel-hover); }
.filter-radio.active {
  background: rgba(99,102,241,0.1);
  color: var(--text-primary);
}

.filter-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
}

/* Toggle */
.psv-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.toggle-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.toggle-btn {
  width: 32px;
  height: 18px;
  border-radius: 9px;
  border: 1px solid var(--border-hover);
  background: var(--bg-secondary);
  cursor: pointer;
  position: relative;
  transition: background 0.2s, border-color 0.2s;
  flex-shrink: 0;
}
.toggle-btn.on { background: #6366f1; border-color: #6366f1; }

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.2s;
}
.toggle-btn.on .toggle-knob { left: 16px; }

/* Loading sm */
.psv-loading-sm {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--text-muted);
}

/* Node info panel */
.node-info-panel {
  flex: 1;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  min-height: 200px;
}

.nip-body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.nip-id {
  font-size: 11px;
  font-family: var(--font-mono);
  color: #818cf8;
  background: rgba(99,102,241,0.1);
  padding: 2px 7px;
  border-radius: 4px;
  align-self: flex-start;
}

.nip-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.nip-tasks {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nip-task-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  background: var(--bg-secondary);
  border-radius: 4px;
}

.nip-task-title {
  flex: 1;
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nip-assignee {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #6366f1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.nip-no-tasks {
  font-size: 11px;
  color: var(--text-muted);
}

.nip-detail-link {
  font-size: 11px;
  color: var(--accent-blue);
  text-decoration: none;
  transition: opacity 0.15s;
}
.nip-detail-link:hover { opacity: 0.75; }

/* ── Status chips ────────────────────────────────────────────────────────────── */

.status-chip {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}
.status-active      { background: rgba(34,197,94,0.15); color: #22c55e; }
.status-paused      { background: rgba(107,114,128,0.15); color: #9ca3af; }
.status-done        { background: rgba(99,102,241,0.15); color: #818cf8; }
.status-todo        { background: rgba(107,114,128,0.15); color: #9ca3af; }
.status-in_progress { background: rgba(245,158,11,0.15); color: #f59e0b; }
.status-blocked     { background: rgba(239,68,68,0.15); color: #ef4444; }

/* ── Main graph area ─────────────────────────────────────────────────────────── */

.psv-main {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}

.chart-fill {
  flex: 1;
  width: 100%;
  min-height: 0;
}

.graph-loading,
.graph-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 13px;
}

.graph-error { color: var(--accent-red); }

/* ── Attach modal ────────────────────────────────────────────────────────────── */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-box {
  background: var(--bg-panel);
  border: 1px solid var(--border-hover);
  border-radius: 8px;
  width: 380px;
  max-width: calc(100vw - 40px);
  box-shadow: 0 16px 48px rgba(0,0,0,0.5);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.modal-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.popup-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  padding: 0 2px;
  line-height: 1;
}
.popup-close:hover { color: var(--text-primary); }

.modal-body {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.modal-node-tag {
  font-size: 12px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.modal-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.modal-input {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 13px;
  padding: 6px 10px;
  outline: none;
  width: 100%;
}
.modal-input:focus { border-color: #6366f1; }

.attach-error {
  font-size: 12px;
  color: var(--accent-red);
  background: rgba(239,68,68,0.08);
  padding: 6px 10px;
  border-radius: 4px;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* ── Shared selects ──────────────────────────────────────────────────────────── */

.tc-select {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 12px;
  padding: 5px 8px;
  outline: none;
  cursor: pointer;
}
.tc-select:focus { border-color: #6366f1; }

.tc-node-badge {
  font-size: 10px;
  color: #818cf8;
  background: rgba(99,102,241,0.15);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
}

/* ── Spinners ────────────────────────────────────────────────────────────────── */

.spinner {
  width: 20px; height: 20px;
  border: 2px solid var(--border);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

.spinner-sm {
  width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>

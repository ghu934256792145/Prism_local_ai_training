<template>
  <div class="pd-shell">

    <!-- ── Left column ─────────────────────────────────────────────────────── -->
    <div class="pd-left">

      <!-- Loading / error state -->
      <div v-if="loading" class="pd-loading">
        <div class="spinner"></div>
        <span>Loading project…</span>
      </div>
      <div v-else-if="loadError" class="pd-error">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {{ loadError }}
      </div>

      <template v-else-if="project">

        <!-- ── 1. Project header ───────────────────────────────────────────── -->
        <div class="pd-header-block">
          <router-link to="/projects" class="back-link">← Projects</router-link>
          <div class="ph-title-row">
            <h1 class="ph-name">{{ project.name }}</h1>
            <span class="priority-badge" :class="'priority-' + project.priority">
              {{ project.priority }}
            </span>
            <span class="status-chip" :class="'status-' + project.status">
              {{ project.status }}
            </span>
          </div>

          <!-- Progress bar -->
          <div class="ph-progress-wrap">
            <div class="ph-progress-track">
              <div
                class="ph-progress-fill"
                :style="{ width: progressPct + '%' }"
              ></div>
            </div>
            <span class="ph-progress-label">
              {{ project.done_count }} / {{ project.task_count }} tasks
            </span>
          </div>

          <!-- Dates + badges -->
          <div class="ph-meta-row">
            <span class="ph-dates">
              {{ fmtDate(project.start_date) }}
              <span class="ph-arrow">→</span>
              {{ fmtDate(project.end_date) }}
            </span>
            <span class="industry-badge">{{ industryLabel(project.industry) }}</span>
            <span class="dataset-tag">{{ project.graph_dataset }}</span>
          </div>
        </div>

        <!-- ── 2. Task board ───────────────────────────────────────────────── -->
        <div class="pd-section-title">Task Board</div>
        <div class="task-board">
          <div v-for="col in TASK_COLUMNS" :key="col.status" class="task-col">
            <div class="task-col-header">
              <span class="task-col-dot" :style="{ background: col.color }"></span>
              <span class="task-col-label">{{ col.label }}</span>
              <span class="task-col-count">{{ tasksByStatus(col.status).length }}</span>
            </div>
            <div class="task-col-body">
              <div
                v-for="task in tasksByStatus(col.status)"
                :key="task.id"
                class="task-card"
                :class="{ expanded: expandedTask === task.id }"
                @click="toggleTask(task)"
              >
                <div class="tc-top">
                  <div class="tc-title-row">
                    <span class="tc-priority-dot" :style="{ background: priorityColor(task.priority) }"></span>
                    <span class="tc-title">{{ task.title }}</span>
                  </div>
                  <div class="tc-meta-row">
                    <div
                      v-if="task.assignee"
                      class="tc-avatar"
                      :style="{ background: avatarColor(task.assignee) }"
                      :title="task.assignee"
                    >
                      {{ initials(task.assignee) }}
                    </div>
                    <span
                      v-if="task.due_date"
                      class="tc-due"
                      :class="{ overdue: isOverdue(task.due_date) }"
                    >
                      {{ fmtDate(task.due_date) }}
                    </span>
                    <span
                      v-if="task.graph_node_id"
                      class="tc-node-badge"
                      @click.stop="highlightNode(task.graph_node_id!)"
                    >
                      #{{ task.graph_node_id }}
                    </span>
                  </div>
                </div>

                <!-- Expanded inline editor -->
                <div v-if="expandedTask === task.id" class="tc-expand" @click.stop>
                  <label class="tc-edit-label">Status</label>
                  <select
                    class="tc-select"
                    :value="editStatus"
                    @change="editStatus = ($event.target as HTMLSelectElement).value as any"
                  >
                    <option value="todo">Todo</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="done">Done</option>
                  </select>
                  <label class="tc-edit-label">Notes</label>
                  <textarea
                    class="tc-notes"
                    v-model="editNotes"
                    rows="3"
                    placeholder="Add notes…"
                  ></textarea>
                  <div class="tc-actions">
                    <button class="btn btn-primary" style="font-size:12px;padding:4px 12px" @click="saveTask(task)">Save</button>
                    <button class="btn" style="font-size:12px;padding:4px 10px" @click.stop="expandedTask = null">Cancel</button>
                  </div>
                </div>
              </div>
              <div v-if="!tasksByStatus(col.status).length" class="task-col-empty">No tasks</div>
            </div>
          </div>
        </div>

        <!-- ── 3. Milestones ──────────────────────────────────────────────── -->
        <div class="pd-section-title">Milestones</div>
        <div class="milestone-timeline">
          <div
            v-for="ms in milestones"
            :key="ms.id"
            class="ms-chip"
            :class="{ completed: ms.completed }"
            @click="doCompleteMilestone(ms)"
          >
            <div class="ms-circle" :class="{ filled: ms.completed }"></div>
            <div class="ms-info">
              <span class="ms-title">{{ ms.title }}</span>
              <span v-if="ms.due_date" class="ms-date">{{ fmtDate(ms.due_date) }}</span>
            </div>
          </div>
          <div v-if="!milestones.length" class="task-col-empty" style="padding:0">No milestones</div>
        </div>

        <!-- ── 4. Team members ─────────────────────────────────────────────── -->
        <div class="pd-section-title">Team</div>
        <div class="member-grid">
          <div v-for="m in members" :key="m.id" class="member-card">
            <div class="member-avatar" :style="{ background: avatarColor(m.name) }">
              {{ initials(m.name) }}
            </div>
            <div class="member-info">
              <span class="member-name">{{ m.name }}</span>
              <span class="member-role">{{ m.role }}</span>
              <span v-if="m.industry_expertise" class="member-expertise">{{ m.industry_expertise }}</span>
            </div>
          </div>
          <div v-if="!members.length" class="task-col-empty" style="padding:0">No team members</div>
        </div>

      </template>
    </div>

    <!-- ── Right sidebar ────────────────────────────────────────────────────── -->
    <aside class="pd-sidebar">
      <div class="panel-header">
        <div class="sidebar-head-left">
          <span class="panel-title">{{ project ? industryLabel(project.industry) : 'Industry Graph' }}</span>
          <span v-if="project" class="dataset-tag" style="font-size:10px">{{ project.graph_dataset }}</span>
        </div>
        <button
          v-if="project"
          class="btn btn-primary"
          style="font-size:11px;padding:3px 10px;white-space:nowrap"
          @click="router.push('/projects/' + project.id + '/smart')"
        >
          Open Smart View ↗
        </button>
      </div>

      <!-- Graph area -->
      <div class="sidebar-graph-wrap">
        <div v-if="graphLoading" class="graph-loading">
          <div class="spinner-sm"></div>
          <span>Loading graph…</span>
        </div>
        <div ref="chartEl" class="sidebar-chart" v-show="!graphLoading"></div>
      </div>

      <!-- Linked nodes list -->
      <div class="panel-header" style="border-top:1px solid var(--border);margin-top:0">
        <span class="panel-title">Linked Nodes</span>
      </div>
      <div class="linked-nodes">
        <div
          v-for="task in linkedTasks"
          :key="task.id"
          class="linked-row"
          @click="highlightNode(task.graph_node_id!)"
        >
          <span class="tc-node-badge">{{ task.graph_node_id }}</span>
          <span class="linked-title">{{ task.title }}</span>
          <span class="status-chip" :class="'status-' + task.status" style="font-size:10px">
            {{ task.status }}
          </span>
        </div>
        <div v-if="!linkedTasks.length" class="task-col-empty">No graph-linked tasks</div>
      </div>
    </aside>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts'
import {
  useProjectMgmt,
  type PmProject,
  type PmTask,
  type PmMilestone,
  type PmMember,
} from '@/composables/useProjectMgmt'

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE = 'http://localhost:3000'
const TODAY = new Date().toISOString().slice(0, 10)

const TASK_COLUMNS = [
  { status: 'todo',        label: 'Todo',        color: '#6b7280' },
  { status: 'in_progress', label: 'In Progress',  color: '#f59e0b' },
  { status: 'blocked',     label: 'Blocked',      color: '#ef4444' },
  { status: 'done',        label: 'Done',         color: '#22c55e' },
] as const

// ── Fallback data ─────────────────────────────────────────────────────────────

const FALLBACK_PROJECT: PmProject = {
  id: 'proj-pharma',
  name: 'Pharma Discovery Pipeline',
  industry: 'pharma',
  graph_dataset: 'drug-discovery',
  status: 'active',
  priority: 'high',
  start_date: '2025-03-01',
  end_date: '2025-09-30',
  description: 'End-to-end drug candidate discovery and validation pipeline.',
  task_count: 8,
  done_count: 3,
}

const FALLBACK_TASKS: PmTask[] = [
  { id: 't1', project_id: 'proj-pharma', title: 'Define target protein binding site', status: 'done', assignee: 'Alice Chen', due_date: '2025-04-15', graph_node_id: 'compound-aspirin', priority: 'high' },
  { id: 't2', project_id: 'proj-pharma', title: 'Run molecular docking simulations', status: 'in_progress', assignee: 'Bob Kumar', due_date: '2025-05-20', graph_node_id: 'target-egfr', priority: 'high', notes: 'Using AutoDock Vina 4.2' },
  { id: 't3', project_id: 'proj-pharma', title: 'Validate lead compound ADMET', status: 'todo', assignee: 'Carol Singh', due_date: '2025-06-10', priority: 'medium' },
  { id: 't4', project_id: 'proj-pharma', title: 'Prepare regulatory submission docs', status: 'blocked', assignee: 'David Park', due_date: '2025-04-01', priority: 'critical', notes: 'Blocked on legal review' },
  { id: 't5', project_id: 'proj-pharma', title: 'Literature review — kinase inhibitors', status: 'done', assignee: 'Alice Chen', due_date: '2025-03-20', priority: 'low' },
  { id: 't6', project_id: 'proj-pharma', title: 'Set up in vitro assay protocol', status: 'done', assignee: 'Bob Kumar', due_date: '2025-03-28', priority: 'medium' },
  { id: 't7', project_id: 'proj-pharma', title: 'PK/PD modelling for candidate 7c', status: 'in_progress', assignee: 'Carol Singh', due_date: '2025-05-30', graph_node_id: 'pathway-apoptosis', priority: 'high' },
  { id: 't8', project_id: 'proj-pharma', title: 'Board review presentation', status: 'todo', assignee: 'David Park', due_date: '2025-08-01', priority: 'medium' },
]

const FALLBACK_MILESTONES: PmMilestone[] = [
  { id: 'm1', project_id: 'proj-pharma', title: 'Target identified', due_date: '2025-04-01', completed: true },
  { id: 'm2', project_id: 'proj-pharma', title: 'Lead compound selected', due_date: '2025-06-01', completed: false },
  { id: 'm3', project_id: 'proj-pharma', title: 'IND filing ready', due_date: '2025-09-15', completed: false },
]

const FALLBACK_MEMBERS: PmMember[] = [
  { id: 'mem1', project_id: 'proj-pharma', name: 'Alice Chen', role: 'Lead Scientist', industry_expertise: 'Oncology' },
  { id: 'mem2', project_id: 'proj-pharma', name: 'Bob Kumar', role: 'Computational Chemist', industry_expertise: 'Molecular Dynamics' },
  { id: 'mem3', project_id: 'proj-pharma', name: 'Carol Singh', role: 'ADMET Specialist', industry_expertise: 'PK/PD' },
  { id: 'mem4', project_id: 'proj-pharma', name: 'David Park', role: 'Regulatory Affairs', industry_expertise: 'FDA Submissions' },
]

// ── Graph dataset → API URL ───────────────────────────────────────────────────

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

// ── Industry label ────────────────────────────────────────────────────────────

function industryLabel(industry: string): string {
  const MAP: Record<string, string> = {
    pharma:        'Pharmaceuticals',
    genomics:      'Genomics',
    semiconductor: 'Semiconductor',
    'threat-intel': 'Threat Intelligence',
    mfg:           'Manufacturing',
    pipeline:      'Pipeline',
    scaffold:      'Scaffold',
    erp:           'ERP',
    'network-sec': 'Network Security',
  }
  return MAP[industry] ?? industry
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d?: string): string {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(due: string): boolean {
  return due < TODAY
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function avatarColor(name: string): string {
  const COLORS = ['#6366f1','#14b8a6','#f59e0b','#ec4899','#10b981','#3b82f6','#8b5cf6','#ef4444']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return COLORS[h % COLORS.length]
}

function priorityColor(p: string): string {
  return p === 'critical' ? '#ef4444' : p === 'high' ? '#f59e0b' : p === 'medium' ? '#6366f1' : '#6b7280'
}

// ── State ─────────────────────────────────────────────────────────────────────

const route  = useRoute()
const router = useRouter()
const { fetchProject, fetchTasks, fetchMilestones, updateTask: apiUpdateTask, completeMilestone } = useProjectMgmt()

const loading   = ref(true)
const loadError = ref<string | null>(null)

const project    = ref<PmProject | null>(null)
const tasks      = ref<PmTask[]>([])
const milestones = ref<PmMilestone[]>([])
const members    = ref<PmMember[]>([])

// Task expansion
const expandedTask = ref<string | null>(null)
const editStatus   = ref<string>('todo')
const editNotes    = ref('')

// Graph
const chartEl       = ref<HTMLElement | null>(null)
const graphLoading  = ref(false)
const highlightedId = ref<string | null>(null)
let chartInstance: echarts.ECharts | null = null
let graphNodes: any[] = []
let graphEdges: any[] = []

// ── Computed ──────────────────────────────────────────────────────────────────

const progressPct = computed(() => {
  if (!project.value || !project.value.task_count) return 0
  return Math.round((project.value.done_count / project.value.task_count) * 100)
})

const linkedTasks = computed(() =>
  tasks.value.filter(t => t.graph_node_id)
)

function tasksByStatus(status: string) {
  return tasks.value.filter(t => t.status === status)
}

// ── Task interactions ─────────────────────────────────────────────────────────

function toggleTask(task: PmTask) {
  if (expandedTask.value === task.id) {
    expandedTask.value = null
    return
  }
  expandedTask.value = task.id
  editStatus.value   = task.status
  editNotes.value    = task.notes ?? ''
}

async function saveTask(task: PmTask) {
  await apiUpdateTask(task.id, { status: editStatus.value as any, notes: editNotes.value })
  // Optimistic update
  const t = tasks.value.find(t => t.id === task.id)
  if (t) {
    t.status = editStatus.value as any
    t.notes  = editNotes.value
  }
  expandedTask.value = null
}

// ── Milestones ────────────────────────────────────────────────────────────────

async function doCompleteMilestone(ms: PmMilestone) {
  if (ms.completed) return
  const ok = await completeMilestone(ms.id)
  if (ok) ms.completed = true
}

// ── Members: deduplicate from tasks ───────────────────────────────────────────

async function loadMembers(projectId: string) {
  // Try members endpoint
  try {
    const r = await fetch(`${BASE}/api/pm/members/${encodeURIComponent(projectId)}`)
    if (r.ok) {
      const data = await r.json()
      if (Array.isArray(data) && data.length) { members.value = data; return }
    }
  } catch { /* fall through */ }

  // Derive from task assignees
  const seen = new Set<string>()
  const derived: PmMember[] = []
  tasks.value.forEach(t => {
    if (t.assignee && !seen.has(t.assignee)) {
      seen.add(t.assignee)
      derived.push({
        id: 'mem-' + t.assignee.replace(/\s+/g, '-').toLowerCase(),
        project_id: projectId,
        name: t.assignee,
        role: 'Team Member',
      })
    }
  })
  members.value = derived.length ? derived : FALLBACK_MEMBERS
}

// ── Graph ─────────────────────────────────────────────────────────────────────

function buildGraphOption() {
  const linkedNodeIds = new Set(tasks.value.map(t => t.graph_node_id).filter(Boolean))

  const nodes = graphNodes.map((n: any) => {
    const nodeId = n.id ?? n.name
    const isLinked = linkedNodeIds.has(nodeId)
    const isHighlighted = highlightedId.value === nodeId

    return {
      id: nodeId,
      name: n.name ?? n.label ?? nodeId,
      category: n.category ?? 0,
      symbolSize: n.symbolSize ?? n.symbol_size ?? 24,
      itemStyle: isHighlighted
        ? { borderColor: '#6366f1', borderWidth: 4, shadowBlur: 12, shadowColor: '#6366f1' }
        : isLinked
          ? { borderColor: '#f59e0b', borderWidth: 2 }
          : {},
      label: { show: true, fontSize: 9, color: '#fff' },
    }
  })

  const edges = graphEdges.map((e: any) => ({
    source: e.source,
    target: e.target,
    lineStyle: { color: '#334155', width: 1.2, opacity: 0.6, curveness: 0.08 },
    symbol: ['none', 'arrow'],
    symbolSize: [0, 5],
  }))

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => p.dataType === 'node' ? `<b>${p.data.name}</b>` : '',
    },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      force: { repulsion: 180, edgeLength: [60, 140], gravity: 0.05, layoutAnimation: true },
      data: nodes,
      edges,
      emphasis: { focus: 'adjacency', blurScope: 'global' },
    }],
  }
}

function initChart() {
  if (!chartEl.value) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartEl.value, 'dark', { renderer: 'canvas' })
  }
  chartInstance.setOption(buildGraphOption(), { notMerge: true })
}

function highlightNode(nodeId: string) {
  highlightedId.value = nodeId
  nextTick(() => { if (chartInstance && graphNodes.length) initChart() })
}

async function loadGraph(dataset: string) {
  graphLoading.value = true
  try {
    const url = graphDatasetToApiUrl(dataset)
    const r = await fetch(url)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const d = await r.json()
    graphNodes = d.nodes ?? []
    graphEdges = d.edges ?? []
  } catch {
    graphNodes = []
    graphEdges = []
  } finally {
    graphLoading.value = false
  }
  nextTick(() => initChart())
}

// ── Watchers ──────────────────────────────────────────────────────────────────

watch(tasks, () => {
  if (chartInstance && graphNodes.length) initChart()
}, { deep: true })

// ── Lifecycle ─────────────────────────────────────────────────────────────────

function onResize() { chartInstance?.resize() }

onMounted(async () => {
  const id = route.params.id as string
  loading.value = true

  // Fetch project
  const proj = await fetchProject(id)
  if (proj) {
    project.value = proj
  } else {
    project.value = { ...FALLBACK_PROJECT, id }
  }

  // Fetch tasks
  const t = await fetchTasks(id)
  tasks.value = t.length ? t : FALLBACK_TASKS.map(task => ({ ...task, project_id: id }))

  // Fetch milestones
  const ms = await fetchMilestones(id)
  milestones.value = ms.length ? ms : FALLBACK_MILESTONES.map(m => ({ ...m, project_id: id }))

  // Load members
  await loadMembers(id)

  loading.value = false

  // Load graph
  await loadGraph(project.value.graph_dataset)

  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  chartInstance?.dispose()
  chartInstance = null
  window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.pd-shell {
  display: flex;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
}

/* ── Left column ────────────────────────────────────────────────────────────── */

.pd-left {
  flex: 1;
  min-width: 0;
  width: calc(100% - 340px);
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.pd-loading,
.pd-error {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 13px;
  padding: 40px 0;
}

.pd-error { color: var(--accent-red); }

/* ── Header block ───────────────────────────────────────────────────────────── */

.back-link {
  font-size: 12px;
  color: var(--text-muted);
  text-decoration: none;
  display: inline-block;
  margin-bottom: 12px;
  transition: color 0.15s;
}
.back-link:hover { color: var(--accent-blue); }

.ph-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.ph-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.priority-badge {
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.priority-critical { background: rgba(239,68,68,0.2); color: #ef4444; }
.priority-high     { background: rgba(245,158,11,0.2); color: #f59e0b; }
.priority-medium   { background: rgba(99,102,241,0.2); color: #6366f1; }
.priority-low      { background: rgba(107,114,128,0.2); color: #9ca3af; }

.status-chip {
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}
.status-active    { background: rgba(34,197,94,0.15); color: #22c55e; }
.status-paused    { background: rgba(107,114,128,0.15); color: #9ca3af; }
.status-done      { background: rgba(99,102,241,0.15); color: #818cf8; }
.status-todo      { background: rgba(107,114,128,0.15); color: #9ca3af; }
.status-in_progress { background: rgba(245,158,11,0.15); color: #f59e0b; }
.status-blocked   { background: rgba(239,68,68,0.15); color: #ef4444; }

.ph-progress-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.ph-progress-track {
  flex: 1;
  height: 6px;
  background: var(--bg-secondary);
  border-radius: 3px;
  overflow: hidden;
}

.ph-progress-fill {
  height: 100%;
  background: #6366f1;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.ph-progress-label {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

.ph-meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.ph-dates {
  font-size: 12px;
  color: var(--text-muted);
}

.ph-arrow { color: var(--text-muted); margin: 0 4px; }

.industry-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(20,184,166,0.15);
  color: #14b8a6;
}

.dataset-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  background: rgba(99,102,241,0.12);
  color: #818cf8;
  font-family: var(--font-mono);
}

/* ── Section title ──────────────────────────────────────────────────────────── */

.pd-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
  margin: 24px 0 10px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

/* ── Task board ─────────────────────────────────────────────────────────────── */

.task-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  min-width: 0;
}

.task-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-col-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 6px;
}

.task-col-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-col-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  flex: 1;
}

.task-col-count {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-secondary);
  padding: 0 6px;
  border-radius: 8px;
}

.task-col-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.task-col-empty {
  font-size: 11px;
  color: var(--text-muted);
  padding: 8px 0;
  text-align: center;
}

.task-card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.task-card:hover { border-color: var(--border-hover); background: var(--bg-panel-hover); }
.task-card.expanded { border-color: #6366f1; }

.tc-top { display: flex; flex-direction: column; gap: 5px; }

.tc-title-row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.tc-priority-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}

.tc-title {
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.4;
  word-break: break-word;
}

.tc-meta-row {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.tc-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.tc-due {
  font-size: 10px;
  color: var(--text-muted);
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--bg-secondary);
}
.tc-due.overdue { color: #ef4444; background: rgba(239,68,68,0.1); }

.tc-node-badge {
  font-size: 10px;
  color: #818cf8;
  background: rgba(99,102,241,0.15);
  padding: 1px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-family: var(--font-mono);
  white-space: nowrap;
}
.tc-node-badge:hover { background: rgba(99,102,241,0.3); }

/* Expanded task editor */
.tc-expand {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
}

.tc-edit-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.tc-select {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 12px;
  padding: 4px 8px;
  outline: none;
  cursor: pointer;
}
.tc-select:focus { border-color: #6366f1; }

.tc-notes {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 12px;
  padding: 6px 8px;
  resize: vertical;
  outline: none;
  font-family: inherit;
}
.tc-notes:focus { border-color: #6366f1; }

.tc-actions {
  display: flex;
  gap: 6px;
}

/* ── Milestone timeline ──────────────────────────────────────────────────────── */

.milestone-timeline {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: flex-start;
}

.ms-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border: 1px solid var(--border);
  border-radius: 20px;
  cursor: pointer;
  background: var(--bg-panel);
  transition: border-color 0.15s, background 0.15s;
}
.ms-chip:hover { border-color: var(--border-hover); background: var(--bg-panel-hover); }
.ms-chip.completed { border-color: rgba(34,197,94,0.4); background: rgba(34,197,94,0.06); }

.ms-circle {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--border-hover);
  flex-shrink: 0;
}
.ms-circle.filled { background: #22c55e; border-color: #22c55e; }

.ms-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.ms-title { font-size: 12px; color: var(--text-primary); }
.ms-date  { font-size: 10px; color: var(--text-muted); }

/* ── Team members ───────────────────────────────────────────────────────────── */

.member-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-bottom: 24px;
}

.member-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  min-width: 180px;
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.member-role { font-size: 11px; color: var(--text-secondary); }
.member-expertise {
  font-size: 10px;
  color: #14b8a6;
  background: rgba(20,184,166,0.1);
  padding: 1px 6px;
  border-radius: 4px;
  align-self: flex-start;
  margin-top: 2px;
}

/* ── Right sidebar ───────────────────────────────────────────────────────────── */

.pd-sidebar {
  width: 320px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  background: var(--bg-panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-head-left {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.sidebar-graph-wrap {
  height: 300px;
  flex-shrink: 0;
  position: relative;
  border-bottom: 1px solid var(--border);
}

.sidebar-chart {
  width: 100%;
  height: 100%;
}

.graph-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 12px;
}

/* Linked nodes */
.linked-nodes {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
}

.linked-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 8px;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.1s;
}
.linked-row:hover { background: var(--bg-panel-hover); }

.linked-title {
  flex: 1;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Spinner ─────────────────────────────────────────────────────────────────── */

.spinner {
  width: 18px; height: 18px;
  border: 2px solid var(--border);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

.spinner-sm {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.15);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Header block padding ────────────────────────────────────────────────────── */

.pd-header-block {
  padding-bottom: 4px;
}
</style>

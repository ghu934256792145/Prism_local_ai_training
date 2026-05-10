<template>
  <div class="gantt-shell">

    <!-- ── Top bar ─────────────────────────────────────────────────────────── -->
    <div class="gantt-topbar">
      <div class="topbar-left">
        <router-link :to="`/projects/${projectId}`" class="back-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </router-link>
        <div class="divider-v"></div>
        <span class="project-name">{{ project?.name ?? 'Loading…' }}</span>
        <span v-if="project" class="priority-badge" :class="priorityClass(project.priority)">
          {{ project.priority }}
        </span>
      </div>

      <div class="topbar-center">
        <div class="zoom-group">
          <button
            v-for="z in ZOOM_LEVELS"
            :key="z.key"
            class="zoom-btn"
            :class="{ active: zoom === z.key }"
            @click="zoom = z.key"
          >{{ z.label }}</button>
        </div>
      </div>

      <div class="topbar-right">
        <button class="btn" :class="{ active: showToday }" @click="showToday = !showToday">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Today
        </button>
      </div>
    </div>

    <!-- ── Chart area ──────────────────────────────────────────────────────── -->
    <div class="gantt-body">
      <div v-if="isLoading" class="chart-placeholder">
        <div class="spinner"></div>
        <span>Loading Gantt…</span>
      </div>
      <VChart
        v-else
        :option="chartOption"
        autoresize
        style="width:100%;height:100%"
      />
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { CustomChart, ScatterChart, LinesChart, BarChart } from 'echarts/charts'
import {
  TooltipComponent, GridComponent, DataZoomComponent,
  MarkLineComponent, LegendComponent
} from 'echarts/components'
import VChart from 'vue-echarts'

use([
  CanvasRenderer, CustomChart, ScatterChart, LinesChart, BarChart,
  TooltipComponent, GridComponent, DataZoomComponent,
  MarkLineComponent, LegendComponent
])

// ── Types ──────────────────────────────────────────────────────────────────────

interface PmProject {
  id: string; name: string; industry: string; graph_dataset: string
  status: string; priority: string; start_date?: string; end_date?: string
  description?: string; task_count: number; done_count: number
}
interface PmTask {
  id: string; project_id: string; title: string; status: string
  assignee?: string; due_date?: string; graph_node_id?: string
  graph_dataset?: string; priority: string; notes?: string
}
interface PmMilestone {
  id: string; project_id: string; title: string; due_date?: string
  completed: boolean; graph_node_id?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ZOOM_LEVELS = [
  { key: 'week',    label: 'Week' },
  { key: 'month',   label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
] as const
type ZoomKey = 'week' | 'month' | 'quarter'

const STATUS_COLORS: Record<string, string> = {
  todo:        '#334155',
  in_progress: '#6366f1',
  blocked:     '#ef4444',
  done:        '#22c55e',
}

const API = 'http://localhost:3000'

// ── Fallback data ──────────────────────────────────────────────────────────────

const FALLBACK_PROJECT: PmProject = {
  id: 'proj-pharma', name: 'Pharma Pipeline Q2', industry: 'pharma',
  graph_dataset: 'pharma-graph', status: 'active', priority: 'high',
  start_date: '2025-01-06', end_date: '2025-06-27',
  task_count: 8, done_count: 2
}

const FALLBACK_MILESTONES: PmMilestone[] = [
  { id: 'ms-1', project_id: 'proj-pharma', title: 'Discovery Phase',  due_date: '2025-02-28', completed: true },
  { id: 'ms-2', project_id: 'proj-pharma', title: 'Clinical Trials',  due_date: '2025-04-30', completed: false },
  { id: 'ms-3', project_id: 'proj-pharma', title: 'Regulatory Filing', due_date: '2025-06-20', completed: false },
]

const FALLBACK_TASKS: PmTask[] = [
  { id: 't1', project_id: 'proj-pharma', title: 'Literature Review',     status: 'done',        priority: 'high',   due_date: '2025-02-07', graph_node_id: 'gn-001' },
  { id: 't2', project_id: 'proj-pharma', title: 'Target Identification', status: 'done',        priority: 'critical', due_date: '2025-02-21', graph_node_id: 'gn-002' },
  { id: 't3', project_id: 'proj-pharma', title: 'Protocol Design',       status: 'in_progress', priority: 'high',   due_date: '2025-03-28' },
  { id: 't4', project_id: 'proj-pharma', title: 'Patient Recruitment',   status: 'in_progress', priority: 'critical', due_date: '2025-04-11', graph_node_id: 'gn-003' },
  { id: 't5', project_id: 'proj-pharma', title: 'Data Collection',       status: 'todo',        priority: 'high',   due_date: '2025-04-25' },
  { id: 't6', project_id: 'proj-pharma', title: 'Statistical Analysis',  status: 'blocked',     priority: 'high',   due_date: '2025-05-09', graph_node_id: 'gn-004' },
  { id: 't7', project_id: 'proj-pharma', title: 'Dossier Preparation',   status: 'todo',        priority: 'medium', due_date: '2025-05-30' },
  { id: 't8', project_id: 'proj-pharma', title: 'Submission Review',     status: 'todo',        priority: 'medium', due_date: '2025-06-13' },
]

// ── State ──────────────────────────────────────────────────────────────────────

const route      = useRoute()
const projectId  = computed(() => route.params.id as string)
const project    = ref<PmProject | null>(null)
const tasks      = ref<PmTask[]>([])
const milestones = ref<PmMilestone[]>([])
const isLoading  = ref(true)
const zoom       = ref<ZoomKey>('month')
const showToday  = ref(true)

// ── Helpers ────────────────────────────────────────────────────────────────────

function priorityClass(p: string) {
  const m: Record<string, string> = {
    critical: 'prio-critical', high: 'prio-high',
    medium: 'prio-medium', low: 'prio-low'
  }
  return m[p?.toLowerCase()] ?? 'prio-low'
}

function toMs(d: string | undefined, fallback: number): number {
  if (!d) return fallback
  const t = new Date(d).getTime()
  return isNaN(t) ? fallback : t
}

function addDays(ms: number, n: number) { return ms + n * 86400000 }

// ── Build chart option ─────────────────────────────────────────────────────────

const chartOption = computed(() => {
  if (!project.value) return {}

  const proj = project.value
  const now = Date.now()
  const projStart = toMs(proj.start_date, addDays(now, -30))
  const projEnd   = toMs(proj.end_date,   addDays(now, 60))

  // Compute x-axis range based on zoom
  let xMin: number, xMax: number
  if (zoom.value === 'week') {
    xMin = addDays(now, -7)
    xMax = addDays(now, 7)
  } else if (zoom.value === 'month') {
    xMin = addDays(now, -15)
    xMax = addDays(now, 45)
  } else {
    xMin = projStart
    xMax = projEnd
  }

  // Group tasks by milestone
  type Group = { milestone: PmMilestone | null; tasks: PmTask[] }
  const groups: Group[] = []
  const msMap = new Map(milestones.value.map(m => [m.id, m]))

  // Assign tasks to milestones (use due_date proximity heuristic if no explicit link)
  const usedTaskIds = new Set<string>()

  for (const ms of milestones.value) {
    const msDate = toMs(ms.due_date, 0)
    const msTasks = tasks.value.filter(t => {
      const td = toMs(t.due_date, 0)
      return !usedTaskIds.has(t.id) && td <= msDate + 86400000 * 3
    }).sort((a, b) => toMs(a.due_date, 0) - toMs(b.due_date, 0))
    // Take tasks whose due_date falls before this milestone (but not claimed)
    const assigned = msTasks.slice(0, Math.min(msTasks.length, 3))
    assigned.forEach(t => usedTaskIds.add(t.id))
    groups.push({ milestone: ms, tasks: assigned })
  }

  // Unassigned tasks
  const unassigned = tasks.value.filter(t => !usedTaskIds.has(t.id))
  if (unassigned.length) groups.push({ milestone: null, tasks: unassigned })

  // Build y-axis categories and data
  const yCategories: string[] = []
  const barData: any[] = []
  const scatterData: any[] = []   // milestones diamonds
  const linesData: any[] = []     // dependency arrows

  // Map graph_node_id → list of {yIndex, startMs, endMs}
  const nodeMap = new Map<string, { yIndex: number; startMs: number; endMs: number }[]>()

  for (const group of groups) {
    // Milestone header row
    if (group.milestone) {
      const msLabel = `◆ ${group.milestone.title}`
      const msYIdx = yCategories.length
      yCategories.push(msLabel)
      // Milestone diamond on scatter
      if (group.milestone.due_date) {
        scatterData.push({
          value: [toMs(group.milestone.due_date, now), msYIdx],
          itemStyle: { color: group.milestone.completed ? '#22c55e' : '#f59e0b' }
        })
      }
    }

    // Task rows
    for (const task of group.tasks) {
      const yIdx = yCategories.length
      const label = (task.graph_node_id ? '⛓ ' : '') + task.title
      yCategories.push(label)

      const startMs = toMs(proj.start_date, addDays(now, -14))
      const endMs   = toMs(task.due_date, addDays(startMs, 7))
      const color   = STATUS_COLORS[task.status] ?? '#334155'

      barData.push({
        value: [startMs, endMs, yIdx, task.status],
        itemStyle: { color, opacity: 0.92 },
        emphasis: { itemStyle: { opacity: 1 } },
        name: task.title
      })

      // Collect for dependency arrows
      if (task.graph_node_id) {
        if (!nodeMap.has(task.graph_node_id)) nodeMap.set(task.graph_node_id, [])
        nodeMap.get(task.graph_node_id)!.push({ yIndex: yIdx, startMs, endMs })
      }
    }
  }

  // Build dependency lines between tasks sharing same graph_node_id
  for (const [, entries] of nodeMap) {
    if (entries.length < 2) continue
    const sorted = [...entries].sort((a, b) => a.endMs - b.endMs)
    for (let i = 0; i < sorted.length - 1; i++) {
      const from = sorted[i]
      const to   = sorted[i + 1]
      linesData.push({
        coords: [
          [from.endMs, from.yIndex],
          [to.startMs, to.yIndex]
        ]
      })
    }
  }

  // Tooltip formatter
  const tooltipFormatter = (params: any) => {
    if (params.seriesType === 'custom') {
      const [s, e, , status] = params.value
      const sd = new Date(s).toLocaleDateString()
      const ed = new Date(e).toLocaleDateString()
      return `<div style="font-size:12px;line-height:1.7">
        <strong>${params.name}</strong><br/>
        ${sd} → ${ed}<br/>
        Status: <span style="color:${STATUS_COLORS[status] ?? '#fff'}">${status}</span>
      </div>`
    }
    if (params.seriesType === 'scatter') {
      return `<div style="font-size:12px"><strong>Milestone</strong><br/>${new Date(params.value[0]).toLocaleDateString()}</div>`
    }
    return ''
  }

  // markLine for today
  const todayMark = showToday.value
    ? {
        silent: true,
        data: [{ xAxis: now, name: 'Today' }],
        lineStyle: { color: '#f59e0b', type: 'dashed', width: 1.5 },
        label: { formatter: 'Today', color: '#f59e0b', fontSize: 11, position: 'insideEndTop' }
      }
    : undefined

  const tickFormat = zoom.value === 'quarter'
    ? '{MMM} {yyyy}'
    : '{MMM} {dd}'

  const series: any[] = [
    // Custom Gantt bars
    {
      type: 'custom',
      name: 'Tasks',
      renderItem(params: any, api: any) {
        const start  = api.coord([api.value(0), api.value(2)])
        const end    = api.coord([api.value(1), api.value(2)])
        const height = api.size([0, 1])[1] * 0.55
        const width  = Math.max(end[0] - start[0], 4)
        return {
          type: 'rect',
          shape: {
            x: start[0],
            y: start[1] - height / 2,
            width,
            height,
            r: 3
          },
          style: api.style(),
          emphasis: { style: api.styleEmphasis() }
        }
      },
      encode: { x: [0, 1], y: 2 },
      data: barData,
      markLine: todayMark
    },
    // Milestone diamonds
    {
      type: 'scatter',
      name: 'Milestones',
      symbol: 'diamond',
      symbolSize: 14,
      data: scatterData,
      z: 10
    }
  ]

  // Dependency arrows
  if (linesData.length) {
    series.push({
      type: 'lines',
      name: 'Dependencies',
      coordinateSystem: 'cartesian2d',
      data: linesData,
      lineStyle: { color: '#6366f1', width: 1.5, type: 'dashed', opacity: 0.6 },
      effect: { show: true, period: 4, trailLength: 0.3, symbol: 'arrow', symbolSize: 8, color: '#818cf8' }
    })
  }

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#d0d0d0', fontSize: 12 },
      formatter: tooltipFormatter
    },
    legend: {
      top: 4,
      right: 12,
      data: ['Tasks', 'Milestones', 'Dependencies'],
      textStyle: { color: '#8e8e8e', fontSize: 11 },
      inactiveColor: '#334155'
    },
    grid: {
      top: 40,
      left: 200,
      right: 24,
      bottom: 60,
      containLabel: false
    },
    xAxis: {
      type: 'time',
      min: xMin,
      max: xMax,
      axisLine:  { lineStyle: { color: '#334155' } },
      axisTick:  { lineStyle: { color: '#334155' } },
      axisLabel: {
        color: '#8e8e8e',
        fontSize: 11,
        formatter: zoom.value === 'quarter'
          ? (val: number) => {
              const d = new Date(val)
              return `${d.toLocaleString('default', { month: 'short' })} ${d.getFullYear()}`
            }
          : (val: number) => {
              const d = new Date(val)
              return `${d.toLocaleString('default', { month: 'short' })} ${String(d.getDate()).padStart(2,'0')}`
            }
      },
      splitLine: { lineStyle: { color: '#1e293b' } }
    },
    yAxis: {
      type: 'category',
      data: yCategories,
      inverse: true,
      axisLine:  { lineStyle: { color: '#334155' } },
      axisTick:  { show: false },
      axisLabel: {
        color: (val: string) => val.startsWith('◆') ? '#f59e0b' : '#8e8e8e',
        fontSize: 11,
        width: 185,
        overflow: 'truncate',
        formatter: (val: string) => val.startsWith('◆')
          ? `{milestone|${val}}`
          : val.startsWith('⛓')
            ? `{linked|${val}}`
            : val,
        rich: {
          milestone: { color: '#f59e0b', fontWeight: '700', fontSize: 11 },
          linked:    { color: '#818cf8', fontSize: 11 }
        }
      },
      splitLine: { lineStyle: { color: '#1e293b' } }
    },
    dataZoom: [
      {
        type: 'slider',
        xAxisIndex: 0,
        bottom: 8,
        height: 18,
        borderColor: '#334155',
        backgroundColor: '#1e293b',
        fillerColor: 'rgba(99,102,241,0.12)',
        handleStyle: { color: '#6366f1' },
        textStyle: { color: '#8e8e8e', fontSize: 10 },
        startValue: xMin,
        endValue: xMax
      }
    ],
    series
  }
})

// ── Data loading ───────────────────────────────────────────────────────────────

async function loadData() {
  isLoading.value = true
  try {
    const pid = projectId.value
    const [pRes, tRes, mRes] = await Promise.all([
      fetch(`${API}/api/pm/projects/${pid}`),
      fetch(`${API}/api/pm/projects/${pid}/tasks`),
      fetch(`${API}/api/pm/projects/${pid}/milestones`)
    ])
    if (!pRes.ok || !tRes.ok || !mRes.ok) throw new Error('API error')
    const [pData, tData, mData] = await Promise.all([pRes.json(), tRes.json(), mRes.json()])
    project.value    = pData
    tasks.value      = Array.isArray(tData) ? tData : (tData.tasks ?? tData.data ?? [])
    milestones.value = Array.isArray(mData) ? mData : (mData.milestones ?? mData.data ?? [])
  } catch {
    // Fallback
    project.value    = FALLBACK_PROJECT
    tasks.value      = FALLBACK_TASKS
    milestones.value = FALLBACK_MILESTONES
  } finally {
    isLoading.value = false
  }
}

onMounted(loadData)
watch(() => route.params.id, loadData)
</script>

<style scoped>
.gantt-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0f172a;
  overflow: hidden;
}

/* ── Top bar ───────────────────────────────────────────────────────────────── */

.gantt-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid #334155;
  background: #1e293b;
  flex-shrink: 0;
  gap: 12px;
  min-height: 48px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.topbar-center {
  display: flex;
  align-items: center;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: flex-end;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-muted, #6b6b6b);
  text-decoration: none;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #334155;
  background: transparent;
  transition: all 0.15s;
  white-space: nowrap;
}
.back-link:hover {
  color: var(--text-primary, #d0d0d0);
  border-color: #475569;
  background: #1e293b;
}

.divider-v {
  width: 1px;
  height: 20px;
  background: #334155;
  flex-shrink: 0;
}

.project-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary, #d0d0d0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.priority-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}
.prio-critical { background: rgba(239,68,68,0.18);  color: #f87171; }
.prio-high     { background: rgba(249,115,22,0.18); color: #fb923c; }
.prio-medium   { background: rgba(234,179,8,0.18);  color: #facc15; }
.prio-low      { background: rgba(100,116,139,0.18);color: #94a3b8; }

/* ── Zoom buttons ──────────────────────────────────────────────────────────── */

.zoom-group {
  display: flex;
  border: 1px solid #334155;
  border-radius: 5px;
  overflow: hidden;
}

.zoom-btn {
  padding: 5px 14px;
  background: transparent;
  border: none;
  border-right: 1px solid #334155;
  color: var(--text-muted, #6b6b6b);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.12s;
}
.zoom-btn:last-child { border-right: none; }
.zoom-btn:hover { background: #1e293b; color: var(--text-primary, #d0d0d0); }
.zoom-btn.active {
  background: rgba(99,102,241,0.18);
  color: #818cf8;
  font-weight: 600;
}

/* ── Btn ──────────────────────────────────────────────────────────────────── */

.btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 4px;
  border: 1px solid #334155;
  background: transparent;
  color: var(--text-muted, #6b6b6b);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.12s;
}
.btn:hover  { border-color: #475569; color: var(--text-primary, #d0d0d0); }
.btn.active { border-color: #6366f1; color: #818cf8; background: rgba(99,102,241,0.12); }

/* ── Chart area ────────────────────────────────────────────────────────────── */

.gantt-body {
  flex: 1;
  min-height: 0;
  position: relative;
  padding: 12px;
}

.chart-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted, #6b6b6b);
  font-size: 13px;
}

.spinner {
  width: 22px;
  height: 22px;
  border: 2px solid #334155;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>

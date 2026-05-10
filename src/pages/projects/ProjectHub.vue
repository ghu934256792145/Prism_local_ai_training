<template>
  <div class="project-hub">

    <!-- ── Header ───────────────────────────────────────────────────────────── -->
    <div class="hub-header">
      <div class="hub-title-row">
        <h1 class="hub-title">Project Management</h1>
        <div class="view-switcher">
          <button
            v-for="v in VIEWS"
            :key="v.id"
            class="view-btn"
            :class="{ active: activeView === v.id }"
            @click="activeView = v.id"
          >
            <span v-html="v.icon"></span>
            {{ v.label }}
          </button>
        </div>
      </div>
      <div class="hub-controls-row">
        <div class="search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            v-model="searchQuery"
            class="search-input"
            placeholder="Search projects…"
            type="text"
          />
        </div>
        <button class="btn btn-primary" @click="openModal">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Project
        </button>
      </div>
    </div>

    <!-- ── Industry Filter Chips ────────────────────────────────────────────── -->
    <div class="filter-row">
      <button
        v-for="chip in industryChips"
        :key="chip.id"
        class="chip"
        :class="{ active: selectedIndustry === chip.id }"
        :style="selectedIndustry === chip.id
          ? { background: chip.color + '22', color: chip.color, borderColor: chip.color + '66' }
          : {}"
        @click="selectIndustry(chip.id)"
      >
        {{ chip.label }}
        <span class="chip-count">{{ chip.count }}</span>
      </button>
    </div>

    <!-- ── Loading skeleton ──────────────────────────────────────────────────── -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>Loading projects…</span>
    </div>

    <!-- ── Kanban View ───────────────────────────────────────────────────────── -->
    <div v-else-if="activeView === 'kanban'" class="kanban-board">
      <div
        v-for="col in kanbanColumns"
        :key="col.key"
        class="kanban-col"
      >
        <div class="kanban-col-header">
          <span class="col-label">{{ col.label }}</span>
          <span class="col-badge">{{ col.projects.length }}</span>
        </div>
        <div class="kanban-cards">
          <div
            v-for="proj in col.projects"
            :key="proj.id"
            class="project-card"
            @click="router.push('/projects/' + proj.id)"
          >
            <!-- Top row: priority dot + name -->
            <div class="card-top-row">
              <span class="priority-dot" :class="'prio-' + proj.priority"></span>
              <span class="card-name">{{ proj.name }}</span>
            </div>
            <!-- Industry badge -->
            <div class="card-industry-badge"
              :style="{
                background: industryColor(proj.industry) + '1a',
                color: industryColor(proj.industry),
                borderColor: industryColor(proj.industry) + '44',
              }"
            >{{ industryLabel(proj.industry) }}</div>
            <!-- Progress bar -->
            <div class="card-progress-wrap">
              <div class="progress-track">
                <div
                  class="progress-fill"
                  :style="{ width: progressPct(proj) + '%' }"
                ></div>
              </div>
              <span class="progress-text">{{ proj.done_count }}/{{ proj.task_count }} tasks</span>
            </div>
            <!-- Date + dataset row -->
            <div class="card-meta-row">
              <span v-if="proj.start_date" class="meta-chip">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                {{ formatDate(proj.start_date) }}
              </span>
              <span v-if="proj.end_date" class="meta-chip meta-chip-end">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {{ formatDate(proj.end_date) }}
              </span>
              <span v-if="proj.graph_dataset" class="meta-chip meta-chip-dataset">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
                  <line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/>
                </svg>
                {{ proj.graph_dataset }}
              </span>
            </div>
          </div>

          <div v-if="col.projects.length === 0" class="kanban-empty">
            No projects
          </div>
        </div>
      </div>
    </div>

    <!-- ── List View ─────────────────────────────────────────────────────────── -->
    <div v-else-if="activeView === 'list'" class="list-view">
      <table class="proj-table">
        <thead>
          <tr>
            <th
              v-for="col in TABLE_COLS"
              :key="col.key"
              class="th"
              :class="{ sortable: col.sortable, 'sort-active': sortKey === col.key }"
              @click="col.sortable && toggleSort(col.key)"
            >
              {{ col.label }}
              <span v-if="col.sortable" class="sort-arrow">
                {{ sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '⇅' }}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="proj in sortedFilteredProjects"
            :key="proj.id"
            class="tr"
          >
            <td class="td td-name">{{ proj.name }}</td>
            <td class="td">
              <span
                class="industry-pill"
                :style="{
                  background: industryColor(proj.industry) + '1a',
                  color: industryColor(proj.industry),
                  borderColor: industryColor(proj.industry) + '44',
                }"
              >{{ industryLabel(proj.industry) }}</span>
            </td>
            <td class="td">
              <span class="status-badge" :class="'status-' + proj.status">{{ proj.status }}</span>
            </td>
            <td class="td">
              <span class="priority-dot" :class="'prio-' + proj.priority" style="display:inline-block;margin-right:5px"></span>
              {{ proj.priority }}
            </td>
            <td class="td">
              <div class="table-progress-wrap">
                <div class="progress-track" style="width:80px">
                  <div class="progress-fill" :style="{ width: progressPct(proj) + '%' }"></div>
                </div>
                <span class="progress-text">{{ progressPct(proj) }}%</span>
              </div>
            </td>
            <td class="td">{{ proj.end_date ? formatDate(proj.end_date) : '—' }}</td>
            <td class="td">
              <button class="btn btn-sm" @click="router.push('/projects/' + proj.id)">Open</button>
            </td>
          </tr>
          <tr v-if="sortedFilteredProjects.length === 0">
            <td colspan="7" class="td empty-row">No projects match the current filters.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── Timeline View ─────────────────────────────────────────────────────── -->
    <div v-else-if="activeView === 'timeline'" class="timeline-view">
      <div class="timeline-header-row">
        <div class="tl-label-col"></div>
        <div class="tl-months-row">
          <span v-for="m in timelineMonths" :key="m" class="tl-month-label">{{ m }}</span>
        </div>
      </div>
      <div class="timeline-rows">
        <div
          v-for="proj in filteredProjects"
          :key="proj.id"
          class="tl-row"
        >
          <div class="tl-name">{{ proj.name }}</div>
          <div class="tl-track">
            <div
              v-if="proj.start_date && proj.end_date"
              class="tl-bar"
              :style="timelineBarStyle(proj)"
              :title="proj.name + ': ' + proj.start_date + ' → ' + proj.end_date"
            >
              <span class="tl-bar-label">{{ proj.name }}</span>
            </div>
            <div v-else class="tl-no-dates">No dates set</div>
          </div>
        </div>
        <div v-if="filteredProjects.length === 0" class="tl-empty">
          No projects match the current filters.
        </div>
      </div>
    </div>

    <!-- ── New Project Modal ─────────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="modalOpen" class="modal-overlay" @click.self="closeModal">
        <div class="modal-panel">
          <div class="modal-header">
            <span class="modal-title">New Project</span>
            <button class="modal-close" @click="closeModal">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Step indicators -->
          <div class="modal-steps">
            <div class="step-indicator" :class="{ active: modalStep === 1, done: modalStep > 1 }">
              <span class="step-num">1</span>
              <span class="step-label">Details</span>
            </div>
            <div class="step-divider"></div>
            <div class="step-indicator" :class="{ active: modalStep === 2 }">
              <span class="step-num">2</span>
              <span class="step-label">Industry & Dates</span>
            </div>
          </div>

          <!-- Step 1 -->
          <div v-if="modalStep === 1" class="modal-body">
            <div class="form-group">
              <label class="form-label">Project Name <span class="required">*</span></label>
              <input v-model="form.name" class="form-input" placeholder="e.g. MMP-9 Inhibitor Program" />
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea v-model="form.description" class="form-textarea" rows="3" placeholder="Brief project description…"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Priority</label>
              <select v-model="form.priority" class="form-select">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div class="modal-footer">
              <button class="btn" @click="closeModal">Cancel</button>
              <button
                class="btn btn-primary"
                :disabled="!form.name.trim()"
                @click="modalStep = 2"
              >Next →</button>
            </div>
          </div>

          <!-- Step 2 -->
          <div v-if="modalStep === 2" class="modal-body">
            <div class="form-group">
              <label class="form-label">Industry <span class="required">*</span></label>
              <div class="industry-picker-grid">
                <button
                  v-for="ind in INDUSTRIES"
                  :key="ind.id"
                  class="industry-card"
                  :class="{ selected: form.industry === ind.id }"
                  :style="form.industry === ind.id
                    ? { borderColor: ind.color, background: ind.color + '18' }
                    : {}"
                  @click="form.industry = ind.id; form.graph_dataset = ind.exampleDataset"
                >
                  <span class="ind-icon" v-html="ind.icon"></span>
                  <span class="ind-name">{{ ind.label }}</span>
                  <span class="ind-dataset">{{ ind.exampleDataset }}</span>
                </button>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:1">
                <label class="form-label">Start Date</label>
                <input v-model="form.start_date" type="date" class="form-input" />
              </div>
              <div class="form-group" style="flex:1">
                <label class="form-label">End Date</label>
                <input v-model="form.end_date" type="date" class="form-input" />
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn" @click="modalStep = 1">← Back</button>
              <button
                class="btn btn-primary"
                :disabled="!form.industry || creating"
                @click="submitProject"
              >
                <span v-if="creating" class="spinner" style="width:12px;height:12px;border-width:1.5px"></span>
                {{ creating ? 'Creating…' : 'Create Project' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useProjectMgmt, type PmProject, type Priority } from '@/composables/useProjectMgmt'

const router = useRouter()
const route  = useRoute()
const { fetchProjects, createProject } = useProjectMgmt()

// ── Static data ────────────────────────────────────────────────────────────────

const FALLBACK: PmProject[] = [
  {
    id: 'proj-pharma',
    name: 'MMP-9 Inhibitor Program',
    industry: 'drug-discovery',
    graph_dataset: 'drug-discovery',
    status: 'active',
    priority: 'critical',
    start_date: '2026-01-15',
    end_date: '2026-12-31',
    task_count: 5,
    done_count: 2,
  },
  {
    id: 'proj-eda',
    name: 'ALU-4bit Tape-out Q3',
    industry: 'semiconductor',
    graph_dataset: 'semiconductor-alu',
    status: 'active',
    priority: 'critical',
    start_date: '2026-03-01',
    end_date: '2026-07-15',
    task_count: 6,
    done_count: 1,
  },
  {
    id: 'proj-threat',
    name: 'APT29 Containment',
    industry: 'threat-intel',
    graph_dataset: 'threat-intel-apt29',
    status: 'active',
    priority: 'critical',
    start_date: '2026-05-01',
    end_date: '2026-06-30',
    task_count: 4,
    done_count: 0,
  },
]

// ── Industry definitions ───────────────────────────────────────────────────────

interface IndustryDef {
  id: string
  label: string
  color: string
  exampleDataset: string
  icon: string
}

const INDUSTRIES: IndustryDef[] = [
  {
    id: 'drug-discovery',
    label: 'Drug Discovery',
    color: '#7c3aed',
    exampleDataset: 'drug-discovery',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 2v6l-2 4h8l-2-4V2"/><line x1="8" y1="22" x2="16" y2="22"/><line x1="12" y1="12" x2="12" y2="22"/></svg>`,
  },
  {
    id: 'genomics',
    label: 'Genomics',
    color: '#059669',
    exampleDataset: 'genomics-p53',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4s2 2 2 5-2 5-2 5"/><path d="M20 4s-2 2-2 5 2 5 2 5"/><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/></svg>`,
  },
  {
    id: 'semiconductor',
    label: 'EDA',
    color: '#0284c7',
    exampleDataset: 'semiconductor-alu',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="7" width="10" height="10" rx="1"/><line x1="9" y1="7" x2="9" y2="4"/><line x1="12" y1="7" x2="12" y2="4"/><line x1="15" y1="7" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="17"/><line x1="12" y1="20" x2="12" y2="17"/><line x1="15" y1="20" x2="15" y2="17"/><line x1="7" y1="9" x2="4" y2="9"/><line x1="7" y1="12" x2="4" y2="12"/><line x1="7" y1="15" x2="4" y2="15"/><line x1="20" y1="9" x2="17" y2="9"/><line x1="20" y1="12" x2="17" y2="12"/><line x1="20" y1="15" x2="17" y2="15"/></svg>`,
  },
  {
    id: 'threat-intel',
    label: 'Threat Intel',
    color: '#dc2626',
    exampleDataset: 'threat-intel-apt29',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  },
  {
    id: 'manufacturing',
    label: 'Manufacturing',
    color: '#d97706',
    exampleDataset: 'mfg-bicycle',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 20h20"/><path d="M5 20V10l7-7 7 7v10"/><path d="M9 20v-5h6v5"/></svg>`,
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    color: '#0891b2',
    exampleDataset: 'pipeline-process',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></svg>`,
  },
  {
    id: 'scaffold',
    label: 'Scaffold',
    color: '#16a34a',
    exampleDataset: 'scaffold-ringlock',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
  },
  {
    id: 'aml',
    label: 'AML',
    color: '#9333ea',
    exampleDataset: 'aml-transactions',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  },
  {
    id: 'legal',
    label: 'Legal',
    color: '#b45309',
    exampleDataset: 'legal-cases',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><path d="M8 6l4-4 4 4"/></svg>`,
  },
  {
    id: 'network-security',
    label: 'Network Sec',
    color: '#1d4ed8',
    exampleDataset: 'network-security',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/><line x1="12" y1="3" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="21"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/></svg>`,
  },
  {
    id: 'erp',
    label: 'ERP',
    color: '#6366f1',
    exampleDataset: 'erp',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></svg>`,
  },
  {
    id: 'ai-training',
    label: 'AI Training',
    color: '#db2777',
    exampleDataset: 'ai-training',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
  },
]

const INDUSTRY_MAP = Object.fromEntries(INDUSTRIES.map(i => [i.id, i]))

function industryColor(id: string): string {
  return INDUSTRY_MAP[id]?.color ?? '#6366f1'
}

function industryLabel(id: string): string {
  return INDUSTRY_MAP[id]?.label ?? id
}

// ── Views ──────────────────────────────────────────────────────────────────────

const VIEWS = [
  {
    id: 'kanban',
    label: 'Kanban',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="4" height="15" rx="1"/></svg>`,
  },
  {
    id: 'list',
    label: 'List',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>`,
  },
  {
    id: 'timeline',
    label: 'Timeline',
    icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="12" x2="3" y2="12"/><polyline points="11 18 5 12 11 6"/><line x1="21" y1="12" x2="21" y2="12"/></svg>`,
  },
]

const TABLE_COLS = [
  { key: 'name',       label: 'Name',      sortable: true },
  { key: 'industry',   label: 'Industry',  sortable: true },
  { key: 'status',     label: 'Status',    sortable: true },
  { key: 'priority',   label: 'Priority',  sortable: true },
  { key: 'progress',   label: 'Progress',  sortable: false },
  { key: 'end_date',   label: 'Due Date',  sortable: true },
  { key: 'actions',    label: 'Actions',   sortable: false },
]

// ── State ──────────────────────────────────────────────────────────────────────

const loading          = ref(false)
const projects         = ref<PmProject[]>([])
const activeView       = ref<'kanban' | 'list' | 'timeline'>('kanban')
const selectedIndustry = ref<string>('all')
const searchQuery      = ref('')
const sortKey          = ref<string>('name')
const sortDir          = ref<'asc' | 'desc'>('asc')
const modalOpen        = ref(false)
const modalStep        = ref(1)
const creating         = ref(false)

interface ProjectForm {
  name: string
  description: string
  priority: Priority
  industry: string
  graph_dataset: string
  start_date: string
  end_date: string
}

const form = ref<ProjectForm>({
  name: '',
  description: '',
  priority: 'medium',
  industry: '',
  graph_dataset: '',
  start_date: '',
  end_date: '',
})

// ── Industry filter chips ──────────────────────────────────────────────────────

const industryChips = computed(() => {
  const all = { id: 'all', label: 'All', color: '#6366f1', count: projects.value.length }
  const chips = INDUSTRIES.map(ind => ({
    id: ind.id,
    label: ind.label,
    color: ind.color,
    count: projects.value.filter(p => p.industry === ind.id).length,
  }))
  return [all, ...chips]
})

function selectIndustry(id: string) {
  selectedIndustry.value = id
  // Sync URL query param
  router.replace({ query: id === 'all' ? {} : { industry: id } })
}

// ── Filtered / sorted projects ────────────────────────────────────────────────

const filteredProjects = computed(() => {
  let list = projects.value
  if (selectedIndustry.value !== 'all') {
    list = list.filter(p => p.industry === selectedIndustry.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.industry.toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q),
    )
  }
  return list
})

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const sortedFilteredProjects = computed(() => {
  const list = [...filteredProjects.value]
  list.sort((a, b) => {
    let av: any = (a as any)[sortKey.value] ?? ''
    let bv: any = (b as any)[sortKey.value] ?? ''
    if (sortKey.value === 'priority') {
      av = PRIORITY_ORDER[av] ?? 99
      bv = PRIORITY_ORDER[bv] ?? 99
    }
    if (av < bv) return sortDir.value === 'asc' ? -1 : 1
    if (av > bv) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
  return list
})

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

// ── Kanban columns ─────────────────────────────────────────────────────────────

const kanbanColumns = computed(() => [
  {
    key: 'active',
    label: 'Active',
    projects: filteredProjects.value.filter(p => p.status === 'active'),
  },
  {
    key: 'paused',
    label: 'Paused',
    projects: filteredProjects.value.filter(p => p.status === 'paused'),
  },
  {
    key: 'done',
    label: 'Done',
    projects: filteredProjects.value.filter(p => p.status === 'done'),
  },
  {
    key: 'backlog',
    label: 'Backlog',
    // projects not yet started (no start_date or future start_date beyond today, status active)
    projects: [] as PmProject[],
  },
])

// ── Timeline helpers ───────────────────────────────────────────────────────────

const TIMELINE_MONTHS = 12

const timelineStart = computed(() => {
  const d = new Date()
  d.setDate(1)
  return d
})

const timelineEnd = computed(() => {
  const d = new Date(timelineStart.value)
  d.setMonth(d.getMonth() + TIMELINE_MONTHS)
  return d
})

const timelineMonths = computed(() => {
  const months: string[] = []
  const d = new Date(timelineStart.value)
  for (let i = 0; i < TIMELINE_MONTHS; i++) {
    months.push(d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }))
    d.setMonth(d.getMonth() + 1)
  }
  return months
})

function timelineBarStyle(proj: PmProject) {
  if (!proj.start_date || !proj.end_date) return {}
  const rangeMs  = timelineEnd.value.getTime() - timelineStart.value.getTime()
  const startMs  = new Date(proj.start_date).getTime() - timelineStart.value.getTime()
  const endMs    = new Date(proj.end_date).getTime() - timelineStart.value.getTime()
  const left     = Math.max(0, (startMs / rangeMs) * 100)
  const right    = Math.min(100, (endMs / rangeMs) * 100)
  const width    = Math.max(1, right - left)
  const color    = industryColor(proj.industry)
  return {
    left: left + '%',
    width: width + '%',
    background: color,
    opacity: '0.85',
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function progressPct(proj: PmProject): number {
  if (!proj.task_count) return 0
  return Math.round((proj.done_count / proj.task_count) * 100)
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

// ── Modal ──────────────────────────────────────────────────────────────────────

function openModal() {
  form.value = {
    name: '',
    description: '',
    priority: 'medium',
    industry: '',
    graph_dataset: '',
    start_date: '',
    end_date: '',
  }
  modalStep.value = 1
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
}

async function submitProject() {
  if (!form.value.name.trim() || !form.value.industry) return
  creating.value = true
  try {
    const newProj = await createProject({
      name:          form.value.name.trim(),
      description:   form.value.description || undefined,
      priority:      form.value.priority,
      industry:      form.value.industry,
      graph_dataset: form.value.graph_dataset,
      start_date:    form.value.start_date || undefined,
      end_date:      form.value.end_date || undefined,
      status:        'active',
      task_count:    0,
      done_count:    0,
    })
    if (newProj) {
      projects.value.unshift(newProj)
      closeModal()
      router.push('/projects/' + newProj.id)
    }
  } finally {
    creating.value = false
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

onMounted(async () => {
  // Pre-select industry from URL query param
  const queryIndustry = route.query.industry as string | undefined
  if (queryIndustry) selectedIndustry.value = queryIndustry

  loading.value = true
  try {
    const data = await fetchProjects(queryIndustry)
    projects.value = data.length ? data : FALLBACK
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
/* ── Base ───────────────────────────────────────────────────────────────────── */

.project-hub {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  gap: 10px;
  background: #0f172a;
  padding: 16px;
  box-sizing: border-box;
}

/* ── Header ─────────────────────────────────────────────────────────────────── */

.hub-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}

.hub-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hub-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
  letter-spacing: -0.02em;
}

.hub-controls-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ── View switcher ──────────────────────────────────────────────────────────── */

.view-switcher {
  display: flex;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  overflow: hidden;
}

.view-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.view-btn.active {
  background: #334155;
  color: #f1f5f9;
}

.view-btn:hover:not(.active) {
  background: #263045;
  color: #cbd5e1;
}

/* ── Search ─────────────────────────────────────────────────────────────────── */

.search-wrap {
  position: relative;
  flex: 1;
  max-width: 320px;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #475569;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 7px 10px 7px 32px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 7px;
  color: #f1f5f9;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s;
}

.search-input::placeholder {
  color: #475569;
}

.search-input:focus {
  border-color: #6366f1;
}

/* ── Buttons ────────────────────────────────────────────────────────────────── */

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 7px;
  color: #cbd5e1;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  white-space: nowrap;
}

.btn:hover:not(:disabled) {
  background: #263045;
  border-color: #475569;
  color: #f1f5f9;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-primary {
  background: #4f46e5;
  border-color: #6366f1;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #4338ca;
  border-color: #4f46e5;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 11px;
}

/* ── Filter chips ───────────────────────────────────────────────────────────── */

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 20px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.chip:hover:not(.active) {
  background: #263045;
  color: #cbd5e1;
}

.chip-count {
  font-size: 10px;
  background: rgba(255,255,255,0.08);
  padding: 0 5px;
  border-radius: 8px;
  font-weight: 600;
}

/* ── Loading ────────────────────────────────────────────────────────────────── */

.loading-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 40px 24px;
  color: #64748b;
  font-size: 13px;
  justify-content: center;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #334155;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Kanban ─────────────────────────────────────────────────────────────────── */

.kanban-board {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  overflow: hidden;
}

.kanban-col {
  display: flex;
  flex-direction: column;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  overflow: hidden;
}

.kanban-col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}

.col-label {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.col-badge {
  background: rgba(99, 102, 241, 0.15);
  color: #6366f1;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 10px;
}

.kanban-cards {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.kanban-empty {
  text-align: center;
  color: #475569;
  font-size: 12px;
  padding: 24px 0;
}

/* ── Project Card ───────────────────────────────────────────────────────────── */

.project-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.12s;
}

.project-card:hover {
  border-color: #6366f1;
  box-shadow: 0 4px 16px rgba(99,102,241,0.18);
  transform: translateY(-2px);
}

.card-top-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.prio-critical { background: #ef4444; }
.prio-high     { background: #f59e0b; }
.prio-medium   { background: #3b82f6; }
.prio-low      { background: #64748b; }

.card-name {
  font-size: 13px;
  font-weight: 600;
  color: #f1f5f9;
  line-height: 1.3;
}

.card-industry-badge {
  display: inline-flex;
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid;
  font-size: 10px;
  font-weight: 600;
}

.card-progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-track {
  height: 5px;
  background: #334155;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #6366f1;
  border-radius: 3px;
  transition: width 0.3s;
}

.progress-text {
  font-size: 10px;
  color: #64748b;
}

.card-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: #64748b;
  background: #1e293b;
  border: 1px solid #334155;
  padding: 2px 6px;
  border-radius: 6px;
}

.meta-chip-end {
  color: #94a3b8;
}

.meta-chip-dataset {
  color: #818cf8;
  border-color: #6366f155;
  background: #6366f110;
}

/* ── List view ──────────────────────────────────────────────────────────────── */

.list-view {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
}

.proj-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.th {
  padding: 10px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #334155;
  white-space: nowrap;
  user-select: none;
}

.th.sortable {
  cursor: pointer;
}

.th.sortable:hover {
  color: #94a3b8;
}

.th.sort-active {
  color: #6366f1;
}

.sort-arrow {
  margin-left: 4px;
  font-size: 10px;
}

.tr {
  transition: background 0.1s;
}

.tr:hover {
  background: #263045;
}

.tr:not(:last-child) .td {
  border-bottom: 1px solid #1e293b;
}

.td {
  padding: 10px 14px;
  color: #cbd5e1;
  vertical-align: middle;
}

.td-name {
  font-weight: 600;
  color: #f1f5f9;
}

.empty-row {
  text-align: center;
  color: #475569;
  padding: 32px;
}

.industry-pill {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid;
  font-size: 10px;
  font-weight: 600;
}

.status-badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
  text-transform: capitalize;
}

.status-active { background: rgba(5,150,105,0.15); color: #10b981; }
.status-paused { background: rgba(245,158,11,0.15); color: #f59e0b; }
.status-done   { background: rgba(99,102,241,0.15); color: #818cf8; }

.table-progress-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Timeline view ──────────────────────────────────────────────────────────── */

.timeline-view {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timeline-header-row {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  flex-shrink: 0;
}

.tl-label-col {
  width: 140px;
  flex-shrink: 0;
}

.tl-months-row {
  flex: 1;
  display: flex;
}

.tl-month-label {
  flex: 1;
  font-size: 10px;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: left;
  padding-left: 2px;
}

.timeline-rows {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tl-row {
  display: flex;
  align-items: center;
  min-height: 30px;
}

.tl-name {
  width: 140px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 8px;
}

.tl-track {
  flex: 1;
  position: relative;
  height: 24px;
  background: #0f172a;
  border-radius: 4px;
}

.tl-bar {
  position: absolute;
  top: 3px;
  height: 18px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0 6px;
  overflow: hidden;
  cursor: default;
  min-width: 4px;
}

.tl-bar-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tl-no-dates {
  font-size: 11px;
  color: #334155;
  display: flex;
  align-items: center;
  height: 100%;
  padding-left: 8px;
}

.tl-empty {
  text-align: center;
  color: #475569;
  font-size: 13px;
  padding: 32px;
}

/* ── Modal ──────────────────────────────────────────────────────────────────── */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-panel {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  width: 560px;
  max-width: 95vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 48px rgba(0,0,0,0.6);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}

.modal-title {
  font-size: 16px;
  font-weight: 700;
  color: #f1f5f9;
}

.modal-close {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
}

.modal-close:hover {
  background: #334155;
  color: #f1f5f9;
}

/* ── Step indicators ────────────────────────────────────────────────────────── */

.modal-steps {
  display: flex;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #334155;
  gap: 10px;
  flex-shrink: 0;
}

.step-indicator {
  display: flex;
  align-items: center;
  gap: 7px;
  opacity: 0.45;
}

.step-indicator.active {
  opacity: 1;
}

.step-indicator.done {
  opacity: 0.7;
}

.step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #334155;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.step-indicator.active .step-num {
  background: #4f46e5;
  color: #fff;
}

.step-indicator.done .step-num {
  background: #059669;
  color: #fff;
}

.step-label {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
}

.step-indicator.active .step-label {
  color: #f1f5f9;
}

.step-divider {
  flex: 1;
  height: 1px;
  background: #334155;
}

/* ── Modal body / form ──────────────────────────────────────────────────────── */

.modal-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.required {
  color: #ef4444;
}

.form-input,
.form-textarea,
.form-select {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 7px;
  color: #f1f5f9;
  font-size: 13px;
  padding: 8px 11px;
  outline: none;
  transition: border-color 0.15s;
  font-family: inherit;
}

.form-input:focus,
.form-textarea:focus,
.form-select:focus {
  border-color: #6366f1;
}

.form-textarea {
  resize: vertical;
  min-height: 70px;
}

.form-select option {
  background: #1e293b;
}

/* ── Industry picker grid ───────────────────────────────────────────────────── */

.industry-picker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.industry-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}

.industry-card:hover:not(.selected) {
  border-color: #475569;
  background: #1a2640;
}

.ind-icon {
  color: #64748b;
}

.industry-card.selected .ind-icon {
  color: inherit;
}

.ind-name {
  font-size: 12px;
  font-weight: 600;
  color: #cbd5e1;
}

.ind-dataset {
  font-size: 10px;
  color: #475569;
  font-family: monospace;
}

/* ── Modal footer ───────────────────────────────────────────────────────────── */

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #334155;
  margin-top: auto;
  flex-shrink: 0;
}
</style>

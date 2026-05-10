<template>
  <div class="orders-page">
    <!-- Toolbar -->
    <div class="toolbar">
      <span class="page-title">Planned Orders</span>
      <div class="toolbar-right">
        <div class="view-toggle">
          <button
            class="toggle-btn"
            :class="{ active: view === 'table' }"
            @click="view = 'table'"
          >Table</button>
          <button
            class="toggle-btn"
            :class="{ active: view === 'timeline' }"
            @click="view = 'timeline'; nextTick(initGantt)"
          >Timeline</button>
        </div>
        <button
          class="btn-release"
          :disabled="selectedIds.size === 0 || releasing"
          @click="releaseSelected"
        >
          <span v-if="releasing" class="spinner-sm"></span>
          Release Selected ({{ selectedIds.size }})
        </button>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="filter-chips">
        <span
          v-for="s in statusFilters"
          :key="s"
          class="filter-chip"
          :class="{ active: statusFilter === s }"
          @click="statusFilter = s"
        >{{ s }}</span>
      </div>
      <div class="filter-chips">
        <span
          v-for="t in typeFilters"
          :key="t"
          class="filter-chip"
          :class="{ active: typeFilter === t }"
          @click="typeFilter = t"
        >{{ t }}</span>
      </div>
      <select v-model="ccFilter" class="filter-select">
        <option value="">All Cost Centers</option>
        <option v-for="cc in costCenters" :key="cc.id" :value="cc.id">
          {{ cc.code }} – {{ cc.name }}
        </option>
      </select>
      <input
        v-model="searchQ"
        class="filter-search"
        type="text"
        placeholder="Search material…"
      />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-area">
      <span class="spinner"></span>
      <span class="loading-txt">Loading orders…</span>
    </div>

    <template v-else>
      <!-- Table View -->
      <div v-if="view === 'table'" class="table-area">
        <table class="orders-table">
          <thead>
            <tr>
              <th class="th-cb">
                <input
                  type="checkbox"
                  :checked="allSelected"
                  :indeterminate="someSelected && !allSelected"
                  @change="toggleAll"
                  class="cb"
                />
              </th>
              <th>Material</th>
              <th>Type</th>
              <th>Qty</th>
              <th class="th-sort" @click="toggleSort('planned_date')">
                Planned Date <span class="sort-icon">{{ sortIcon('planned_date') }}</span>
              </th>
              <th class="th-sort" @click="toggleSort('due_date')">
                Due Date <span class="sort-icon">{{ sortIcon('due_date') }}</span>
              </th>
              <th>CC</th>
              <th class="th-num">Unit Cost</th>
              <th class="th-num">Total Cost</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="o in filteredSorted" :key="o.id">
              <tr
                class="order-row"
                :class="{ expanded: expandedRow === o.id }"
                @click="expandedRow = expandedRow === o.id ? null : o.id"
              >
                <td class="td-cb" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selectedIds.has(o.id)"
                    @change="toggleSelect(o.id)"
                    class="cb"
                  />
                </td>
                <td class="td-mat">
                  <span class="mat-desc">{{ getMaterialDesc(o.material_id) }}</span>
                  <span class="mat-id">{{ o.material_id.slice(0, 8) }}</span>
                </td>
                <td>
                  <span class="type-badge" :class="typeClass(o.order_type)">{{ o.order_type }}</span>
                </td>
                <td class="td-mono">{{ o.qty.toLocaleString() }} <span class="uom">{{ getMaterialUom(o.material_id) }}</span></td>
                <td class="td-mono">{{ fmtDate(o.planned_date) }}</td>
                <td class="td-mono">{{ fmtDate(o.due_date) }}</td>
                <td>
                  <span class="cc-chip">{{ getCCCode(o.cost_center_id) }}</span>
                </td>
                <td class="td-num">${{ fmtCost(o.unit_cost) }}</td>
                <td class="td-num">${{ fmtCost(o.total_cost) }}</td>
                <td>
                  <span class="status-chip" :class="statusClass(o.status)">{{ o.status }}</span>
                </td>
                <td class="td-actions" @click.stop>
                  <button
                    v-if="o.status === 'planned'"
                    class="btn-rel"
                    :disabled="releasingId === o.id"
                    @click="releaseSingle(o.id)"
                  >
                    <span v-if="releasingId === o.id" class="spinner-xs"></span>
                    {{ releasingId === o.id ? '…' : 'Release' }}
                  </button>
                </td>
              </tr>
              <!-- Expanded detail row -->
              <tr v-if="expandedRow === o.id" class="detail-row">
                <td colspan="11" class="detail-cell">
                  <div class="detail-content">
                    <span class="detail-label">Demand Ref:</span>
                    <span class="detail-val">{{ o.demand_ref ?? '—' }}</span>
                    <span class="detail-label">Order ID:</span>
                    <span class="detail-val mono">{{ o.id }}</span>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="filteredSorted.length === 0">
              <td colspan="11" class="empty-row">No orders match the current filters</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Timeline View -->
      <div v-if="view === 'timeline'" class="timeline-area">
        <div ref="ganttEl" class="gantt-chart"></div>
      </div>
    </template>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-label">Total Orders</span>
        <span class="stat-value">{{ stats.total }}</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-item">
        <span class="stat-label">Total Cost</span>
        <span class="stat-value accent">{{ stats.totalCostFmt }}</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-item">
        <span class="stat-label">Purchase Orders</span>
        <span class="stat-value">{{ stats.purchaseCount }}</span>
      </div>
      <div class="stat-sep"></div>
      <div class="stat-item">
        <span class="stat-label">Work Orders</span>
        <span class="stat-value">{{ stats.workOrderCount }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { useMRP } from '@/composables/useMRP'
import type { MrpPlannedOrder, MrpCostCenter, MrpMaterial } from '@/composables/useMRP'

const { getPlannedOrders, getCostCenters, getMaterials, releaseOrder } = useMRP()

const loading = ref(true)
const view = ref<'table' | 'timeline'>('table')
const orders = ref<MrpPlannedOrder[]>([])
const costCenters = ref<MrpCostCenter[]>([])
const materials = ref<MrpMaterial[]>([])

const selectedIds = ref(new Set<string>())
const expandedRow = ref<string | null>(null)
const releasing = ref(false)
const releasingId = ref<string | null>(null)

const statusFilters = ['All', 'Planned', 'Released', 'Firm']
const typeFilters = ['All', 'Purchase', 'Work Order']
const statusFilter = ref('All')
const typeFilter = ref('All')
const ccFilter = ref('')
const searchQ = ref('')
const sortKey = ref<'planned_date' | 'due_date'>('due_date')
const sortDir = ref<'asc' | 'desc'>('asc')

const ganttEl = ref<HTMLElement | null>(null)
let gantt: echarts.ECharts | null = null

// ── Filtering & sorting ───────────────────────────────────────────────────────

const filteredSorted = computed(() => {
  let list = orders.value.slice()

  if (statusFilter.value !== 'All') {
    const s = statusFilter.value.toLowerCase().replace(' ', '_')
    list = list.filter(o => o.status === s)
  }
  if (typeFilter.value !== 'All') {
    const t = typeFilter.value === 'Work Order' ? 'work_order' : 'purchase'
    list = list.filter(o => o.order_type === t)
  }
  if (ccFilter.value) {
    list = list.filter(o => o.cost_center_id === ccFilter.value)
  }
  if (searchQ.value.trim()) {
    const q = searchQ.value.toLowerCase()
    list = list.filter(o => getMaterialDesc(o.material_id).toLowerCase().includes(q))
  }

  list.sort((a, b) => {
    const av = sortKey.value === 'due_date' ? a.due_date : a.planned_date
    const bv = sortKey.value === 'due_date' ? b.due_date : b.planned_date
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return sortDir.value === 'asc' ? cmp : -cmp
  })

  return list
})

// ── Stats ─────────────────────────────────────────────────────────────────────

const stats = computed(() => {
  const list = orders.value
  const total = list.length
  const totalCost = list.reduce((s, o) => s + o.total_cost, 0)
  const totalCostFmt = `$${(totalCost / 1_000_000).toFixed(2)}M`
  const purchaseCount = list.filter(o => o.order_type === 'purchase').length
  const workOrderCount = list.filter(o => o.order_type === 'work_order').length
  return { total, totalCostFmt, purchaseCount, workOrderCount }
})

// ── Selection ─────────────────────────────────────────────────────────────────

const allSelected = computed(() =>
  filteredSorted.value.length > 0 &&
  filteredSorted.value.every(o => selectedIds.value.has(o.id))
)
const someSelected = computed(() => filteredSorted.value.some(o => selectedIds.value.has(o.id)))

function toggleAll(e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  if (checked) filteredSorted.value.forEach(o => selectedIds.value.add(o.id))
  else selectedIds.value.clear()
}

function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
}

// ── Sorting ───────────────────────────────────────────────────────────────────

function toggleSort(key: 'planned_date' | 'due_date') {
  if (sortKey.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = key; sortDir.value = 'asc' }
}

function sortIcon(key: string) {
  if (sortKey.value !== key) return '↕'
  return sortDir.value === 'asc' ? '↑' : '↓'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMaterialDesc(mid: string) {
  return materials.value.find(m => m.id === mid)?.description ?? mid
}

function getMaterialUom(mid: string) {
  return materials.value.find(m => m.id === mid)?.uom ?? ''
}

function getCCCode(id: string | null) {
  if (!id) return '—'
  return costCenters.value.find(c => c.id === id)?.code ?? id.slice(0, 6)
}

function fmtDate(d: string) {
  return d ? d.slice(0, 10) : '—'
}

function fmtCost(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function typeClass(t: string) {
  return t === 'purchase' ? 'type-blue' : t === 'work_order' ? 'type-orange' : 'type-slate'
}

function statusClass(s: string) {
  if (s === 'released') return 'status-green'
  if (s === 'firm') return 'status-amber'
  return 'status-indigo'
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function releaseSingle(id: string) {
  releasingId.value = id
  const ok = await releaseOrder(id)
  releasingId.value = null
  if (ok) {
    orders.value = await getPlannedOrders()
    if (view.value === 'timeline') nextTick(initGantt)
  }
}

async function releaseSelected() {
  if (selectedIds.value.size === 0) return
  releasing.value = true
  await Promise.all([...selectedIds.value].map(id => releaseOrder(id)))
  selectedIds.value.clear()
  releasing.value = false
  orders.value = await getPlannedOrders()
  if (view.value === 'timeline') nextTick(initGantt)
}

// ── Gantt Chart ───────────────────────────────────────────────────────────────

function initGantt() {
  if (!ganttEl.value) return
  if (gantt) gantt.dispose()
  gantt = echarts.init(ganttEl.value, 'dark')

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const list = filteredSorted.value.slice(0, 50)
  if (list.length === 0) return

  const maxDue = list.reduce((m, o) => o.due_date > m ? o.due_date : m, list[0].due_date)
  const endDate = new Date(maxDue)
  endDate.setDate(endDate.getDate() + 7)

  const yCategories = list.map((o, i) => `${getMaterialDesc(o.material_id).slice(0, 22)} #${i + 1}`)

  const statusColorMap: Record<string, string> = {
    planned: '#6366f1',
    released: '#22c55e',
    firm: '#f59e0b',
  }

  const seriesData = list.map((o, i) => ({
    name: o.id,
    value: [
      i,
      new Date(o.planned_date).getTime(),
      new Date(o.due_date).getTime(),
      o.status,
    ],
    itemStyle: { color: statusColorMap[o.status] ?? '#6366f1', borderRadius: 3 },
  }))

  gantt.setOption({
    backgroundColor: 'transparent',
    tooltip: {
      formatter: (params: any) => {
        const o = list[params.value[0]]
        return `<div style="font-size:12px">
          <b>${getMaterialDesc(o.material_id)}</b><br/>
          Type: ${o.order_type}<br/>
          Qty: ${o.qty.toLocaleString()}<br/>
          Planned: ${fmtDate(o.planned_date)}<br/>
          Due: ${fmtDate(o.due_date)}<br/>
          Status: ${o.status}
        </div>`
      },
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0' },
    },
    grid: { left: 200, right: 20, top: 8, bottom: 60, containLabel: false },
    xAxis: {
      type: 'time',
      min: today.getTime(),
      max: endDate.getTime(),
      axisLabel: { color: '#94a6b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#334155' } },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'category',
      data: yCategories,
      axisLabel: { color: '#e2e8f0', fontSize: 10, width: 180, overflow: 'truncate' },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    dataZoom: [
      { type: 'slider', xAxisIndex: 0, bottom: 8, height: 20, borderColor: '#334155', fillerColor: 'rgba(99,102,241,0.2)' }
    ],
    series: [
      {
        type: 'custom',
        renderItem: (_: any, api: any) => {
          const categoryIndex = api.value(0)
          const start = api.coord([api.value(1), categoryIndex])
          const end = api.coord([api.value(2), categoryIndex])
          const height = api.size([0, 1])[1] * 0.6
          const rectShape = echarts.graphic.clipRectByRect(
            { x: start[0], y: start[1] - height / 2, width: end[0] - start[0], height },
            { x: (api as any).getWidth ? 0 : api.coord([0, 0])[0], y: 0, width: 10000, height: 10000 }
          )
          return rectShape ? { type: 'rect', shape: rectShape, style: api.style() } : undefined
        },
        encode: { x: [1, 2], y: 0 },
        data: seriesData,
      },
      {
        type: 'line',
        markLine: {
          silent: true,
          symbol: 'none',
          data: [{ xAxis: today.getTime() }],
          lineStyle: { color: '#ef4444', type: 'dashed', width: 1 },
          label: { formatter: 'Today', color: '#ef4444', fontSize: 10 },
        },
        data: [],
      },
    ],
  })
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  const [po, cc, mat] = await Promise.all([getPlannedOrders(), getCostCenters(), getMaterials()])
  orders.value = po
  costCenters.value = cc
  materials.value = mat
  loading.value = false
})

watch(view, v => {
  if (v === 'timeline') nextTick(initGantt)
})
</script>

<style scoped>
.orders-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
  font-family: system-ui, sans-serif;
  overflow: hidden;
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  height: 48px;
  min-height: 48px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}
.page-title { font-size: 15px; font-weight: 700; color: #e2e8f0; }
.toolbar-right { display: flex; align-items: center; gap: 12px; }

.view-toggle {
  display: flex;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  overflow: hidden;
}
.toggle-btn {
  padding: 5px 14px;
  background: none;
  border: none;
  color: #94a6b8;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.toggle-btn.active { background: #6366f1; color: #fff; }

.btn-release {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: #22c55e;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-release:hover:not(:disabled) { background: #16a34a; }
.btn-release:disabled { opacity: 0.5; cursor: not-allowed; }

/* Filter Bar */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 18px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.filter-chips { display: flex; gap: 6px; }
.filter-chip {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  background: rgba(51,65,85,0.5);
  color: #94a6b8;
  border: 1px solid transparent;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  user-select: none;
}
.filter-chip.active { background: rgba(99,102,241,0.2); color: #818cf8; border-color: rgba(99,102,241,0.4); }
.filter-chip:hover:not(.active) { background: rgba(51,65,85,0.8); color: #e2e8f0; }

.filter-select, .filter-search {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #e2e8f0;
  padding: 5px 10px;
  font-size: 12px;
}
.filter-select:focus, .filter-search:focus { outline: none; border-color: #6366f1; }
.filter-search { min-width: 180px; }
.filter-search::placeholder { color: #94a6b8; }

/* Loading */
.loading-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #94a6b8;
}
.loading-txt { font-size: 14px; }

/* Table area */
.table-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
}
.table-area::-webkit-scrollbar { width: 6px; height: 6px; }
.table-area::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }

.orders-table { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 900px; }
.orders-table thead th {
  padding: 8px 12px;
  color: #94a6b8;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: left;
  border-bottom: 1px solid #334155;
  position: sticky;
  top: 0;
  background: #1e293b;
  white-space: nowrap;
  z-index: 1;
}
.th-num { text-align: right; }
.th-cb { width: 36px; }
.th-sort { cursor: pointer; user-select: none; }
.th-sort:hover { color: #e2e8f0; }
.sort-icon { font-size: 10px; margin-left: 2px; }

.order-row {
  border-bottom: 1px solid rgba(51,65,85,0.4);
  cursor: pointer;
  transition: background 0.1s;
}
.order-row:hover { background: rgba(99,102,241,0.07); }
.order-row.expanded { background: rgba(99,102,241,0.1); }

.orders-table td { padding: 8px 12px; color: #e2e8f0; vertical-align: middle; }
.td-cb { width: 36px; }
.td-mat { display: flex; flex-direction: column; gap: 2px; }
.mat-desc { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
.mat-id { font-size: 10px; color: #94a6b8; font-family: monospace; }
.td-mono { font-variant-numeric: tabular-nums; white-space: nowrap; }
.td-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.td-actions { white-space: nowrap; }
.uom { font-size: 10px; color: #94a6b8; }

/* Detail row */
.detail-row { background: rgba(15,23,42,0.8); }
.detail-cell { padding: 0 !important; }
.detail-content {
  padding: 10px 52px;
  display: flex;
  gap: 16px;
  align-items: center;
  font-size: 12px;
  border-bottom: 1px solid #334155;
}
.detail-label { color: #94a6b8; font-weight: 600; }
.detail-val { color: #e2e8f0; margin-right: 8px; }
.detail-val.mono { font-family: monospace; }

.cb { accent-color: #6366f1; cursor: pointer; }

.type-badge {
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}
.type-blue { background: rgba(59,130,246,0.2); color: #60a5fa; }
.type-orange { background: rgba(245,158,11,0.2); color: #f59e0b; }
.type-slate { background: rgba(100,116,139,0.2); color: #94a3b8; }

.cc-chip {
  font-family: monospace;
  font-weight: 700;
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(99,102,241,0.12);
  color: #818cf8;
  border-radius: 4px;
}

.status-chip {
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}
.status-green { background: rgba(34,197,94,0.15); color: #22c55e; }
.status-amber { background: rgba(245,158,11,0.15); color: #f59e0b; }
.status-indigo { background: rgba(99,102,241,0.15); color: #818cf8; }

.btn-rel {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  background: rgba(34,197,94,0.12);
  border: 1px solid rgba(34,197,94,0.3);
  border-radius: 4px;
  color: #22c55e;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-rel:hover:not(:disabled) { background: rgba(34,197,94,0.25); }
.btn-rel:disabled { opacity: 0.5; cursor: not-allowed; }

.empty-row { padding: 24px; text-align: center; color: #94a6b8; font-size: 13px; }

/* Timeline */
.timeline-area {
  flex: 1;
  overflow: hidden;
  padding: 8px;
}
.gantt-chart { width: 100%; height: 100%; }

/* Stats bar */
.stats-bar {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  background: #1e293b;
  border-top: 1px solid #334155;
  flex-shrink: 0;
  gap: 0;
}
.stat-item { display: flex; flex-direction: column; gap: 2px; padding: 0 20px; }
.stat-label { font-size: 10px; color: #94a6b8; text-transform: uppercase; letter-spacing: 0.05em; }
.stat-value { font-size: 16px; font-weight: 700; color: #e2e8f0; font-variant-numeric: tabular-nums; }
.stat-value.accent { color: #6366f1; }
.stat-sep { width: 1px; height: 28px; background: #334155; }

/* Spinners */
.spinner {
  width: 28px; height: 28px;
  border: 3px solid #334155;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}
.spinner-sm {
  width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
.spinner-xs {
  width: 10px; height: 10px;
  border: 2px solid rgba(34,197,94,0.3);
  border-top-color: #22c55e;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>

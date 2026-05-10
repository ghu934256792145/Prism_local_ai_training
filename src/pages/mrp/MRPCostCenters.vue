<template>
  <div class="cc-page">
    <!-- Header -->
    <div class="cc-header">
      <div class="header-left">
        <span class="page-title">Cost Centers</span>
        <span class="budget-year">Budget Year 2026</span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-overlay">
      <span class="spinner"></span>
      <span>Loading cost centers…</span>
    </div>

    <div v-else class="cc-body">
      <!-- Table -->
      <div class="table-wrap">
        <table class="cc-table">
          <thead>
            <tr>
              <th class="th-code">Code</th>
              <th>Name</th>
              <th>Department</th>
              <th class="th-num">Budget</th>
              <th class="th-num">Planned</th>
              <th class="th-util">Utilization</th>
              <th class="th-num">Orders</th>
              <th class="th-expand"></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="cc in enrichedCenters" :key="cc.id">
              <tr
                class="cc-row"
                :class="rowTint(cc.utilization_pct)"
                @click="toggleExpand(cc.id)"
              >
                <td>
                  <span class="code-chip">{{ cc.code }}</span>
                </td>
                <td class="td-name">{{ cc.name }}</td>
                <td class="td-muted">{{ cc.department_id ?? '—' }}</td>
                <td class="td-num">${{ fmtK(cc.budget_kusd) }}k</td>
                <td class="td-num">${{ fmtK(cc.planned_cost_kusd) }}k</td>
                <td class="td-util">
                  <div class="util-row">
                    <div class="util-track">
                      <div
                        class="util-fill"
                        :style="{
                          width: Math.min(cc.utilization_pct, 100) + '%',
                          background: utilColor(cc.utilization_pct)
                        }"
                      ></div>
                    </div>
                    <span class="util-pct" :style="{ color: utilColor(cc.utilization_pct) }">
                      {{ cc.utilization_pct.toFixed(1) }}%
                    </span>
                  </div>
                </td>
                <td class="td-num">{{ cc.orderCount }}</td>
                <td class="td-expand">
                  <span class="expand-arrow" :class="{ rotated: expandedIds.has(cc.id) }">▶</span>
                </td>
              </tr>
              <!-- Expanded sub-table -->
              <tr v-if="expandedIds.has(cc.id)" class="sub-row">
                <td colspan="8" class="sub-cell">
                  <div class="sub-table-wrap">
                    <table class="sub-table" v-if="cc.orders.length">
                      <thead>
                        <tr>
                          <th>Material</th>
                          <th>Type</th>
                          <th>Qty</th>
                          <th>Due Date</th>
                          <th>Total Cost</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="o in cc.orders" :key="o.id">
                          <td>{{ getMaterialDesc(o.material_id) }}</td>
                          <td>
                            <span class="type-badge" :class="typeClass(o.order_type)">{{ o.order_type }}</span>
                          </td>
                          <td class="td-mono">{{ o.qty.toLocaleString() }}</td>
                          <td class="td-mono">{{ o.due_date.slice(0, 10) }}</td>
                          <td class="td-mono">${{ fmtCost(o.total_cost) }}</td>
                          <td>
                            <span class="status-chip" :class="statusClass(o.status)">{{ o.status }}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    <div v-else class="sub-empty">No planned orders for this cost center</div>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="enrichedCenters.length === 0">
              <td colspan="8" class="empty-row">No cost centers found</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Summary Footer -->
      <div class="summary-footer">
        <div class="summary-item">
          <span class="summary-label">Total Budget</span>
          <span class="summary-value">${{ fmtK(totals.budget) }}k</span>
        </div>
        <div class="summary-sep"></div>
        <div class="summary-item">
          <span class="summary-label">Total Planned</span>
          <span class="summary-value">${{ fmtK(totals.planned) }}k</span>
        </div>
        <div class="summary-sep"></div>
        <div class="summary-item">
          <span class="summary-label">Overall Utilization</span>
          <span class="summary-value" :style="{ color: utilColor(totals.utilPct) }">
            {{ totals.utilPct.toFixed(1) }}%
          </span>
        </div>
        <div class="summary-sep"></div>
        <div class="summary-item">
          <span class="summary-label">Cost Centers</span>
          <span class="summary-value">{{ enrichedCenters.length }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useMRP } from '@/composables/useMRP'
import type { MrpCostCenter, MrpPlannedOrder, MrpBudgetRollup, MrpMaterial } from '@/composables/useMRP'

const { getCostCenters, getPlannedOrders, getBudgetRollup, getMaterials } = useMRP()

const loading = ref(true)
const costCenters = ref<MrpCostCenter[]>([])
const plannedOrders = ref<MrpPlannedOrder[]>([])
const budgetRollup = ref<MrpBudgetRollup[]>([])
const materials = ref<MrpMaterial[]>([])
const expandedIds = reactive(new Set<string>())

interface EnrichedCC extends MrpCostCenter {
  planned_cost_kusd: number
  utilization_pct: number
  orderCount: number
  orders: MrpPlannedOrder[]
}

const enrichedCenters = computed<EnrichedCC[]>(() =>
  costCenters.value.map(cc => {
    const rollup = budgetRollup.value.find(r => r.cost_center_id === cc.id)
    const orders = plannedOrders.value.filter(o => o.cost_center_id === cc.id)
    const planned_cost_kusd = rollup?.planned_cost_kusd ?? orders.reduce((s, o) => s + o.total_cost, 0) / 1000
    const utilization_pct = rollup?.utilization_pct ?? (cc.budget_kusd > 0 ? (planned_cost_kusd / cc.budget_kusd) * 100 : 0)
    return { ...cc, planned_cost_kusd, utilization_pct, orderCount: orders.length, orders }
  })
)

const totals = computed(() => {
  const budget = enrichedCenters.value.reduce((s, c) => s + c.budget_kusd, 0)
  const planned = enrichedCenters.value.reduce((s, c) => s + c.planned_cost_kusd, 0)
  const utilPct = budget > 0 ? (planned / budget) * 100 : 0
  return { budget, planned, utilPct }
})

function fmtK(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtCost(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function utilColor(pct: number) {
  if (pct > 90) return '#ef4444'
  if (pct > 70) return '#f59e0b'
  return '#22c55e'
}

function rowTint(pct: number) {
  if (pct > 90) return 'row-danger'
  if (pct > 70) return 'row-warn'
  return ''
}

function typeClass(t: string) {
  return t === 'purchase' ? 'type-blue' : t === 'work_order' ? 'type-orange' : 'type-slate'
}

function statusClass(s: string) {
  if (s === 'released') return 'status-green'
  if (s === 'firm') return 'status-amber'
  return 'status-indigo'
}

function getMaterialDesc(mid: string) {
  return materials.value.find(m => m.id === mid)?.description ?? mid
}

function toggleExpand(id: string) {
  if (expandedIds.has(id)) expandedIds.delete(id)
  else expandedIds.add(id)
}

onMounted(async () => {
  const [cc, po, br, mat] = await Promise.all([
    getCostCenters(), getPlannedOrders(), getBudgetRollup(), getMaterials()
  ])
  costCenters.value = cc
  plannedOrders.value = po
  budgetRollup.value = br
  materials.value = mat
  loading.value = false
})
</script>

<style scoped>
.cc-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
  font-family: system-ui, sans-serif;
  overflow: hidden;
}

/* Header */
.cc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 48px;
  min-height: 48px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}
.header-left { display: flex; align-items: baseline; gap: 12px; }
.page-title { font-size: 15px; font-weight: 700; color: #e2e8f0; }
.budget-year {
  font-size: 12px;
  color: #94a6b8;
  background: rgba(99,102,241,0.12);
  padding: 2px 9px;
  border-radius: 10px;
  font-weight: 600;
}

/* Loading */
.loading-overlay {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #94a6b8;
  font-size: 14px;
}
.spinner {
  width: 28px; height: 28px;
  border: 3px solid #334155;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Body */
.cc-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Table */
.table-wrap {
  flex: 1;
  overflow-y: auto;
}
.table-wrap::-webkit-scrollbar { width: 6px; }
.table-wrap::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }

.cc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.cc-table thead th {
  padding: 10px 14px;
  color: #94a6b8;
  font-weight: 600;
  font-size: 11px;
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
.th-util { min-width: 160px; }
.th-expand { width: 32px; }
.th-code { width: 90px; }

.cc-row {
  cursor: pointer;
  border-bottom: 1px solid rgba(51,65,85,0.5);
  transition: background 0.1s;
}
.cc-row:hover { background: rgba(99,102,241,0.07); }
.row-danger { background: rgba(239,68,68,0.05); }
.row-danger:hover { background: rgba(239,68,68,0.1); }
.row-warn { background: rgba(245,158,11,0.04); }
.row-warn:hover { background: rgba(245,158,11,0.08); }

.cc-table td { padding: 10px 14px; color: #e2e8f0; vertical-align: middle; }
.td-num { text-align: right; font-variant-numeric: tabular-nums; font-size: 12px; }
.td-name { font-weight: 500; }
.td-muted { color: #94a6b8; font-size: 12px; }
.td-mono { font-variant-numeric: tabular-nums; font-size: 12px; }

.code-chip {
  font-family: monospace;
  font-weight: 700;
  font-size: 12px;
  padding: 3px 8px;
  background: rgba(99,102,241,0.12);
  color: #818cf8;
  border-radius: 4px;
}

.td-util { min-width: 160px; }
.util-row { display: flex; align-items: center; gap: 8px; }
.util-track {
  flex: 1;
  height: 6px;
  background: #334155;
  border-radius: 3px;
  overflow: hidden;
}
.util-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.util-pct { font-size: 12px; font-weight: 600; min-width: 44px; text-align: right; }

.td-expand { text-align: center; }
.expand-arrow {
  font-size: 10px;
  color: #94a6b8;
  display: inline-block;
  transition: transform 0.2s;
}
.expand-arrow.rotated { transform: rotate(90deg); }

/* Sub-row */
.sub-row { background: rgba(15,23,42,0.8); }
.sub-cell { padding: 0 !important; }
.sub-table-wrap {
  padding: 12px 32px;
  border-bottom: 1px solid #334155;
}
.sub-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.sub-table thead th {
  padding: 6px 10px;
  color: #94a6b8;
  font-weight: 600;
  text-align: left;
  border-bottom: 1px solid #334155;
}
.sub-table tbody tr { border-bottom: 1px solid rgba(51,65,85,0.3); }
.sub-table td { padding: 7px 10px; color: #e2e8f0; }
.sub-empty { padding: 12px; color: #94a6b8; font-size: 12px; }

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

.empty-row { padding: 24px; text-align: center; color: #94a6b8; font-size: 13px; }

/* Summary Footer */
.summary-footer {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 12px 20px;
  background: #1e293b;
  border-top: 1px solid #334155;
  flex-shrink: 0;
}
.summary-item { display: flex; flex-direction: column; gap: 2px; padding: 0 24px; }
.summary-label { font-size: 11px; color: #94a6b8; text-transform: uppercase; letter-spacing: 0.05em; }
.summary-value { font-size: 16px; font-weight: 700; color: #e2e8f0; font-variant-numeric: tabular-nums; }
.summary-sep { width: 1px; height: 32px; background: #334155; }
</style>

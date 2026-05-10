<template>
  <div class="mrp-hub">
    <!-- Header -->
    <header class="hub-header">
      <div class="header-left">
        <span class="header-title">MRP Dashboard</span>
        <span class="header-sub">Material Requirements Planning</span>
      </div>
      <div class="header-right">
        <select v-model="horizon" class="horizon-select">
          <option :value="30">30 days</option>
          <option :value="60">60 days</option>
          <option :value="90">90 days</option>
          <option :value="180">180 days</option>
        </select>
        <button class="btn-run" :disabled="running" @click="handleRunMRP">
          <span v-if="running" class="spinner-sm"></span>
          {{ running ? 'Running…' : 'Run MRP' }}
        </button>
      </div>
    </header>

    <!-- Toast -->
    <transition name="toast-fade">
      <div v-if="toastMsg" class="toast-banner">{{ toastMsg }}</div>
    </transition>

    <!-- Loading overlay -->
    <div v-if="loading" class="loading-overlay">
      <span class="spinner"></span>
      <span class="loading-text">Loading MRP data…</span>
    </div>

    <div v-else class="hub-body">
      <!-- KPI Strip -->
      <div class="kpi-strip">
        <div class="kpi-card">
          <span class="kpi-value">{{ materials.length }}</span>
          <span class="kpi-label">Materials</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-value">{{ demand.length }}</span>
          <span class="kpi-label">Open Demand Lines</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-value">{{ plannedOrders.length }}</span>
          <span class="kpi-label">Planned Orders</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-value accent">{{ totalCostFormatted }}</span>
          <span class="kpi-label">Total Planned Cost</span>
        </div>
      </div>

      <!-- Main Area -->
      <div class="main-split">
        <!-- Left: Budget Utilization Chart -->
        <div class="panel panel-chart">
          <div class="panel-header">Budget Utilization</div>
          <div ref="chartEl" class="chart-area"></div>
        </div>

        <!-- Right: Planned Orders List -->
        <div class="panel panel-orders">
          <div class="panel-header">Planned Orders</div>
          <div class="orders-scroll">
            <table class="orders-table" v-if="plannedOrders.length">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Due</th>
                  <th>CC</th>
                  <th>Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="o in plannedOrders" :key="o.id">
                  <td class="td-desc">{{ truncate(getMaterialDesc(o.material_id), 24) }}</td>
                  <td><span class="badge" :class="typeClass(o.order_type)">{{ o.order_type }}</span></td>
                  <td class="td-mono">{{ o.qty.toLocaleString() }}</td>
                  <td class="td-mono">{{ fmtDate(o.due_date) }}</td>
                  <td><span class="chip-cc">{{ getCCCode(o.cost_center_id) }}</span></td>
                  <td class="td-mono">${{ fmtCost(o.total_cost) }}</td>
                  <td><span class="status-chip" :class="statusClass(o.status)">{{ o.status }}</span></td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty-state">No planned orders</div>
          </div>
        </div>
      </div>

      <!-- Footer Nav Tiles -->
      <div class="nav-tiles">
        <router-link to="/mrp/planner" class="nav-tile">
          <span class="nav-tile-title">Material Master</span>
          <span class="nav-tile-arrow">→</span>
        </router-link>
        <router-link to="/mrp/cost-centers" class="nav-tile">
          <span class="nav-tile-title">Cost Centers</span>
          <span class="nav-tile-arrow">→</span>
        </router-link>
        <router-link to="/mrp/orders" class="nav-tile">
          <span class="nav-tile-title">Orders</span>
          <span class="nav-tile-arrow">→</span>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { useMRP } from '@/composables/useMRP'
import type { MrpMaterial, MrpDemand, MrpPlannedOrder, MrpCostCenter, MrpBudgetRollup } from '@/composables/useMRP'

const { getCostCenters, getMaterials, getDemand, getPlannedOrders, getBudgetRollup, runMRP } = useMRP()

const loading = ref(true)
const running = ref(false)
const horizon = ref(90)
const toastMsg = ref('')

const materials = ref<MrpMaterial[]>([])
const demand = ref<MrpDemand[]>([])
const plannedOrders = ref<MrpPlannedOrder[]>([])
const costCenters = ref<MrpCostCenter[]>([])
const budgetRollup = ref<MrpBudgetRollup[]>([])

const chartEl = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

const totalCostFormatted = computed(() => {
  const total = plannedOrders.value.reduce((s, o) => s + o.total_cost, 0)
  return `$${(total / 1_000_000).toFixed(2)}M`
})

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s
}

function getMaterialDesc(mid: string) {
  return materials.value.find(m => m.id === mid)?.description ?? mid
}

function getCCCode(ccid: string | null) {
  if (!ccid) return '—'
  return costCenters.value.find(c => c.id === ccid)?.code ?? ccid.slice(0, 6)
}

function fmtDate(d: string) {
  return d ? d.slice(0, 10) : '—'
}

function fmtCost(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function typeClass(t: string) {
  return t === 'purchase' ? 'badge-blue' : t === 'work_order' ? 'badge-orange' : 'badge-slate'
}

function statusClass(s: string) {
  if (s === 'released') return 'status-green'
  if (s === 'firm') return 'status-amber'
  return 'status-indigo'
}

async function loadAll() {
  loading.value = true
  const [cc, mat, dem, po, br] = await Promise.all([
    getCostCenters(), getMaterials(), getDemand(), getPlannedOrders(), getBudgetRollup()
  ])
  costCenters.value = cc
  materials.value = mat
  demand.value = dem
  plannedOrders.value = po
  budgetRollup.value = br
  loading.value = false
  await nextTick()
  initChart()
}

async function handleRunMRP() {
  running.value = true
  const result = await runMRP(horizon.value)
  running.value = false
  if (result) {
    toastMsg.value = `MRP run complete — ${result.orders_created} planned orders generated`
    setTimeout(() => { toastMsg.value = '' }, 3000)
    await loadAll()
  }
}

function initChart() {
  if (!chartEl.value) return
  if (chart) chart.dispose()
  chart = echarts.init(chartEl.value, 'dark')

  const data = budgetRollup.value.slice(0, 12)
  const codes = data.map(d => d.code)
  const budgetData = data.map(d => d.budget_kusd)
  const plannedData = data.map(d => ({
    value: d.planned_cost_kusd,
    itemStyle: {
      color: d.utilization_pct > 90 ? '#ef4444' : d.utilization_pct > 70 ? '#f59e0b' : '#6366f1'
    }
  }))

  chart.setOption({
    backgroundColor: 'transparent',
    grid: { left: 60, right: 16, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: '#94a6b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#334155' } },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    yAxis: {
      type: 'category',
      data: codes,
      axisLabel: { color: '#e2e8f0', fontSize: 11 },
      axisLine: { lineStyle: { color: '#334155' } },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#e2e8f0' },
    },
    legend: {
      data: ['Budget (kUSD)', 'Planned (kUSD)'],
      textStyle: { color: '#94a6b8' },
      top: 0,
    },
    series: [
      {
        name: 'Budget (kUSD)',
        type: 'bar',
        data: budgetData,
        itemStyle: { color: '#334155' },
        barMaxWidth: 14,
      },
      {
        name: 'Planned (kUSD)',
        type: 'bar',
        data: plannedData,
        barMaxWidth: 14,
      },
    ],
  })
}

watch(budgetRollup, () => {
  nextTick(initChart)
})

onMounted(loadAll)
</script>

<style scoped>
:root {
  --bg: #0f172a;
  --panel: #1e293b;
  --border: #334155;
  --text: #e2e8f0;
  --muted: #94a6b8;
  --accent: #6366f1;
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
}

.mrp-hub {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
  font-family: system-ui, sans-serif;
  overflow: hidden;
  position: relative;
}

/* Header */
.hub-header {
  height: 48px;
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: #1e293b;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}
.header-left { display: flex; align-items: baseline; gap: 12px; }
.header-title { font-size: 15px; font-weight: 700; color: #e2e8f0; }
.header-sub { font-size: 12px; color: #94a6b8; }
.header-right { display: flex; align-items: center; gap: 10px; }

.horizon-select {
  background: #0f172a;
  border: 1px solid #334155;
  color: #e2e8f0;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.horizon-select:focus { outline: none; border-color: #6366f1; }

.btn-run {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: #6366f1;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-run:hover:not(:disabled) { background: #4f46e5; }
.btn-run:disabled { opacity: 0.6; cursor: not-allowed; }

/* Toast */
.toast-banner {
  position: fixed;
  top: 56px;
  left: 50%;
  transform: translateX(-50%);
  background: #22c55e;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 20px;
  border-radius: 8px;
  z-index: 100;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.toast-fade-enter-active, .toast-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.toast-fade-enter-from, .toast-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(-8px); }

/* Loading */
.loading-overlay {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.loading-text { color: #94a6b8; font-size: 14px; }

/* Body */
.hub-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px;
  gap: 14px;
}

/* KPI Strip */
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  min-height: 88px;
}
.kpi-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.kpi-value {
  font-size: 24px;
  font-weight: 700;
  color: #e2e8f0;
  line-height: 1;
}
.kpi-value.accent { color: #6366f1; }
.kpi-label { font-size: 11px; color: #94a6b8; text-transform: uppercase; letter-spacing: 0.05em; }

/* Main split */
.main-split {
  flex: 1;
  display: grid;
  grid-template-columns: 60fr 40fr;
  gap: 14px;
  min-height: 0;
}

.panel {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.panel-header {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #94a6b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}
.chart-area { flex: 1; min-height: 0; }

/* Orders table */
.orders-scroll { flex: 1; overflow-y: auto; }
.orders-scroll::-webkit-scrollbar { width: 4px; }
.orders-scroll::-webkit-scrollbar-track { background: transparent; }
.orders-scroll::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }

.orders-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.orders-table thead th {
  padding: 8px 10px;
  color: #94a6b8;
  font-weight: 600;
  text-align: left;
  border-bottom: 1px solid #334155;
  position: sticky;
  top: 0;
  background: #1e293b;
  white-space: nowrap;
}
.orders-table tbody tr { border-bottom: 1px solid rgba(51,65,85,0.5); }
.orders-table tbody tr:hover { background: rgba(99,102,241,0.06); }
.orders-table td { padding: 7px 10px; color: #e2e8f0; vertical-align: middle; }
.td-desc { max-width: 140px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.td-mono { font-variant-numeric: tabular-nums; font-size: 11px; }

.badge {
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.badge-blue { background: rgba(59,130,246,0.2); color: #60a5fa; }
.badge-orange { background: rgba(245,158,11,0.2); color: #f59e0b; }
.badge-slate { background: rgba(100,116,139,0.2); color: #94a3b8; }

.chip-cc {
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(99,102,241,0.15);
  color: #818cf8;
  font-size: 10px;
  font-family: monospace;
  font-weight: 700;
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

.empty-state {
  padding: 24px;
  text-align: center;
  color: #94a6b8;
  font-size: 13px;
}

/* Nav tiles */
.nav-tiles {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  flex-shrink: 0;
}
.nav-tile {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s;
  cursor: pointer;
}
.nav-tile:hover { border-color: #6366f1; background: rgba(99,102,241,0.08); }
.nav-tile-title { font-size: 13px; font-weight: 600; color: #e2e8f0; }
.nav-tile-arrow { font-size: 18px; color: #6366f1; }

/* Spinners */
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #334155;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}
.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>

<template>
  <div class="sc-hub">
    <!-- Header bar -->
    <div class="sc-header">
      <div class="sc-header-left">
        <span class="sc-title">Supply Chain Hub</span>
        <span class="sc-subtitle">Procurement &amp; Inventory Operations</span>
      </div>
      <button class="btn-refresh" @click="loadAll" :disabled="loading">
        {{ loading ? 'Loading…' : 'Refresh' }}
      </button>
    </div>

    <!-- KPI strip -->
    <div class="kpi-strip">
      <div class="kpi-card">
        <span class="kpi-val">{{ kpiOpenPos }}</span>
        <span class="kpi-lbl">Open POs</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-val">${{ kpiTotalValueM }}</span>
        <span class="kpi-lbl">Total PO Value</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-val" :class="onTimeClass(kpiOnTimeRate)">{{ kpiOnTimeRate }}%</span>
        <span class="kpi-lbl">On-time Rate</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-val" :class="kpiPendingReceipts > 0 ? 'val-amber' : 'val-green'">{{ kpiPendingReceipts }}</span>
        <span class="kpi-lbl">Pending Receipts</span>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tab-bar">
      <button :class="['tab-btn', { active: activeTab === 'flow' }]" @click="activeTab = 'flow'">Flow</button>
      <button :class="['tab-btn', { active: activeTab === 'orders' }]" @click="activeTab = 'orders'">Orders</button>
      <button :class="['tab-btn', { active: activeTab === 'suppliers' }]" @click="activeTab = 'suppliers'">Suppliers</button>
    </div>

    <!-- Tab: Flow -->
    <div v-if="activeTab === 'flow'" class="flow-layout">
      <div class="flow-left panel">
        <div class="panel-title">Supply Chain Flow</div>
        <div ref="sankeyEl" class="sankey-chart"></div>
      </div>
      <div class="flow-right panel">
        <div class="panel-title">Recent Purchase Orders</div>
        <table class="sc-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Status</th>
              <th>Value</th>
              <th>Expected</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="po in recentPos" :key="po.id">
              <td class="td-desc">{{ po.description }}</td>
              <td class="td-num">{{ po.qty }} {{ po.uom }}</td>
              <td><span class="status-chip" :class="'status-' + po.status">{{ po.status }}</span></td>
              <td class="td-num">${{ fmtVal(po.total_value) }}</td>
              <td class="td-date">{{ fmtDate(po.expected_date) }}</td>
            </tr>
            <tr v-if="recentPos.length === 0">
              <td colspan="5" class="td-empty">No orders</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab: Orders -->
    <div v-if="activeTab === 'orders'" class="orders-panel panel">
      <div class="orders-toolbar">
        <div class="filter-chips">
          <button
            v-for="f in statusFilters"
            :key="f"
            :class="['chip', { active: orderFilter === f }]"
            @click="orderFilter = f"
          >{{ f === 'all' ? 'All' : capitalize(f) }}</button>
        </div>
        <button class="btn-primary" @click="showNewPoModal = true">+ New PO</button>
      </div>

      <div class="table-wrap">
        <table class="sc-table full-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Total Value</th>
              <th>Cost Center</th>
              <th>Status</th>
              <th>Order Date</th>
              <th>Expected</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="po in filteredOrders" :key="po.id">
              <tr>
                <td class="td-mono">{{ po.id.slice(0, 8) }}…</td>
                <td class="td-desc">{{ po.description }}</td>
                <td class="td-num">{{ po.qty }} {{ po.uom }}</td>
                <td class="td-num">${{ fmtVal(po.unit_price) }}</td>
                <td class="td-num bold">${{ fmtVal(po.total_value) }}</td>
                <td class="td-muted">{{ po.cost_center_id ?? '—' }}</td>
                <td><span class="status-chip" :class="'status-' + po.status">{{ po.status }}</span></td>
                <td class="td-date">{{ fmtDate(po.order_date) }}</td>
                <td class="td-date">{{ fmtDate(po.expected_date) }}</td>
                <td>
                  <button
                    v-if="po.status === 'confirmed' || po.status === 'sent'"
                    class="btn-action"
                    @click="toggleReceiveForm(po.id)"
                  >Receive</button>
                </td>
              </tr>
              <!-- Inline receive form -->
              <tr v-if="receivingPoId === po.id" class="receive-row">
                <td colspan="10">
                  <div class="receive-form">
                    <label>Qty Received</label>
                    <input type="number" v-model.number="receiveQty" :max="po.qty" min="0" step="0.001" />
                    <label>Notes</label>
                    <textarea v-model="receiveNotes" rows="2" placeholder="Optional notes…"></textarea>
                    <div class="receive-actions">
                      <button class="btn-primary" :disabled="submittingReceive" @click="submitReceive(po)">
                        {{ submittingReceive ? 'Submitting…' : 'Confirm Receipt' }}
                      </button>
                      <button class="btn-cancel" @click="receivingPoId = null">Cancel</button>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
            <tr v-if="filteredOrders.length === 0">
              <td colspan="10" class="td-empty">No orders found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab: Suppliers -->
    <div v-if="activeTab === 'suppliers'" class="suppliers-panel">
      <div class="supplier-grid">
        <div v-for="sc in scorecards" :key="sc.id" class="supplier-card panel">
          <div class="sc-name">{{ sc.supplier_name }}</div>
          <div class="sc-stat-row">
            <div class="sc-stat">
              <span class="sc-big-num" :class="onTimeClass(Math.round(sc.on_time_rate))">
                {{ Math.round(sc.on_time_rate) }}%
              </span>
              <span class="sc-stat-lbl">On-time Rate</span>
            </div>
            <div class="sc-stat">
              <span class="sc-med-num">{{ sc.total_orders }}</span>
              <span class="sc-stat-lbl">Total Orders</span>
            </div>
            <div class="sc-stat">
              <span class="sc-med-num">{{ sc.avg_lead_time_days }}d</span>
              <span class="sc-stat-lbl">Avg Lead Time</span>
            </div>
          </div>
          <div class="sc-stars">
            <span v-for="s in 5" :key="s" class="star" :class="{ filled: s <= Math.round(sc.quality_score) }">★</span>
            <span class="sc-stat-lbl star-label">Quality</span>
          </div>
          <div class="late-badge" v-if="sc.late_deliveries > 0">
            {{ sc.late_deliveries }} late {{ sc.late_deliveries === 1 ? 'delivery' : 'deliveries' }}
          </div>
        </div>
        <div v-if="scorecards.length === 0" class="td-empty">No supplier data</div>
      </div>
      <!-- Fleet average progress bar -->
      <div class="fleet-bar panel" v-if="scorecards.length > 0">
        <div class="fleet-label">
          <span>Fleet Avg On-time Rate</span>
          <span :class="onTimeClass(fleetAvgOnTime)">{{ fleetAvgOnTime }}%</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :class="onTimeClass(fleetAvgOnTime)" :style="{ width: fleetAvgOnTime + '%' }"></div>
        </div>
      </div>
    </div>

    <!-- New PO Modal -->
    <div v-if="showNewPoModal" class="modal-backdrop" @click.self="showNewPoModal = false">
      <div class="modal-box">
        <div class="modal-title">New Purchase Order</div>
        <div class="modal-form">
          <label>Description *</label>
          <input type="text" v-model="newPo.description" placeholder="Material description" />
          <label>Material ID *</label>
          <input type="text" v-model="newPo.material_id" placeholder="e.g. MAT-001" />
          <label>Qty *</label>
          <input type="number" v-model.number="newPo.qty" min="0" step="0.001" />
          <label>UOM</label>
          <input type="text" v-model="newPo.uom" placeholder="ea" />
          <label>Unit Price</label>
          <input type="number" v-model.number="newPo.unit_price" min="0" step="0.01" />
          <label>Expected Date *</label>
          <input type="date" v-model="newPo.expected_date" />
          <label>Supplier ID</label>
          <input type="text" v-model="newPo.supplier_id" placeholder="SUP-001" />
          <label>Cost Center</label>
          <select v-model="newPo.cost_center_id">
            <option value="">— none —</option>
            <option value="cc-001">cc-001 — Manufacturing</option>
            <option value="cc-002">cc-002 — Procurement</option>
            <option value="cc-003">cc-003 — R&amp;D</option>
            <option value="cc-004">cc-004 — Quality</option>
            <option value="cc-005">cc-005 — Engineering</option>
            <option value="cc-006">cc-006 — Maintenance</option>
            <option value="cc-007">cc-007 — Logistics</option>
            <option value="cc-008">cc-008 — Operations</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn-primary" :disabled="creatingPo" @click="submitNewPo">
            {{ creatingPo ? 'Creating…' : 'Create PO' }}
          </button>
          <button class="btn-cancel" @click="showNewPoModal = false">Cancel</button>
        </div>
        <div v-if="newPoError" class="form-error">{{ newPoError }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import {
  useSupplyChain,
  type ScPurchaseOrder,
  type ScSupplierScorecard,
  type CreatePoRequest,
} from '@/composables/useSupplyChain'

const sc = useSupplyChain()

const loading = ref(false)
const activeTab = ref<'flow' | 'orders' | 'suppliers'>('flow')

const purchaseOrders = ref<ScPurchaseOrder[]>([])
const scorecards = ref<ScSupplierScorecard[]>([])
const graphData = ref<any>(null)

const sankeyEl = ref<HTMLElement | null>(null)
let sankeyInst: echarts.ECharts | null = null

// ── KPIs ────────────────────────────────────────────────────────────────────

const openStatuses = new Set(['draft', 'sent', 'confirmed'])
const kpiOpenPos = computed(() => purchaseOrders.value.filter(p => openStatuses.has(p.status)).length)
const kpiTotalValueM = computed(() => {
  const sum = purchaseOrders.value.reduce((a, p) => a + p.total_value, 0)
  return (sum / 1_000_000).toFixed(2) + 'M'
})
const kpiOnTimeRate = computed(() => {
  if (!scorecards.value.length) return 0
  const avg = scorecards.value.reduce((a, s) => a + s.on_time_rate, 0) / scorecards.value.length
  return Math.round(avg)
})
const kpiPendingReceipts = computed(() =>
  purchaseOrders.value.filter(p => p.status === 'confirmed' && p.received_qty < p.qty).length
)

// ── Orders tab ───────────────────────────────────────────────────────────────

const statusFilters = ['all', 'draft', 'sent', 'confirmed', 'received', 'invoiced']
const orderFilter = ref('all')
const filteredOrders = computed(() =>
  orderFilter.value === 'all'
    ? purchaseOrders.value
    : purchaseOrders.value.filter(p => p.status === orderFilter.value)
)

const receivingPoId = ref<string | null>(null)
const receiveQty = ref(0)
const receiveNotes = ref('')
const submittingReceive = ref(false)

function toggleReceiveForm(id: string) {
  if (receivingPoId.value === id) {
    receivingPoId.value = null
    return
  }
  const po = purchaseOrders.value.find(p => p.id === id)
  receiveQty.value = po?.qty ?? 0
  receiveNotes.value = ''
  receivingPoId.value = id
}

async function submitReceive(po: ScPurchaseOrder) {
  submittingReceive.value = true
  await sc.receiveGoods(po.id, receiveQty.value, receiveNotes.value || undefined)
  submittingReceive.value = false
  receivingPoId.value = null
  purchaseOrders.value = await sc.getPurchaseOrders()
}

// ── New PO modal ─────────────────────────────────────────────────────────────

const showNewPoModal = ref(false)
const creatingPo = ref(false)
const newPoError = ref('')

const newPo = ref({
  material_id: '',
  description: '',
  qty: 1,
  uom: 'ea',
  unit_price: 0,
  expected_date: '',
  supplier_id: '',
  cost_center_id: '',
})

async function submitNewPo() {
  newPoError.value = ''
  if (!newPo.value.description || !newPo.value.material_id || !newPo.value.expected_date) {
    newPoError.value = 'Description, Material ID, and Expected Date are required.'
    return
  }
  creatingPo.value = true
  const req: CreatePoRequest = {
    material_id: newPo.value.material_id,
    description: newPo.value.description,
    qty: newPo.value.qty,
    uom: newPo.value.uom || 'ea',
    unit_price: newPo.value.unit_price,
    expected_date: newPo.value.expected_date,
    supplier_id: newPo.value.supplier_id || undefined,
    cost_center_id: newPo.value.cost_center_id || undefined,
  }
  const created = await sc.createPurchaseOrder(req)
  creatingPo.value = false
  if (created) {
    showNewPoModal.value = false
    Object.assign(newPo.value, { material_id: '', description: '', qty: 1, uom: 'ea', unit_price: 0, expected_date: '', supplier_id: '', cost_center_id: '' })
    purchaseOrders.value = await sc.getPurchaseOrders()
  } else {
    newPoError.value = 'Failed to create PO. Check API connection.'
  }
}

// ── Suppliers tab ────────────────────────────────────────────────────────────

const fleetAvgOnTime = computed(() => {
  if (!scorecards.value.length) return 0
  return Math.round(scorecards.value.reduce((a, s) => a + s.on_time_rate, 0) / scorecards.value.length)
})

// ── Recent POs for flow tab ──────────────────────────────────────────────────

const recentPos = computed(() =>
  [...purchaseOrders.value]
    .sort((a, b) => b.order_date.localeCompare(a.order_date))
    .slice(0, 5)
)

// ── Sankey chart ─────────────────────────────────────────────────────────────

function buildSankey() {
  if (!sankeyEl.value || !graphData.value) return
  if (!sankeyInst) sankeyInst = echarts.init(sankeyEl.value)

  const gd = graphData.value
  const nodeList: { id: string; label: string; category?: number }[] = gd.nodes ?? []
  const edgeList: { source: string; target: string; value?: number; weight?: number }[] = gd.edges ?? []

  // Build id->label map
  const idToLabel: Record<string, string> = {}
  for (const n of nodeList) idToLabel[n.id] = n.label ?? n.id

  const sankeyNodes = nodeList.map((n) => ({ name: idToLabel[n.id] }))

  // Category colors
  const catColors = ['#6366f1', '#22c55e', '#f59e0b', '#3b82f6']
  const nodeColors = nodeList.map((n) => catColors[(n.category ?? 0) % catColors.length])

  const sankeyLinks = edgeList
    .filter((e) => idToLabel[e.source] && idToLabel[e.target])
    .map((e) => ({
      source: idToLabel[e.source],
      target: idToLabel[e.target],
      value: e.value ?? e.weight ?? 1,
    }))

  sankeyInst.setOption({
    backgroundColor: '#1e293b',
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'sankey',
        orient: 'horizontal',
        nodeAlign: 'left',
        layoutIterations: 32,
        data: sankeyNodes.map((n, i) => ({
          name: n.name,
          itemStyle: { color: nodeColors[i] ?? '#6366f1' },
        })),
        links: sankeyLinks,
        label: { color: '#e2e8f0', fontSize: 11 },
        lineStyle: { color: 'gradient', opacity: 0.4 },
        emphasis: { focus: 'adjacency' },
      },
    ],
  })
}

// ── Data loading ─────────────────────────────────────────────────────────────

async function loadAll() {
  loading.value = true
  const [pos, scs, gd] = await Promise.all([
    sc.getPurchaseOrders(),
    sc.getSupplierScorecards(),
    sc.getSupplyChainGraph(),
  ])
  purchaseOrders.value = pos
  scorecards.value = scs
  graphData.value = gd
  loading.value = false
  if (activeTab.value === 'flow') {
    await nextTick()
    buildSankey()
  }
}

onMounted(loadAll)

watch(activeTab, async (t) => {
  if (t === 'flow') {
    await nextTick()
    buildSankey()
  }
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtVal(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string) {
  if (!d) return '—'
  return d.slice(0, 10)
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function onTimeClass(rate: number) {
  if (rate > 85) return 'val-green'
  if (rate > 70) return 'val-amber'
  return 'val-red'
}
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────────── */
.sc-hub {
  min-height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
  font-family: system-ui, sans-serif;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  gap: 16px;
}

/* ── Header ─────────────────────────────────────────────── */
.sc-header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.sc-header-left { display: flex; flex-direction: column; gap: 2px; }
.sc-title { font-size: 18px; font-weight: 700; color: #e2e8f0; }
.sc-subtitle { font-size: 12px; color: #94a6b8; }
.btn-refresh {
  padding: 7px 16px;
  border-radius: 6px;
  background: #1e293b;
  border: 1px solid #334155;
  color: #e2e8f0;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-refresh:hover:not(:disabled) { background: #334155; }
.btn-refresh:disabled { opacity: 0.5; cursor: default; }

/* ── KPI strip ──────────────────────────────────────────── */
.kpi-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
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
.kpi-val { font-size: 26px; font-weight: 700; color: #6366f1; }
.kpi-lbl { font-size: 11px; color: #94a6b8; }
.val-green { color: #22c55e !important; }
.val-amber { color: #f59e0b !important; }
.val-red   { color: #ef4444 !important; }

/* ── Tabs ───────────────────────────────────────────────── */
.tab-bar { display: flex; gap: 6px; }
.tab-btn {
  padding: 8px 20px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #1e293b;
  color: #94a6b8;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.tab-btn.active { background: #6366f1; color: white; border-color: #6366f1; }

/* ── Panel base ─────────────────────────────────────────── */
.panel {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 16px;
}
.panel-title { font-size: 13px; font-weight: 600; color: #94a6b8; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em; }

/* ── Flow layout ────────────────────────────────────────── */
.flow-layout {
  display: grid;
  grid-template-columns: 60% 40%;
  gap: 16px;
}
.flow-left { overflow: hidden; }
.sankey-chart { height: 400px; width: 100%; }

/* ── Tables ─────────────────────────────────────────────── */
.sc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.sc-table th {
  background: #0f172a;
  padding: 8px 8px;
  text-align: left;
  color: #94a6b8;
  border-bottom: 1px solid #334155;
  white-space: nowrap;
}
.sc-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #1e293b;
  vertical-align: middle;
}
.sc-table tr:hover td { background: rgba(255,255,255,0.03); }
.td-desc { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-num  { text-align: right; font-variant-numeric: tabular-nums; }
.td-mono { font-family: 'Courier New', monospace; font-size: 11px; color: #94a6b8; }
.td-date { color: #94a6b8; white-space: nowrap; }
.td-muted { color: #94a6b8; }
.td-empty { text-align: center; color: #94a6b8; padding: 24px; }
.bold { font-weight: 700; }
.full-table { min-width: 900px; }

/* ── Status chips ───────────────────────────────────────── */
.status-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}
.status-draft    { background: rgba(100,116,139,0.25); color: #94a3b8; }
.status-sent     { background: rgba(99,102,241,0.2);   color: #818cf8; }
.status-confirmed{ background: rgba(245,158,11,0.2);   color: #f59e0b; }
.status-received { background: rgba(34,197,94,0.2);    color: #22c55e; }
.status-invoiced { background: rgba(6,182,212,0.2);    color: #22d3ee; }

/* ── Orders tab ─────────────────────────────────────────── */
.orders-panel { overflow: hidden; }
.orders-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 8px;
}
.filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip {
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid #334155;
  background: transparent;
  color: #94a6b8;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.chip.active { background: #6366f1; color: white; border-color: #6366f1; }
.table-wrap { overflow-x: auto; }

/* ── Inline receive form ────────────────────────────────── */
.receive-row td { background: #0f172a !important; padding: 0 !important; }
.receive-form {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 8px;
  align-items: start;
  padding: 12px 16px;
  border-left: 3px solid #6366f1;
}
.receive-form label { font-size: 12px; color: #94a6b8; padding-top: 6px; }
.receive-form input,
.receive-form textarea {
  background: #1e293b;
  border: 1px solid #334155;
  color: #e2e8f0;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 13px;
  resize: vertical;
}
.receive-actions { grid-column: 2; display: flex; gap: 8px; margin-top: 4px; }

/* ── Suppliers ──────────────────────────────────────────── */
.suppliers-panel { display: flex; flex-direction: column; gap: 16px; }
.supplier-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.supplier-card { display: flex; flex-direction: column; gap: 10px; }
.sc-name { font-size: 14px; font-weight: 600; color: #e2e8f0; }
.sc-stat-row { display: flex; gap: 16px; align-items: flex-end; }
.sc-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.sc-big-num { font-size: 28px; font-weight: 700; line-height: 1; }
.sc-med-num { font-size: 18px; font-weight: 600; color: #e2e8f0; }
.sc-stat-lbl { font-size: 11px; color: #94a6b8; }
.sc-stars { display: flex; align-items: center; gap: 2px; }
.star { font-size: 16px; color: #334155; }
.star.filled { color: #f59e0b; }
.star-label { margin-left: 6px; }
.late-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(239,68,68,0.15);
  color: #ef4444;
  font-size: 11px;
  font-weight: 600;
  align-self: flex-start;
}

/* ── Fleet bar ──────────────────────────────────────────── */
.fleet-bar { padding: 14px 18px; }
.fleet-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 8px;
  color: #94a6b8;
}
.progress-track {
  height: 8px;
  background: #0f172a;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #334155;
}
.progress-fill {
  height: 100%;
  border-radius: 4px;
  background: #6366f1;
  transition: width 0.4s ease;
}
.progress-fill.val-green { background: #22c55e; }
.progress-fill.val-amber { background: #f59e0b; }
.progress-fill.val-red   { background: #ef4444; }

/* ── Buttons ────────────────────────────────────────────── */
.btn-primary {
  padding: 7px 16px;
  border-radius: 6px;
  background: #6366f1;
  color: white;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover:not(:disabled) { background: #4f46e5; }
.btn-primary:disabled { opacity: 0.5; cursor: default; }
.btn-cancel {
  padding: 7px 14px;
  border-radius: 6px;
  background: transparent;
  border: 1px solid #334155;
  color: #94a6b8;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-cancel:hover { background: #334155; }
.btn-action {
  padding: 4px 10px;
  border-radius: 4px;
  background: rgba(99,102,241,0.15);
  border: 1px solid rgba(99,102,241,0.4);
  color: #818cf8;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-action:hover { background: rgba(99,102,241,0.3); }

/* ── Modal ──────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-box {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 12px;
  padding: 24px;
  width: 480px;
  max-width: 95vw;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.modal-title { font-size: 16px; font-weight: 600; color: #e2e8f0; }
.modal-form {
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 10px;
  align-items: center;
}
.modal-form label { font-size: 12px; color: #94a6b8; }
.modal-form input,
.modal-form select {
  background: #0f172a;
  border: 1px solid #334155;
  color: #e2e8f0;
  border-radius: 4px;
  padding: 7px 10px;
  font-size: 13px;
}
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.form-error { font-size: 12px; color: #ef4444; }
</style>

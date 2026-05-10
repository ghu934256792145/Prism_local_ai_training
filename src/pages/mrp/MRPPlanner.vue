<template>
  <div class="planner">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">Material Master</div>
      <div class="sidebar-search">
        <input
          v-model="search"
          class="search-input"
          placeholder="Search materials…"
          type="text"
        />
      </div>
      <div class="sidebar-list">
        <div
          v-for="m in filteredMaterials"
          :key="m.id"
          class="mat-row"
          :class="{ active: selectedId === m.id }"
          @click="selectMaterial(m.id)"
        >
          <div class="mat-row-top">
            <span class="mat-desc">{{ m.description }}</span>
            <span class="make-buy-badge" :class="m.make_buy === 'make' ? 'mb-make' : 'mb-buy'">
              {{ m.make_buy }}
            </span>
          </div>
          <div class="mat-row-bot">
            <span class="mat-muted">{{ m.uom }} · {{ m.on_hand.toLocaleString() }} on-hand</span>
            <span v-if="getCCCode(m.cost_center_id)" class="cc-chip">{{ getCCCode(m.cost_center_id) }}</span>
          </div>
        </div>
        <div v-if="filteredMaterials.length === 0" class="empty-list">No materials found</div>
      </div>
    </aside>

    <!-- Main Panel -->
    <main class="main-panel">
      <!-- No selection placeholder -->
      <div v-if="!selected" class="placeholder">
        <span class="placeholder-icon">←</span>
        <span class="placeholder-text">Select a material</span>
      </div>

      <template v-else>
        <!-- Material header -->
        <div class="mat-header">
          <div class="mat-header-top">
            <span class="mat-header-title">{{ selected.description }}</span>
            <span class="mat-uom-badge">{{ selected.uom }}</span>
          </div>

          <!-- Stock info bar -->
          <div class="stock-bar-area">
            <div class="stock-labels">
              <span class="stock-label">On-hand: <strong>{{ selected.on_hand.toLocaleString() }}</strong></span>
              <span class="stock-label">Safety stock: <strong>{{ selected.safety_stock.toLocaleString() }}</strong></span>
              <span class="stock-label">Reorder qty: <strong>{{ selected.reorder_qty.toLocaleString() }}</strong></span>
              <span class="stock-label">Lead time: <strong>{{ selected.lead_time_days }}d</strong></span>
            </div>
            <div class="stock-track">
              <div
                class="stock-fill"
                :style="{ width: stockPct + '%', background: stockOk ? '#22c55e' : '#ef4444' }"
              ></div>
            </div>
          </div>
        </div>

        <!-- Net Requirement callout -->
        <div class="net-req" :class="netReq > 0 ? 'net-req-warn' : 'net-req-ok'">
          <template v-if="netReq > 0">
            ⚠ Net requirement: {{ netReq.toLocaleString() }} {{ selected.uom }}
          </template>
          <template v-else>
            ✓ Covered by on-hand stock
          </template>
        </div>

        <!-- Demand Table -->
        <div class="section">
          <div class="section-title">Demand Lines</div>
          <div class="demand-table-wrap">
            <table class="demand-table" v-if="materialDemand.length">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Ref</th>
                  <th>Qty</th>
                  <th>Required Date</th>
                  <th>Cost Center</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in materialDemand" :key="d.id">
                  <td><span class="source-badge" :class="sourceClass(d.source)">{{ d.source }}</span></td>
                  <td class="td-ref">{{ d.source_ref ?? '—' }}</td>
                  <td class="td-mono">{{ d.demand_qty.toLocaleString() }}</td>
                  <td class="td-mono">{{ d.required_date.slice(0, 10) }}</td>
                  <td><span class="cc-chip">{{ getCCCode(d.cost_center_id) }}</span></td>
                  <td>
                    <button class="btn-del" title="Delete demand">✕</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty-state">No demand lines for this material</div>
          </div>
        </div>

        <!-- Add Demand Form -->
        <div class="section">
          <div class="section-title">Add Demand</div>
          <form class="demand-form" @submit.prevent="submitDemand">
            <div class="form-row">
              <div class="form-field">
                <label>Qty <span class="req">*</span></label>
                <input
                  v-model.number="form.demand_qty"
                  type="number"
                  min="1"
                  step="1"
                  class="form-input"
                  required
                />
              </div>
              <div class="form-field">
                <label>Required Date <span class="req">*</span></label>
                <input
                  v-model="form.required_date"
                  type="date"
                  class="form-input"
                  required
                />
              </div>
              <div class="form-field">
                <label>Source <span class="req">*</span></label>
                <select v-model="form.source" class="form-select" required>
                  <option value="manual">Manual</option>
                  <option value="forecast">Forecast</option>
                  <option value="sales_order">Sales Order</option>
                  <option value="production_order">Production Order</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-field form-field-grow">
                <label>Source Ref</label>
                <input v-model="form.source_ref" type="text" class="form-input" placeholder="SO-1234, FO-567…" />
              </div>
              <div class="form-field form-field-grow">
                <label>Cost Center</label>
                <select v-model="form.cost_center_id" class="form-select">
                  <option value="">— None —</option>
                  <option v-for="cc in costCenters" :key="cc.id" :value="cc.id">
                    {{ cc.code }} – {{ cc.name }}
                  </option>
                </select>
              </div>
              <div class="form-field form-field-btn">
                <label>&nbsp;</label>
                <button type="submit" class="btn-add" :disabled="submitting">
                  <span v-if="submitting" class="spinner-sm"></span>
                  {{ submitting ? 'Saving…' : 'Add Demand' }}
                </button>
              </div>
            </div>
            <div v-if="formError" class="form-error">{{ formError }}</div>
            <div v-if="formSuccess" class="form-success">{{ formSuccess }}</div>
          </form>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useMRP } from '@/composables/useMRP'
import type { MrpMaterial, MrpDemand, MrpCostCenter } from '@/composables/useMRP'

const { getMaterials, getDemand, getCostCenters, createDemand } = useMRP()

const materials = ref<MrpMaterial[]>([])
const demand = ref<MrpDemand[]>([])
const costCenters = ref<MrpCostCenter[]>([])
const selectedId = ref<string | null>(null)
const search = ref('')
const submitting = ref(false)
const formError = ref('')
const formSuccess = ref('')

const form = ref({
  demand_qty: 1,
  required_date: '',
  source: 'manual',
  source_ref: '',
  cost_center_id: '',
})

const selected = computed(() => materials.value.find(m => m.id === selectedId.value) ?? null)

const filteredMaterials = computed(() => {
  const q = search.value.toLowerCase()
  return materials.value.filter(m => m.description.toLowerCase().includes(q))
})

const materialDemand = computed(() =>
  demand.value.filter(d => d.material_id === selectedId.value)
)

const grossDemand = computed(() =>
  materialDemand.value.reduce((s, d) => s + d.demand_qty, 0)
)

const netReq = computed(() => {
  if (!selected.value) return 0
  return Math.max(0, grossDemand.value - selected.value.on_hand + selected.value.safety_stock)
})

const stockOk = computed(() => {
  if (!selected.value) return true
  return selected.value.on_hand >= selected.value.safety_stock
})

const stockPct = computed(() => {
  if (!selected.value) return 0
  const max = Math.max(selected.value.on_hand, selected.value.safety_stock) * 1.2
  return max > 0 ? Math.min(100, (selected.value.on_hand / max) * 100) : 0
})

function getCCCode(id: string | null) {
  if (!id) return ''
  return costCenters.value.find(c => c.id === id)?.code ?? id.slice(0, 6)
}

function selectMaterial(id: string) {
  selectedId.value = id
  formError.value = ''
  formSuccess.value = ''
}

function sourceClass(s: string) {
  const map: Record<string, string> = {
    manual: 'src-manual',
    forecast: 'src-forecast',
    sales_order: 'src-sales',
    production_order: 'src-prod',
  }
  return map[s] ?? 'src-manual'
}

async function submitDemand() {
  if (!selectedId.value) return
  formError.value = ''
  formSuccess.value = ''
  submitting.value = true
  const payload = {
    material_id: selectedId.value,
    demand_qty: form.value.demand_qty,
    required_date: form.value.required_date,
    source: form.value.source,
    source_ref: form.value.source_ref || null,
    cost_center_id: form.value.cost_center_id || null,
  }
  const result = await createDemand(payload)
  submitting.value = false
  if (result) {
    demand.value.push(result)
    formSuccess.value = 'Demand line added.'
    form.value = { demand_qty: 1, required_date: '', source: 'manual', source_ref: '', cost_center_id: '' }
    setTimeout(() => { formSuccess.value = '' }, 3000)
  } else {
    formError.value = 'Failed to create demand. Check your connection.'
  }
}

onMounted(async () => {
  const [mat, dem, cc] = await Promise.all([getMaterials(), getDemand(), getCostCenters()])
  materials.value = mat
  demand.value = dem
  costCenters.value = cc
})
</script>

<style scoped>
.planner {
  display: flex;
  height: 100vh;
  background: #0f172a;
  color: #e2e8f0;
  font-family: system-ui, sans-serif;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 340px;
  min-width: 340px;
  background: #1e293b;
  border-right: 1px solid #334155;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sidebar-header {
  padding: 14px 16px;
  font-size: 13px;
  font-weight: 700;
  color: #94a6b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}
.sidebar-search {
  padding: 10px 12px;
  border-bottom: 1px solid #334155;
  flex-shrink: 0;
}
.search-input {
  width: 100%;
  box-sizing: border-box;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #e2e8f0;
  padding: 6px 10px;
  font-size: 13px;
}
.search-input:focus { outline: none; border-color: #6366f1; }
.search-input::placeholder { color: #94a6b8; }

.sidebar-list {
  flex: 1;
  overflow-y: auto;
}
.sidebar-list::-webkit-scrollbar { width: 4px; }
.sidebar-list::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }

.mat-row {
  padding: 10px 14px;
  cursor: pointer;
  border-bottom: 1px solid rgba(51,65,85,0.4);
  transition: background 0.1s;
}
.mat-row:hover { background: rgba(99,102,241,0.08); }
.mat-row.active { background: rgba(99,102,241,0.15); border-left: 2px solid #6366f1; }

.mat-row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}
.mat-desc {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.mat-row-bot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.mat-muted { font-size: 11px; color: #94a6b8; }

.make-buy-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  flex-shrink: 0;
}
.mb-make { background: rgba(34,197,94,0.15); color: #22c55e; }
.mb-buy { background: rgba(100,116,139,0.15); color: #94a3b8; }

.cc-chip {
  font-size: 10px;
  font-family: monospace;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(99,102,241,0.15);
  color: #818cf8;
}

.empty-list { padding: 20px; text-align: center; color: #94a6b8; font-size: 13px; }

/* Main Panel */
.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 20px 24px;
  gap: 18px;
}
.main-panel::-webkit-scrollbar { width: 6px; }
.main-panel::-webkit-scrollbar-thumb { background: #334155; border-radius: 3px; }

/* Placeholder */
.placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #94a6b8;
}
.placeholder-icon { font-size: 36px; }
.placeholder-text { font-size: 16px; }

/* Material header */
.mat-header {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mat-header-top { display: flex; align-items: center; gap: 12px; }
.mat-header-title { font-size: 18px; font-weight: 700; color: #e2e8f0; }
.mat-uom-badge {
  padding: 3px 9px;
  border-radius: 6px;
  background: rgba(99,102,241,0.15);
  color: #818cf8;
  font-size: 12px;
  font-weight: 700;
}
.stock-bar-area { display: flex; flex-direction: column; gap: 8px; }
.stock-labels { display: flex; gap: 20px; flex-wrap: wrap; }
.stock-label { font-size: 12px; color: #94a6b8; }
.stock-label strong { color: #e2e8f0; }
.stock-track {
  height: 6px;
  background: #334155;
  border-radius: 3px;
  overflow: hidden;
}
.stock-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

/* Net req callout */
.net-req {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid;
}
.net-req-warn { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.3); color: #f59e0b; }
.net-req-ok { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.3); color: #22c55e; }

/* Sections */
.section {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  overflow: hidden;
}
.section-title {
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 700;
  color: #94a6b8;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 1px solid #334155;
}

/* Demand table */
.demand-table-wrap { overflow-x: auto; }
.demand-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.demand-table thead th {
  padding: 8px 12px;
  color: #94a6b8;
  font-weight: 600;
  text-align: left;
  border-bottom: 1px solid #334155;
  white-space: nowrap;
}
.demand-table tbody tr { border-bottom: 1px solid rgba(51,65,85,0.4); }
.demand-table tbody tr:hover { background: rgba(99,102,241,0.06); }
.demand-table td { padding: 8px 12px; color: #e2e8f0; vertical-align: middle; }
.td-ref { color: #94a6b8; font-size: 11px; }
.td-mono { font-variant-numeric: tabular-nums; }

.source-badge {
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}
.src-manual { background: rgba(100,116,139,0.2); color: #94a3b8; }
.src-forecast { background: rgba(99,102,241,0.2); color: #818cf8; }
.src-sales { background: rgba(34,197,94,0.2); color: #22c55e; }
.src-prod { background: rgba(245,158,11,0.2); color: #f59e0b; }

.btn-del {
  background: none;
  border: 1px solid rgba(239,68,68,0.3);
  color: #ef4444;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s;
}
.btn-del:hover { background: rgba(239,68,68,0.1); }

.empty-state { padding: 18px 16px; color: #94a6b8; font-size: 13px; }

/* Form */
.demand-form { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.form-row { display: flex; gap: 12px; flex-wrap: wrap; }
.form-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 130px;
}
.form-field-grow { flex: 1; }
.form-field-btn { justify-content: flex-end; }
.form-field label { font-size: 11px; font-weight: 600; color: #94a6b8; text-transform: uppercase; letter-spacing: 0.04em; }
.req { color: #ef4444; }
.form-input, .form-select {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #e2e8f0;
  padding: 7px 10px;
  font-size: 13px;
}
.form-input:focus, .form-select:focus { outline: none; border-color: #6366f1; }
.form-select { cursor: pointer; }

.btn-add {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  background: #6366f1;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.btn-add:hover:not(:disabled) { background: #4f46e5; }
.btn-add:disabled { opacity: 0.6; cursor: not-allowed; }

.form-error { font-size: 12px; color: #ef4444; }
.form-success { font-size: 12px; color: #22c55e; }

.spinner-sm {
  width: 13px; height: 13px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>

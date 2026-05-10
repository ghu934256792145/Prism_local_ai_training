<template>
  <div class="mfg-planner">
    <!-- Stepper nav -->
    <div class="steps">
      <div v-for="(s, i) in steps" :key="i" class="step" :class="{ active: step === i, done: step > i }" @click="step = i">
        <span class="step-num">{{ i + 1 }}</span>
        <span class="step-label">{{ s }}</span>
      </div>
      <router-link to="/projects?industry=mfg" class="projects-badge">Open in Projects →</router-link>
    </div>

    <!-- Step 0: Template picker or manual entry -->
    <section v-if="step === 0" class="panel">
      <h2>BOM Entries</h2>
      <div class="template-row">
        <label>Load template:</label>
        <select v-model="selectedTemplate" @change="loadTemplate">
          <option value="">— blank —</option>
          <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.label }}</option>
        </select>
        <button class="btn-sm" @click="addRow">+ Add row</button>
        <button class="btn-sm danger" @click="clearEntries">Clear</button>
      </div>

      <div class="table-wrap">
        <table class="bom-table">
          <thead>
            <tr>
              <th>Part #</th><th>Description</th><th>Rev</th><th>Parent</th>
              <th>Qty/Parent</th><th>UOM</th><th>Make/Buy</th><th>Cat</th>
              <th>Unit Cost</th><th>Lead (d)</th><th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in entries" :key="i">
              <td><input v-model="row.part_number" class="cell-input" /></td>
              <td><input v-model="row.description" class="cell-input wide" /></td>
              <td><input v-model="row.revision" class="cell-input narrow" /></td>
              <td><input v-model="row.parent" class="cell-input" placeholder="(root)" /></td>
              <td><input v-model.number="row.quantity_per" type="number" min="0" step="0.001" class="cell-input narrow" /></td>
              <td>
                <select v-model="row.unit_of_measure" class="cell-input narrow">
                  <option v-for="u in uoms" :key="u" :value="u">{{ u }}</option>
                </select>
              </td>
              <td>
                <select v-model="row.make_buy" class="cell-input narrow">
                  <option value="make">make</option>
                  <option value="buy">buy</option>
                  <option value="phantom">phantom</option>
                </select>
              </td>
              <td>
                <select v-model="row.category" class="cell-input narrow">
                  <option v-for="(c, ci) in catNames" :key="ci" :value="ci">{{ ci }}-{{ c }}</option>
                </select>
              </td>
              <td><input v-model.number="row.unit_cost" type="number" min="0" step="0.01" class="cell-input narrow" /></td>
              <td><input v-model.number="row.lead_time_days" type="number" min="0" class="cell-input narrow" /></td>
              <td><button class="btn-icon" @click="entries.splice(i, 1)">✕</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Step 1: Explosion settings -->
    <section v-if="step === 1" class="panel">
      <h2>Explosion Settings</h2>
      <div class="form-grid">
        <label>Root part number</label>
        <select v-model="rootPart">
          <option v-for="e in rootCandidates" :key="e" :value="e">{{ e }}</option>
        </select>
        <label>Top-level quantity</label>
        <input v-model.number="topQty" type="number" min="1" step="1" />
        <label>Include phantom assemblies</label>
        <input v-model="includePhantoms" type="checkbox" />
      </div>
      <div class="action-row">
        <button class="btn" @click="runExplosion" :disabled="loading">
          {{ loading ? 'Calculating…' : 'Explode BOM' }}
        </button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <!-- Step 2: Results -->
    <section v-if="step === 2" class="panel" ref="resultsPanel">
      <template v-if="result">
        <div class="kpi-row">
          <div class="kpi"><span class="kpi-val">{{ result.total_line_items }}</span><span class="kpi-lbl">Line Items</span></div>
          <div class="kpi"><span class="kpi-val">{{ result.unique_parts }}</span><span class="kpi-lbl">Unique Parts</span></div>
          <div class="kpi"><span class="kpi-val">{{ fmt(result.total_cost) }}</span><span class="kpi-lbl">Total Cost</span></div>
          <div class="kpi"><span class="kpi-val">{{ result.critical_path_days }}d</span><span class="kpi-lbl">Critical Path</span></div>
          <div class="kpi"><span class="kpi-val text-warn">{{ result.critical_parts }}</span><span class="kpi-lbl">Critical Parts</span></div>
          <div class="kpi"><span class="kpi-val">{{ result.make_count }}</span><span class="kpi-lbl">Make</span></div>
          <div class="kpi"><span class="kpi-val">{{ result.buy_count }}</span><span class="kpi-lbl">Buy</span></div>
        </div>

        <div class="tabs">
          <button :class="{ active: tab === 'indented' }" @click="tab = 'indented'">Indented BOM</button>
          <button :class="{ active: tab === 'flat' }" @click="tab = 'flat'">Flat / Purchase List</button>
          <button :class="{ active: tab === 'chart' }" @click="tab = 'chart'">Cost Chart</button>
        </div>

        <!-- Indented BOM -->
        <div v-if="tab === 'indented'" class="table-wrap">
          <table class="bom-table result-table">
            <thead><tr><th>Lvl</th><th>Part #</th><th>Description</th><th>Rev</th><th>Qty Ext</th><th>UOM</th><th>Make/Buy</th><th>Unit $</th><th>Line $</th><th>Lead</th></tr></thead>
            <tbody>
              <tr v-for="(line, i) in result.indented" :key="i" :class="{ critical: line.critical }">
                <td class="level-cell">
                  <span class="indent" :style="{ marginLeft: line.level * 16 + 'px' }">{{ line.level }}</span>
                </td>
                <td class="mono">{{ line.part_number }}</td>
                <td>{{ line.description }}</td>
                <td class="mono narrow">{{ line.revision }}</td>
                <td class="num">{{ fmtQty(line.quantity_extended) }}</td>
                <td>{{ line.unit_of_measure }}</td>
                <td><span class="tag" :class="line.make_buy">{{ line.make_buy }}</span></td>
                <td class="num">{{ line.unit_cost > 0 ? fmt(line.unit_cost) : '—' }}</td>
                <td class="num">{{ line.line_cost > 0 ? fmt(line.line_cost) : '—' }}</td>
                <td class="num" :class="{ 'text-warn': line.critical }">{{ line.lead_time_days }}d</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Flat BOM -->
        <div v-if="tab === 'flat'" class="table-wrap">
          <table class="bom-table result-table">
            <thead><tr><th>Part #</th><th>Description</th><th>Rev</th><th>Total Qty</th><th>UOM</th><th>Make/Buy</th><th>Unit $</th><th>Total $</th><th>Lead</th></tr></thead>
            <tbody>
              <tr v-for="(line, i) in result.flat" :key="i" :class="{ critical: line.critical }">
                <td class="mono">{{ line.part_number }}</td>
                <td>{{ line.description }}</td>
                <td class="mono narrow">{{ line.revision }}</td>
                <td class="num">{{ fmtQty(line.total_qty) }}</td>
                <td>{{ line.unit_of_measure }}</td>
                <td><span class="tag" :class="line.make_buy">{{ line.make_buy }}</span></td>
                <td class="num">{{ fmt(line.unit_cost) }}</td>
                <td class="num bold">{{ fmt(line.total_cost) }}</td>
                <td class="num" :class="{ 'text-warn': line.critical }">{{ line.lead_time_days }}d</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Cost chart -->
        <div v-if="tab === 'chart'" ref="chartEl" class="chart-box"></div>

        <div class="action-row">
          <button class="btn-sm" @click="exportJson">Export JSON</button>
        </div>
      </template>

      <!-- Push to MRP -->
      <div v-if="result" class="push-mrp-card">
        <div class="push-mrp-header">
          <span class="push-title">Push to MRP</span>
          <span class="push-sub">Create MRP demand records from this BOM explosion</span>
        </div>
        <div class="push-mrp-form">
          <label>Cost Center</label>
          <select v-model="mrpCostCenter">
            <option value="cc-001">CC-MFG — Manufacturing</option>
            <option value="cc-002">CC-PROC — Procurement</option>
            <option value="cc-003">CC-RND — R&D</option>
            <option value="cc-007">CC-LOG — Logistics</option>
          </select>
          <label>Required By</label>
          <input type="date" v-model="mrpDueDate" />
          <label>Source Reference</label>
          <input type="text" v-model="mrpSourceRef" placeholder="e.g. WO-2026-001" />
        </div>
        <button class="btn-push" :disabled="pushingMrp" @click="pushToMrp">
          {{ pushingMrp ? 'Pushing...' : '→ Push to MRP' }}
        </button>
        <div v-if="pushResult" class="push-result" :class="pushResult.ok ? 'ok' : 'err'">
          {{ pushResult.message }}
        </div>
      </div>
    </section>

    <!-- Step 3: Graph visualization -->
    <section v-if="step === 3" class="panel">
      <h2>Component Graph</h2>
      <div class="graph-controls">
        <label>Template graph:</label>
        <select v-model="graphTemplate" @change="loadGraph">
          <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.label }}</option>
        </select>
      </div>
      <div ref="graphEl" class="graph-canvas"></div>
    </section>

    <div class="nav-row">
      <button class="btn" :disabled="step === 0" @click="step--">← Back</button>
      <button class="btn" :disabled="step === steps.length - 1" @click="nextStep">Next →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { usePrismAPI } from '@/composables/usePrismAPI'
import { useSupplyChain } from '@/composables/useSupplyChain'

const api = usePrismAPI()
const { importBomToMrp } = useSupplyChain()

const steps = ['BOM Entries', 'Settings', 'Results', 'Graph']
const step = ref(0)
const tab = ref<'indented'|'flat'|'chart'>('indented')

const uoms = ['ea', 'm', 'kg', 'L', 'm2', 'set', 'lot', 'kit']
const catNames = ['FinishedGood', 'Assembly', 'SubAssembly', 'Purchased', 'RawMaterial', 'Phantom']

interface BomEntry {
  part_number: string; description: string; revision: string; parent: string | null
  quantity_per: number; unit_of_measure: string; make_buy: string; category: number | null
  unit_cost: number; lead_time_days: number
}

interface IndentedLine {
  level: number; part_number: string; description: string; revision: string
  quantity_extended: number; unit_of_measure: string; make_buy: string
  unit_cost: number; line_cost: number; lead_time_days: number; critical: boolean
}

interface FlatLine {
  part_number: string; description: string; revision: string; total_qty: number
  unit_of_measure: string; make_buy: string; unit_cost: number; total_cost: number
  lead_time_days: number; critical: boolean
}

interface ExplosionResult {
  root: string; quantity: number; indented: IndentedLine[]; flat: FlatLine[]
  total_line_items: number; unique_parts: number; total_cost: number
  critical_path_days: number; critical_parts: number; make_count: number; buy_count: number
}

const templates = ref<{ id: string; label: string; description: string }[]>([])
const selectedTemplate = ref('')
const entries = ref<BomEntry[]>([])
const rootPart = ref('')
const topQty = ref(1)
const includePhantoms = ref(false)
const loading = ref(false)
const error = ref('')
const result = ref<ExplosionResult | null>(null)
const graphTemplate = ref('bicycle')

const chartEl = ref<HTMLElement | null>(null)
const graphEl = ref<HTMLElement | null>(null)
let chartInst: echarts.ECharts | null = null
let graphInst: echarts.ECharts | null = null

const rootCandidates = computed(() => {
  const parents = new Set(entries.value.map(e => e.parent).filter(Boolean))
  return entries.value.filter(e => !parents.has(e.part_number) || !e.parent).map(e => e.part_number)
})

onMounted(async () => {
  const data = await api.get<{ templates: typeof templates.value }>('/api/mfg/templates')
  if (data?.templates) {
    templates.value = data.templates
    graphTemplate.value = data.templates[0]?.id ?? 'bicycle'
  }
})

async function loadTemplate() {
  if (!selectedTemplate.value) return
  const data = await api.get<{ entries: BomEntry[] }>(`/api/mfg/template/${selectedTemplate.value}`)
  if (data?.entries) {
    entries.value = data.entries.map(e => ({
      ...e,
      parent: e.parent ?? null,
      category: e.category ?? null,
    }))
    rootPart.value = entries.value.find(e => !e.parent)?.part_number ?? ''
    graphTemplate.value = selectedTemplate.value
  }
}

function addRow() {
  entries.value.push({
    part_number: '', description: '', revision: '', parent: null,
    quantity_per: 1, unit_of_measure: 'ea', make_buy: 'buy',
    category: 3, unit_cost: 0, lead_time_days: 14,
  })
}

function clearEntries() { entries.value = [] }

async function runExplosion() {
  if (!rootPart.value) { error.value = 'Select a root part number first.'; return }
  error.value = ''; loading.value = true
  const payload = {
    entries: entries.value,
    root: rootPart.value,
    quantity: topQty.value,
    include_phantoms: includePhantoms.value,
  }
  result.value = await api.post<ExplosionResult>('/api/mfg/bom/explode', payload)
  loading.value = false
  if (result.value) step.value = 2
}

function nextStep() {
  if (step.value === 0 && entries.value.length > 0) { step.value = 1; return }
  if (step.value === 1) { runExplosion(); return }
  if (step.value < steps.length - 1) step.value++
}

function fmt(v: number) {
  return v ? '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '$0.00'
}
function fmtQty(v: number) {
  return Number.isInteger(v) ? v.toString() : v.toFixed(3)
}

function exportJson() {
  if (!result.value) return
  const blob = new Blob([JSON.stringify(result.value, null, 2)], { type: 'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = `bom-${result.value.root}-explosion.json`; a.click()
}

watch([tab, result], async ([t]) => {
  if (t === 'chart' && result.value?.flat.length) {
    await nextTick()
    renderCostChart()
  }
})

function renderCostChart() {
  if (!chartEl.value || !result.value) return
  if (!chartInst) chartInst = echarts.init(chartEl.value)
  const items = result.value.flat.slice(0, 20)
  chartInst.setOption({
    backgroundColor: '#0d1117',
    tooltip: { trigger: 'axis', formatter: (p: any) => `${p[0].name}<br/>$${p[0].value.toFixed(2)}` },
    grid: { left: '2%', right: '2%', bottom: 120, containLabel: true },
    xAxis: { type: 'category', data: items.map(f => f.part_number), axisLabel: { rotate: 45, color: '#aaa', fontSize: 11 } },
    yAxis: { type: 'value', name: 'Total Cost ($)', axisLabel: { color: '#aaa' } },
    series: [{
      type: 'bar', data: items.map(f => ({ value: f.total_cost, itemStyle: { color: f.critical ? '#ef4444' : '#3b82f6' } })),
    }],
  })
}

watch(step, async (s) => {
  if (s === 3) { await nextTick(); loadGraph() }
})

async function loadGraph() {
  const data = await api.get<any>(`/api/mfg/graph/${graphTemplate.value}`)
  if (!data || !graphEl.value) return
  if (!graphInst) graphInst = echarts.init(graphEl.value)
  const cats = (data.categories as string[]).map((c: string) => ({ name: c }))
  graphInst.setOption({
    backgroundColor: '#0d1117',
    tooltip: { trigger: 'item', formatter: (p: any) => p.data.label || p.name },
    legend: [{ data: cats.map((c: any) => c.name), textStyle: { color: '#aaa' }, top: 10 }],
    series: [{
      type: 'graph', layout: 'force', roam: true, draggable: true,
      categories: cats,
      nodes: data.nodes.map((n: any) => ({
        id: n.id, name: n.id, label: { show: n.symbolSize > 30, formatter: n.label, fontSize: 11 },
        symbolSize: n.symbolSize, category: n.category, value: n.value,
        itemStyle: { opacity: 0.9 },
      })),
      edges: data.edges.map((e: any) => ({
        source: e.source, target: e.target,
        label: { show: false, formatter: e.label },
        lineStyle: { width: e.weight, opacity: 0.6 },
      })),
      force: { repulsion: 200, edgeLength: [80, 180] },
    }],
  })
}

// ── Push to MRP ───────────────────────────────────────────────────────────────

const mrpCostCenter = ref('cc-001')
const mrpDueDate = ref(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
const mrpSourceRef = ref('')
const pushingMrp = ref(false)
const pushResult = ref<{ ok: boolean; message: string } | null>(null)

async function pushToMrp() {
  if (!result.value) return
  pushingMrp.value = true
  pushResult.value = null
  // result.value.flat contains FlatLine entries with part_number, description, total_qty, unit_of_measure, unit_cost
  const entries = (result.value.flat ?? []).map((e: any) => ({
    part_number: e.part_number ?? e.partNumber ?? e.id ?? '',
    description: e.description ?? e.label ?? '',
    total_qty: e.total_qty ?? e.totalQty ?? e.quantity ?? 0,
    uom: e.unit_of_measure ?? e.uom ?? 'EA',
    unit_cost: e.unit_cost ?? e.unitCost ?? 0,
  }))
  const res = await importBomToMrp({
    entries,
    cost_center_id: mrpCostCenter.value,
    due_date: mrpDueDate.value,
    source_ref: mrpSourceRef.value || undefined,
  })
  pushingMrp.value = false
  if (res) {
    pushResult.value = { ok: true, message: `✓ ${Array.isArray(res) ? res.length : 'N'} demand records created in MRP` }
  } else {
    pushResult.value = { ok: false, message: '✗ Push failed — check API connection' }
  }
}
</script>

<style scoped>
.mfg-planner { padding: 24px; color: #e0e0e0; font-family: system-ui, sans-serif; min-height: 100vh; background: #0d1117; }
.steps { display: flex; gap: 4px; margin-bottom: 24px; align-items: center; }
.projects-badge {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: #6366f1;
  border: 1px solid rgba(99,102,241,0.5);
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s;
}
.projects-badge:hover { background: rgba(99,102,241,0.12); }
.step { display: flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 8px; cursor: pointer; background: #161b22; border: 1px solid #30363d; transition: all 0.2s; }
.step.active { background: #1f4e8f; border-color: #3b82f6; }
.step.done { background: #162a1e; border-color: #22c55e; }
.step-num { font-weight: 700; font-size: 13px; }
.step-label { font-size: 13px; }
.panel { background: #161b22; border-radius: 10px; padding: 24px; margin-bottom: 16px; border: 1px solid #30363d; }
h2 { margin: 0 0 16px; font-size: 18px; color: #e0e0e0; }
.template-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
.template-row label { font-size: 13px; color: #aaa; }
select, input[type="number"], input[type="text"] { background: #0d1117; border: 1px solid #30363d; color: #e0e0e0; border-radius: 6px; padding: 6px 10px; font-size: 13px; }
.btn { padding: 9px 20px; border-radius: 8px; background: #3b82f6; color: white; border: none; cursor: pointer; font-size: 14px; font-weight: 600; transition: background 0.2s; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 6px 14px; border-radius: 6px; background: #1f4e8f; color: white; border: none; cursor: pointer; font-size: 12px; }
.btn-sm.danger { background: #7f1d1d; }
.btn-icon { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px; padding: 2px 6px; }
.table-wrap { overflow-x: auto; margin-top: 8px; }
.bom-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.bom-table th { background: #0d1117; padding: 8px 6px; text-align: left; color: #aaa; border-bottom: 1px solid #30363d; white-space: nowrap; }
.bom-table td { padding: 5px 6px; border-bottom: 1px solid #1c2128; vertical-align: middle; }
.bom-table tr:hover td { background: #1c2128; }
.bom-table tr.critical td { background: rgba(239, 68, 68, 0.06); }
.result-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
.result-table .bold { font-weight: 700; }
.cell-input { width: 100%; background: #0d1117; border: 1px solid #30363d; color: #e0e0e0; border-radius: 4px; padding: 4px 6px; font-size: 12px; min-width: 60px; box-sizing: border-box; }
.cell-input.wide { min-width: 160px; }
.cell-input.narrow { min-width: 50px; max-width: 80px; }
.indent { display: inline-block; }
.tag { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
.tag.make { background: #162a1e; color: #22c55e; }
.tag.buy { background: #1e2a3e; color: #3b82f6; }
.tag.phantom { background: #2a1e3e; color: #a78bfa; }
.mono { font-family: 'Courier New', monospace; font-size: 11px; }
.narrow { width: 60px; }
.text-warn { color: #f59e0b; }
.kpi-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.kpi { background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 12px 18px; display: flex; flex-direction: column; align-items: center; min-width: 100px; }
.kpi-val { font-size: 22px; font-weight: 700; color: #3b82f6; }
.kpi-lbl { font-size: 11px; color: #aaa; margin-top: 4px; }
.tabs { display: flex; gap: 4px; margin-bottom: 16px; }
.tabs button { padding: 7px 16px; border-radius: 6px; border: 1px solid #30363d; background: #0d1117; color: #aaa; cursor: pointer; font-size: 13px; transition: all 0.2s; }
.tabs button.active { background: #1f4e8f; color: white; border-color: #3b82f6; }
.chart-box { height: 360px; width: 100%; }
.graph-canvas { height: 520px; width: 100%; background: #0d1117; border-radius: 8px; border: 1px solid #30363d; }
.graph-controls { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; font-size: 13px; }
.form-grid { display: grid; grid-template-columns: 200px 1fr; gap: 12px; align-items: center; max-width: 480px; }
.form-grid label { font-size: 14px; color: #aaa; }
.action-row { display: flex; gap: 12px; margin-top: 20px; align-items: center; }
.error { color: #ef4444; font-size: 13px; margin-top: 8px; }
.nav-row { display: flex; justify-content: space-between; margin-top: 12px; }
.level-cell { text-align: center; color: #6b7280; font-size: 11px; }

/* ── Push to MRP ─────────────────────────────────────────── */
.push-mrp-card {
  margin-top: 16px;
  background: #1e293b;
  border: 1px solid #334155;
  border-left: 3px solid #6366f1;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.push-mrp-header { display: flex; flex-direction: column; gap: 2px; }
.push-title { font-size: 14px; font-weight: 600; color: #e2e8f0; }
.push-sub { font-size: 12px; color: #94a6b8; }
.push-mrp-form { display: grid; grid-template-columns: 120px 1fr; gap: 8px; align-items: center; }
.push-mrp-form label { font-size: 12px; color: #94a6b8; }
.push-mrp-form select, .push-mrp-form input {
  background: #0f172a; border: 1px solid #334155; color: #e2e8f0;
  padding: 6px 8px; border-radius: 4px; font-size: 13px;
}
.btn-push {
  align-self: flex-start;
  background: #6366f1; color: white; border: none;
  padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500;
  cursor: pointer; transition: background 0.15s;
}
.btn-push:hover:not(:disabled) { background: #4f46e5; }
.btn-push:disabled { opacity: 0.5; cursor: default; }
.push-result { font-size: 13px; padding: 8px 10px; border-radius: 6px; }
.push-result.ok { background: rgba(34,197,94,0.12); color: #22c55e; }
.push-result.err { background: rgba(239,68,68,0.12); color: #ef4444; }
</style>

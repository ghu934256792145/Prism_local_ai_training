<template>
  <div class="pipeline-planner">
    <!-- Stepper nav -->
    <div class="steps">
      <div v-for="(s, i) in steps" :key="i" class="step" :class="{ active: step === i, done: step > i }" @click="step = i">
        <span class="step-num">{{ i + 1 }}</span>
        <span class="step-label">{{ s }}</span>
      </div>
      <router-link to="/projects?industry=pipeline" class="projects-badge">Open in Projects →</router-link>
    </div>

    <!-- Step 0: Line list editor -->
    <section v-if="step === 0" class="panel">
      <h2>Pipeline Line List</h2>
      <div class="template-row">
        <label>Load template:</label>
        <select v-model="selectedTemplate" @change="loadTemplate">
          <option value="">— blank —</option>
          <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.label }}</option>
        </select>
        <button class="btn-sm" @click="addLine">+ Add line</button>
        <button class="btn-sm danger" @click="lines = []">Clear</button>
      </div>

      <div class="table-wrap">
        <table class="pip-table">
          <thead>
            <tr>
              <th>Line #</th><th>Service</th><th>From</th><th>To</th>
              <th>DN (mm)</th><th>Sched</th><th>Material</th><th>Insul</th><th>Fluid</th>
              <th>P (barg)</th><th>T (°C)</th><th>L (m)</th>
              <th>90°E</th><th>45°E</th><th>Tees</th><th>Red</th><th>FL</th>
              <th>Gate</th><th>Globe</th><th>Ball</th><th>Bfly</th><th>Check</th><th>Ctrl</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(line, i) in lines" :key="i">
              <td><input v-model="line.line_number" class="ci s" /></td>
              <td><input v-model="line.service" class="ci m" /></td>
              <td><input v-model="line.from_tag" class="ci s" /></td>
              <td><input v-model="line.to_tag" class="ci s" /></td>
              <td>
                <select v-model.number="line.nominal_bore_mm" class="ci s">
                  <option v-for="sz in pipeSizes" :key="sz.dn" :value="sz.dn">DN{{ sz.dn }}</option>
                </select>
              </td>
              <td>
                <select v-model="line.schedule" class="ci s">
                  <option value="SCH10">SCH10</option>
                  <option value="SCH40">SCH40</option>
                  <option value="SCH80">SCH80</option>
                  <option value="SCH160">SCH160</option>
                </select>
              </td>
              <td>
                <select v-model="line.material" class="ci s">
                  <option value="CS">CS</option><option value="SS316L">SS316L</option>
                  <option value="DSS">DSS</option><option value="LTCS">LTCS</option>
                  <option value="HDPE">HDPE</option><option value="GRE">GRE</option>
                </select>
              </td>
              <td><input v-model="line.insulation" class="ci xs" placeholder="H50" /></td>
              <td><input v-model="line.fluid" class="ci s" /></td>
              <td><input v-model.number="line.design_pressure_barg" type="number" step="0.1" class="ci xs" /></td>
              <td><input v-model.number="line.design_temp_c" type="number" step="1" class="ci xs" /></td>
              <td><input v-model.number="line.length_m" type="number" step="0.5" min="0" class="ci xs" /></td>
              <td><input v-model.number="line.elbows_90" type="number" min="0" class="ci xs" /></td>
              <td><input v-model.number="line.elbows_45" type="number" min="0" class="ci xs" /></td>
              <td><input v-model.number="line.tees_equal" type="number" min="0" class="ci xs" /></td>
              <td><input v-model.number="line.reducers" type="number" min="0" class="ci xs" /></td>
              <td><input v-model.number="line.flanged_ends" type="number" min="0" class="ci xs" /></td>
              <td><input v-model.number="line.valves_gate" type="number" min="0" class="ci xs" /></td>
              <td><input v-model.number="line.valves_globe" type="number" min="0" class="ci xs" /></td>
              <td><input v-model.number="line.valves_ball" type="number" min="0" class="ci xs" /></td>
              <td><input v-model.number="line.valves_butterfly" type="number" min="0" class="ci xs" /></td>
              <td><input v-model.number="line.valves_check" type="number" min="0" class="ci xs" /></td>
              <td><input v-model.number="line.valves_control" type="number" min="0" class="ci xs" /></td>
              <td><button class="btn-icon" @click="lines.splice(i,1)">✕</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Step 1: Calculate -->
    <section v-if="step === 1" class="panel">
      <h2>Calculate MTO</h2>
      <p class="hint">{{ lines.length }} line(s) entered. Click Calculate to generate the Material Takeoff.</p>
      <div class="action-row">
        <button class="btn" @click="runMto" :disabled="loading || lines.length === 0">
          {{ loading ? 'Calculating…' : 'Calculate MTO' }}
        </button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>

      <!-- Pipe size reference -->
      <details class="ref-box" open>
        <summary>ASME B36.10M Pipe Size Reference</summary>
        <div class="table-wrap" style="margin-top:8px">
          <table class="pip-table">
            <thead><tr><th>DN</th><th>OD (mm)</th><th>SCH10 t</th><th>SCH40 t</th><th>SCH80 t</th><th>SCH40 kg/m</th><th>SCH80 kg/m</th></tr></thead>
            <tbody>
              <tr v-for="s in pipeSizes" :key="s.dn">
                <td>{{ s.dn }}</td><td>{{ s.od }}</td><td>{{ s.sch10_wall }}</td>
                <td>{{ s.sch40_wall }}</td><td>{{ s.sch80_wall }}</td>
                <td>{{ s.sch40_kgm.toFixed(2) }}</td><td>{{ s.sch80_kgm.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </section>

    <!-- Step 2: Results -->
    <section v-if="step === 2 && mto" class="panel">
      <div class="kpi-row">
        <div class="kpi"><span class="kpi-val">{{ mto.totals.line_count }}</span><span class="kpi-lbl">Lines</span></div>
        <div class="kpi"><span class="kpi-val">{{ mto.totals.total_pipe_m.toFixed(1) }} m</span><span class="kpi-lbl">Total Pipe</span></div>
        <div class="kpi"><span class="kpi-val">{{ fmtKg(mto.totals.total_weight_kg) }}</span><span class="kpi-lbl">Total Weight</span></div>
        <div class="kpi"><span class="kpi-val">{{ mto.totals.flange_count }}</span><span class="kpi-lbl">Flanges</span></div>
        <div class="kpi"><span class="kpi-val">{{ mto.totals.bolt_sets }}</span><span class="kpi-lbl">Bolt Sets</span></div>
        <div class="kpi"><span class="kpi-val">{{ mto.totals.total_valves }}</span><span class="kpi-lbl">Valves</span></div>
        <div class="kpi"><span class="kpi-val">{{ mto.totals.insulation_area_m2.toFixed(1) }} m²</span><span class="kpi-lbl">Insul. Area</span></div>
      </div>

      <div class="tabs">
        <button :class="{ active: tab === 'lines' }" @click="tab = 'lines'">Line Items</button>
        <button :class="{ active: tab === 'summary' }" @click="tab = 'summary'">MTO Summary</button>
        <button :class="{ active: tab === 'chart' }" @click="tab = 'chart'">Weight Chart</button>
      </div>

      <!-- Line items -->
      <div v-if="tab === 'lines'" class="table-wrap">
        <table class="pip-table result-table">
          <thead>
            <tr><th>Line #</th><th>Service</th><th>DN</th><th>OD</th><th>Sched</th><th>Mat</th>
            <th>Class</th><th>L (m)</th><th>Pipe (kg)</th><th>Fit (kg)</th><th>Flanges</th>
            <th>Fl (kg)</th><th>Bolts</th><th>Gaskets</th><th>Valves</th><th>Total (kg)</th><th>Insul (m²)</th></tr>
          </thead>
          <tbody>
            <tr v-for="l in mto.line_items" :key="l.line_number">
              <td class="mono">{{ l.line_number }}</td>
              <td>{{ l.service }}</td>
              <td>{{ l.dn }}</td>
              <td class="num">{{ l.od_mm }}</td>
              <td>{{ l.schedule }}</td>
              <td><span class="mat-tag">{{ l.material }}</span></td>
              <td><span class="class-tag">{{ l.ansi_class }}</span></td>
              <td class="num">{{ l.length_m.toFixed(1) }}</td>
              <td class="num">{{ l.pipe_weight_kg.toFixed(1) }}</td>
              <td class="num">{{ l.fitting_weight_kg.toFixed(1) }}</td>
              <td class="num">{{ l.flange_count }}</td>
              <td class="num">{{ l.flange_weight_kg.toFixed(1) }}</td>
              <td class="num">{{ l.bolt_sets }}</td>
              <td class="num">{{ l.gasket_count }}</td>
              <td class="num">{{ l.total_valves }}</td>
              <td class="num bold">{{ l.total_weight_kg.toFixed(1) }}</td>
              <td class="num">{{ l.insulation_area_m2 != null ? l.insulation_area_m2.toFixed(1) : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- MTO Summary -->
      <div v-if="tab === 'summary'" class="table-wrap">
        <table class="pip-table result-table">
          <thead><tr><th>Category</th><th>Description / Specification</th><th>Qty</th><th>Unit</th><th>Unit wt (kg)</th><th>Total wt (kg)</th></tr></thead>
          <tbody>
            <tr v-for="(s, i) in mto.summary" :key="i">
              <td><span class="cat-tag" :class="s.category.toLowerCase()">{{ s.category }}</span></td>
              <td>{{ s.specification }}</td>
              <td class="num">{{ s.quantity % 1 === 0 ? s.quantity : s.quantity.toFixed(1) }}</td>
              <td>{{ s.unit }}</td>
              <td class="num">{{ s.unit_weight_kg.toFixed(2) }}</td>
              <td class="num bold">{{ s.total_weight_kg.toFixed(1) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Weight chart -->
      <div v-if="tab === 'chart'" ref="chartEl" class="chart-box"></div>

      <div class="action-row">
        <button class="btn-sm" @click="exportJson">Export JSON</button>
      </div>
    </section>

    <!-- Step 3: P&ID Graph -->
    <section v-if="step === 3" class="panel">
      <h2>P&ID Component Graph</h2>
      <div class="graph-controls">
        <label>Template:</label>
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
import { ref, onMounted, watch, nextTick } from 'vue'
import * as echarts from 'echarts'
import { usePrismAPI } from '@/composables/usePrismAPI'

const api = usePrismAPI()

const steps = ['Line List', 'Calculate', 'MTO Results', 'P&ID Graph']
const step = ref(0)
const tab = ref<'lines'|'summary'|'chart'>('lines')

interface PipeLine {
  line_number: string; service: string; from_tag: string; to_tag: string
  nominal_bore_mm: number; schedule: string; material: string; insulation: string | null
  fluid: string; design_pressure_barg: number; design_temp_c: number; length_m: number
  elbows_90: number; elbows_45: number; tees_equal: number; reducers: number
  flanged_ends: number; valves_gate: number; valves_globe: number; valves_ball: number
  valves_butterfly: number; valves_check: number; valves_control: number
}

interface PipeSize { dn: number; od: number; sch10_wall: number; sch40_wall: number; sch80_wall: number; sch40_kgm: number; sch80_kgm: number }

const templates = ref<{ id: string; label: string }[]>([])
const selectedTemplate = ref('')
const pipeSizes = ref<PipeSize[]>([])
const lines = ref<PipeLine[]>([])
const loading = ref(false)
const error = ref('')
const mto = ref<any>(null)
const graphTemplate = ref('water')
const chartEl = ref<HTMLElement | null>(null)
const graphEl = ref<HTMLElement | null>(null)
let chartInst: echarts.ECharts | null = null
let graphInst: echarts.ECharts | null = null

onMounted(async () => {
  const [tData, szData] = await Promise.all([
    api.get<{ templates: typeof templates.value }>('/api/pipeline/templates'),
    api.get<{ sizes: PipeSize[] }>('/api/pipeline/sizes'),
  ])
  if (tData?.templates) { templates.value = tData.templates; graphTemplate.value = tData.templates[0]?.id ?? 'water' }
  if (szData?.sizes) pipeSizes.value = szData.sizes
})

async function loadTemplate() {
  if (!selectedTemplate.value) return
  // Seed example lines matching the chosen template
  const ex = selectedTemplate.value === 'process' ? processExample() : waterExample()
  lines.value = ex
  graphTemplate.value = selectedTemplate.value
}

function waterExample(): PipeLine[] {
  return [
    makeLine('W-001', 'Raw Water Inlet', 'TK-101', 'P-101', 100, 'SCH40', 'CS', null, 'water', 3, 30, 12, 2, 1, 1, 1, 2, 1, 1, 0, 0, 0, 0),
    makeLine('W-002', 'Filter Feed', 'P-101', 'F-101', 100, 'SCH40', 'CS', null, 'water', 4, 30, 8, 1, 0, 1, 0, 2, 0, 0, 2, 0, 1, 1),
    makeLine('W-003', 'Filtered Water', 'F-102', 'T-101', 80, 'SCH40', 'CS', null, 'water', 4, 30, 15, 2, 2, 0, 0, 4, 0, 0, 2, 0, 0, 1),
    makeLine('W-004', 'Distribution Main', 'TK-102', 'P-102', 150, 'SCH40', 'CS', null, 'water', 5, 25, 20, 4, 2, 2, 1, 4, 2, 2, 2, 0, 2, 1),
  ]
}

function processExample(): PipeLine[] {
  return [
    makeLine('P-001', 'Feed Line', 'V-101', 'P-101A', 50, 'SCH40', 'CS', 'H50', 'crude_oil', 8, 80, 10, 2, 0, 1, 0, 2, 1, 0, 1, 0, 1, 1),
    makeLine('P-002', 'Pump Discharge', 'P-101A', 'E-101', 50, 'SCH80', 'CS', 'H50', 'crude_oil', 15, 120, 12, 2, 2, 0, 1, 4, 1, 1, 1, 0, 1, 1),
    makeLine('P-003', 'Reactor Feed', 'E-101', 'R-101', 65, 'SCH80', 'SS316L', 'H75', 'mixed', 12, 180, 8, 2, 1, 1, 0, 4, 0, 1, 1, 0, 0, 2),
    makeLine('P-004', 'Reactor Effluent', 'R-101', 'E-102', 80, 'SCH80', 'SS316L', 'C50', 'product', 10, 200, 6, 1, 0, 1, 0, 4, 1, 0, 0, 0, 1, 1),
    makeLine('P-005', 'Product Discharge', 'V-102', 'V-103', 80, 'SCH40', 'SS316L', null, 'product', 8, 80, 25, 3, 2, 1, 1, 6, 1, 1, 2, 0, 1, 2),
  ]
}

function makeLine(
  line_number: string, service: string, from_tag: string, to_tag: string,
  dn: number, schedule: string, material: string, insulation: string | null, fluid: string,
  p: number, t: number, l: number,
  e90: number, e45: number, tee: number, red: number, fl: number,
  gate: number, globe: number, ball: number, bfly: number, check: number, ctrl: number
): PipeLine {
  return {
    line_number, service, from_tag, to_tag, nominal_bore_mm: dn,
    schedule, material, insulation, fluid,
    design_pressure_barg: p, design_temp_c: t, length_m: l,
    elbows_90: e90, elbows_45: e45, tees_equal: tee, reducers: red, flanged_ends: fl,
    valves_gate: gate, valves_globe: globe, valves_ball: ball,
    valves_butterfly: bfly, valves_check: check, valves_control: ctrl,
  }
}

function addLine() {
  lines.value.push(makeLine(
    `L-${String(lines.value.length + 1).padStart(3, '0')}`, '', 'TAG-1', 'TAG-2',
    100, 'SCH40', 'CS', null, 'water',
    5, 30, 10, 0, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0,
  ))
}

async function runMto() {
  error.value = ''; loading.value = true
  mto.value = await api.post<any>('/api/pipeline/mto', { lines: lines.value })
  loading.value = false
  if (mto.value) step.value = 2
}

function nextStep() {
  if (step.value === 0 && lines.value.length > 0) { step.value = 1; return }
  if (step.value === 1) { runMto(); return }
  if (step.value < steps.length - 1) step.value++
}

function fmtKg(v: number) { return v >= 1000 ? (v / 1000).toFixed(2) + ' t' : v.toFixed(1) + ' kg' }

function exportJson() {
  if (!mto.value) return
  const blob = new Blob([JSON.stringify(mto.value, null, 2)], { type: 'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
  a.download = 'pipeline-mto.json'; a.click()
}

watch([tab, mto], async ([t]) => {
  if (t === 'chart' && mto.value) { await nextTick(); renderChart() }
})

function renderChart() {
  if (!chartEl.value || !mto.value) return
  if (!chartInst) chartInst = echarts.init(chartEl.value)
  const items = mto.value.summary.slice(0, 20)
  const colors: Record<string, string> = { Pipe: '#3b82f6', Flange: '#22c55e', Fastener: '#f59e0b' }
  chartInst.setOption({
    backgroundColor: '#0d1117',
    tooltip: { trigger: 'axis' },
    grid: { left: '2%', right: '2%', bottom: 140, containLabel: true },
    xAxis: { type: 'category', data: items.map((s: any) => s.specification.slice(0, 28)), axisLabel: { rotate: 50, color: '#aaa', fontSize: 10 } },
    yAxis: { type: 'value', name: 'Weight (kg)', axisLabel: { color: '#aaa' } },
    series: [{
      type: 'bar',
      data: items.map((s: any) => ({ value: s.total_weight_kg, itemStyle: { color: colors[s.category] ?? '#6b7280' } })),
    }],
  })
}

watch(step, async (s) => {
  if (s === 3) { await nextTick(); loadGraph() }
})

async function loadGraph() {
  const data = await api.get<any>(`/api/pipeline/graph/${graphTemplate.value}`)
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
        id: n.id, name: n.id, label: { show: true, formatter: n.label, fontSize: 11 },
        symbolSize: n.symbolSize, category: n.category, value: n.value,
      })),
      edges: data.edges.map((e: any) => ({
        source: e.source, target: e.target,
        label: { show: true, formatter: e.label, fontSize: 9, color: '#888' },
        lineStyle: { width: e.weight * 0.7, opacity: 0.65 },
      })),
      force: { repulsion: 250, edgeLength: [80, 200] },
    }],
  })
}
</script>

<style scoped>
.pipeline-planner { padding: 24px; color: #e0e0e0; font-family: system-ui, sans-serif; min-height: 100vh; background: #0d1117; }
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
select, input[type="number"], input[type="text"] { background: #0d1117; border: 1px solid #30363d; color: #e0e0e0; border-radius: 6px; padding: 5px 8px; font-size: 12px; }
.btn { padding: 9px 20px; border-radius: 8px; background: #3b82f6; color: white; border: none; cursor: pointer; font-size: 14px; font-weight: 600; transition: background 0.2s; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-sm { padding: 6px 14px; border-radius: 6px; background: #1f4e8f; color: white; border: none; cursor: pointer; font-size: 12px; }
.btn-sm.danger { background: #7f1d1d; }
.btn-icon { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 14px; padding: 2px 6px; }
.table-wrap { overflow-x: auto; margin-top: 8px; }
.pip-table { width: 100%; border-collapse: collapse; font-size: 12px; white-space: nowrap; }
.pip-table th { background: #0d1117; padding: 7px 5px; text-align: left; color: #aaa; border-bottom: 1px solid #30363d; }
.pip-table td { padding: 4px 5px; border-bottom: 1px solid #1c2128; vertical-align: middle; }
.pip-table tr:hover td { background: #1c2128; }
.result-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
.result-table .bold { font-weight: 700; }
.ci { background: #0d1117; border: 1px solid #30363d; color: #e0e0e0; border-radius: 4px; padding: 3px 5px; font-size: 11px; }
.ci.xs { width: 44px; }
.ci.s  { width: 70px; }
.ci.m  { width: 110px; }
.mono { font-family: 'Courier New', monospace; font-size: 11px; }
.mat-tag { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; background: #1e2a3e; color: #3b82f6; }
.class-tag { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; background: #2a1e1e; color: #f59e0b; }
.cat-tag { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
.cat-tag.pipe { background: #1e2a3e; color: #3b82f6; }
.cat-tag.flange { background: #162a1e; color: #22c55e; }
.cat-tag.fastener { background: #2a2a1e; color: #f59e0b; }
.kpi-row { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.kpi { background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 12px 18px; display: flex; flex-direction: column; align-items: center; min-width: 110px; }
.kpi-val { font-size: 20px; font-weight: 700; color: #3b82f6; }
.kpi-lbl { font-size: 11px; color: #aaa; margin-top: 4px; }
.tabs { display: flex; gap: 4px; margin-bottom: 16px; }
.tabs button { padding: 7px 16px; border-radius: 6px; border: 1px solid #30363d; background: #0d1117; color: #aaa; cursor: pointer; font-size: 13px; transition: all 0.2s; }
.tabs button.active { background: #1f4e8f; color: white; border-color: #3b82f6; }
.chart-box { height: 380px; width: 100%; }
.graph-canvas { height: 540px; width: 100%; background: #0d1117; border-radius: 8px; border: 1px solid #30363d; }
.graph-controls { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; font-size: 13px; }
.action-row { display: flex; gap: 12px; margin-top: 20px; align-items: center; }
.error { color: #ef4444; font-size: 13px; margin-top: 8px; }
.nav-row { display: flex; justify-content: space-between; margin-top: 12px; }
.hint { color: #aaa; font-size: 13px; margin-bottom: 16px; }
.ref-box { border: 1px solid #30363d; border-radius: 8px; padding: 12px 16px; margin-top: 20px; font-size: 13px; }
.ref-box summary { cursor: pointer; color: #aaa; font-weight: 600; }
</style>

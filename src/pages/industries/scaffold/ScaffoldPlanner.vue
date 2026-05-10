<template>
  <div class="scaffold-planner">

    <!-- ── Step nav ──────────────────────────────────────────────────────────── -->
    <div class="step-nav">
      <button v-for="s in STEPS" :key="s.n" class="step-btn"
        :class="{ active: step === s.n, done: step > s.n }"
        @click="step = s.n">
        <span class="step-circle">{{ step > s.n ? '✓' : s.n }}</span>
        <span class="step-label">{{ s.label }}</span>
      </button>
      <router-link to="/projects?industry=scaffold" class="projects-badge">Open in Projects →</router-link>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- STEP 1 — Building definition                                          -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div v-if="step === 1" class="step-body">
      <div class="step-header">
        <h2>1 — Building Dimensions</h2>
        <div class="input-mode-toggle">
          <button class="chip" :class="{ active: inputMode === 'manual' }" @click="inputMode = 'manual'">Manual</button>
          <button class="chip" :class="{ active: inputMode === 'image'  }" @click="inputMode = 'image'">Image ruler</button>
        </div>
      </div>

      <!-- Manual face list -->
      <div v-if="inputMode === 'manual'" class="faces-panel">
        <div class="sp-hint">Define one or more scaffold faces (e.g. North, South, East, West).</div>
        <div v-for="(face, i) in faces" :key="i" class="face-row">
          <input v-model="face.label" class="form-input" style="width:90px" placeholder="label" />
          <label class="face-dim">L <input v-model.number="face.length" type="number" min="0.1" step="0.1" class="form-input dim-input" /> m</label>
          <label class="face-dim">H <input v-model.number="face.height" type="number" min="0.1" step="0.1" class="form-input dim-input" /> m</label>
          <button class="btn-icon danger" @click="faces.splice(i, 1)" :disabled="faces.length < 2">✕</button>
        </div>
        <button class="chip" style="margin-top:6px" @click="faces.push({ label: `Face ${faces.length + 1}`, length: 10, height: 6 })">+ Add face</button>
      </div>

      <!-- Image ruler -->
      <div v-if="inputMode === 'image'" class="image-ruler-panel">
        <div class="ruler-toolbar">
          <label class="chip">
            Upload image
            <input type="file" accept="image/*" style="display:none" @change="onImagePick" />
          </label>
          <template v-if="imgLoaded">
            <button class="chip" :class="{ active: drawMode === 'scale' }" @click="setMode('scale')" title="Draw a line over a known distance, then enter its real length">
              📏 Set scale
            </button>
            <button class="chip" :class="{ active: drawMode === 'L' }" @click="setMode('L')" :disabled="!scaleSet">→ Mark Length</button>
            <button class="chip" :class="{ active: drawMode === 'H' }" @click="setMode('H')" :disabled="!scaleSet">↕ Mark Height</button>
            <button class="chip" @click="clearLines">↺ Clear</button>
          </template>
          <span v-if="scaleSet" class="stat-chip">Scale: {{ pxPerM.toFixed(1) }} px/m</span>
        </div>

        <!-- Measured values display -->
        <div v-if="imgLoaded" class="meas-display">
          <span class="meas-badge" :class="{ set: measL }">L: {{ measL ? measL.toFixed(2) + ' m' : '—' }}</span>
          <span class="meas-badge" :class="{ set: measH }">H: {{ measH ? measH.toFixed(2) + ' m' : '—' }}</span>
        </div>

        <!-- Canvas -->
        <div class="canvas-wrap" :class="{ 'draw-cursor': drawMode !== 'none' }">
          <canvas ref="rulerCanvasEl"
            @mousedown="onRulerDown"
            @mousemove="onRulerMove"
            @mouseup="onRulerUp"
            @mouseleave="onRulerLeave"
          />
          <div v-if="!imgLoaded" class="canvas-placeholder">Upload an image to start measuring</div>
        </div>

        <!-- Scale dialog -->
        <div v-if="scaleDialogOpen" class="dialog-overlay">
          <div class="dialog-box">
            <div class="dialog-title">Set scale reference</div>
            <div class="dialog-hint">The line you drew spans how many metres?</div>
            <input ref="scaleInputEl" v-model.number="scaleDialogValue" type="number" min="0.01" step="0.1"
              class="form-input" placeholder="e.g. 5.0" @keyup.enter="confirmScale" />
            <div class="dialog-actions">
              <button class="chip danger" @click="scaleDialogOpen = false">Cancel</button>
              <button class="chip" @click="confirmScale" :disabled="!scaleDialogValue">Confirm</button>
            </div>
          </div>
        </div>

        <!-- Transfer to faces -->
        <div v-if="measL && measH" style="margin-top:10px" class="chip-row">
          <button class="chip" @click="applyImageMeasurements">Apply L={{ measL!.toFixed(2) }}m H={{ measH!.toFixed(2) }}m to Face 1</button>
        </div>
      </div>

      <div class="step-footer">
        <button class="btn-primary" @click="step = 2" :disabled="faces.length === 0">Next: System →</button>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- STEP 2 — Scaffold system & config                                     -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div v-if="step === 2" class="step-body">
      <h2>2 — Scaffold System</h2>

      <div class="system-cards">
        <div v-for="sys in systems" :key="sys.id" class="sys-card"
          :class="{ active: config.system === sys.id }"
          @click="selectSystem(sys)">
          <div class="sys-name">{{ sys.label }}</div>
          <div class="sys-desc text-muted">{{ sys.description }}</div>
          <div class="sys-meta text-secondary">Bay: {{ sys.default_bay_width }}m · Lift: {{ sys.default_lift_height }}m</div>
          <div class="sys-connector text-secondary">{{ sys.connector }}</div>
        </div>
      </div>

      <div class="config-params">
        <div class="param-row">
          <label>Bay width</label>
          <select v-model.number="config.bayWidth" class="ctrl-select">
            <option v-for="w in activeSys?.bay_widths ?? []" :key="w" :value="w">{{ w }} m</option>
          </select>
          <span class="range-val">{{ config.bayWidth }} m</span>
        </div>
        <div class="param-row">
          <label>Lift height</label>
          <select v-model.number="config.liftHeight" class="ctrl-select">
            <option v-for="h in activeSys?.lift_heights ?? []" :key="h" :value="h">{{ h }} m</option>
          </select>
          <span class="range-val">{{ config.liftHeight }} m</span>
        </div>
        <div class="param-row">
          <label>Working width</label>
          <select v-model.number="config.workingWidth" class="ctrl-select">
            <option :value="0.6">0.6 m (2-board)</option>
            <option :value="0.9">0.9 m (3-board)</option>
            <option :value="1.2">1.2 m (4-board)</option>
            <option :value="1.35">1.35 m (5-board)</option>
          </select>
        </div>
        <div class="param-row">
          <label>Boards per bay</label>
          <input v-model.number="config.boardsPerBay" type="number" min="2" max="6" class="form-input" style="width:60px" />
        </div>
      </div>

      <div class="step-footer">
        <button class="chip" @click="step = 1">← Back</button>
        <button class="btn-primary" @click="runCalculation">Calculate BOM →</button>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- STEP 3 — Bill of Materials                                            -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div v-if="step === 3" class="step-body">
      <h2>3 — Bill of Materials</h2>

      <div v-if="calculating" class="loading-msg">Calculating…</div>
      <template v-else-if="bom">
        <!-- Summary cards -->
        <div class="summary-grid">
          <div class="sum-card">
            <div class="sum-val">{{ bom.summary.total_bays }}</div>
            <div class="sum-label">Total bays</div>
          </div>
          <div class="sum-card">
            <div class="sum-val">{{ bom.summary.total_lifts }}</div>
            <div class="sum-label">Lifts</div>
          </div>
          <div class="sum-card">
            <div class="sum-val">{{ bom.summary.scaffold_area_m2.toFixed(0) }} m²</div>
            <div class="sum-label">Scaffold area</div>
          </div>
          <div class="sum-card">
            <div class="sum-val">{{ bom.summary.face_area_m2.toFixed(0) }} m²</div>
            <div class="sum-label">Face area</div>
          </div>
          <div class="sum-card highlight">
            <div class="sum-val">{{ (bom.summary.total_weight_kg / 1000).toFixed(1) }} t</div>
            <div class="sum-label">Total weight</div>
          </div>
          <div class="sum-card">
            <div class="sum-val">{{ bom.summary.truck_loads.toFixed(1) }}</div>
            <div class="sum-label">Truck loads (25t)</div>
          </div>
        </div>

        <!-- BOM table -->
        <div class="bom-table-wrap">
          <table class="bom-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Description</th>
                <th>Category</th>
                <th class="num">Qty</th>
                <th class="num">Unit (kg)</th>
                <th class="num">Total (kg)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in bom.items" :key="item.id" :class="`cat-${item.category.toLowerCase().replace(/\s/g,'_')}`">
                <td class="comp-name">{{ item.component }}</td>
                <td class="text-muted">{{ item.description }}</td>
                <td><span class="cat-badge" :style="{ background: catColor(item.category) }">{{ item.category }}</span></td>
                <td class="num">{{ item.quantity.toLocaleString() }}</td>
                <td class="num">{{ item.unit_weight_kg.toFixed(2) }}</td>
                <td class="num bold">{{ item.total_weight_kg.toFixed(0) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5" class="bold">TOTAL</td>
                <td class="num bold">{{ bom.total_weight_kg.toFixed(0) }} kg</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Weight by category pie (quick visual) -->
        <div class="bom-chart-row">
          <div class="bom-cat-bars">
            <div v-for="item in bom.items" :key="item.id" class="cat-bar-row">
              <span class="cat-bar-label">{{ item.component }}</span>
              <div class="cat-bar-track">
                <div class="cat-bar-fill"
                  :style="{ width: (item.total_weight_kg / bom.summary.total_weight_kg * 100).toFixed(1) + '%',
                            background: catColor(item.category) }" />
              </div>
              <span class="cat-bar-pct">{{ (item.total_weight_kg / bom.summary.total_weight_kg * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>

        <div class="step-footer">
          <button class="chip" @click="step = 2">← Back</button>
          <button class="chip" @click="exportBOM">↓ Export JSON</button>
          <button class="btn-primary" @click="goVisualize">Visualize →</button>
        </div>
      </template>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- STEP 4 — Visualization                                                -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div v-if="step === 4" class="step-body">
      <h2>4 — Visualization</h2>

      <div class="viz-tabs">
        <button class="chip" :class="{ active: vizTab === 'schematic' }" @click="vizTab = 'schematic'; nextTick(drawSchematic)">2D Elevation</button>
        <button class="chip" :class="{ active: vizTab === 'graph' }"     @click="vizTab = 'graph';     nextTick(loadComponentGraph)">Component Graph</button>
        <div style="flex:1" />
        <select v-if="vizTab === 'graph'" v-model="graphSystem" @change="loadComponentGraph" class="ctrl-select">
          <option v-for="s in systems" :key="s.id" :value="s.id">{{ s.label }}</option>
        </select>
      </div>

      <!-- 2D Elevation schematic -->
      <div v-show="vizTab === 'schematic'" class="schematic-wrap">
        <div class="schematic-legend">
          <span class="legend-dot" style="background:#5794f2">■ Standard</span>
          <span class="legend-dot" style="background:#73bf69">— Ledger</span>
          <span class="legend-dot" style="background:#b0975a">█ Board</span>
          <span class="legend-dot" style="background:#f2495c">— Guard rail</span>
          <span class="legend-dot" style="background:#ff9830">╱ Brace</span>
          <span class="legend-dot" style="background:#fade2a">● Base plate</span>
        </div>
        <div class="face-selector chip-row" v-if="bom && bom.faces.length > 1">
          <button v-for="(f, i) in bom!.faces" :key="i" class="chip"
            :class="{ active: schematicFace === i }"
            @click="schematicFace = i; nextTick(drawSchematic)">{{ f.label }}</button>
        </div>
        <canvas ref="schematicEl" class="schematic-canvas" />
      </div>

      <!-- Component graph -->
      <div v-show="vizTab === 'graph'" ref="compGraphEl" class="comp-graph" />

      <div class="step-footer">
        <button class="chip" @click="step = 3">← BOM</button>
        <button class="chip" @click="saveToWorkbench">↓ Save to Workbench</button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, nextTick, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'
import { usePrismAPI } from '@/composables/usePrismAPI'
import { useWorkbenchStore } from '@/stores/workbenchStore'

const api = usePrismAPI()
const wbStore = useWorkbenchStore()

// ── Steps ─────────────────────────────────────────────────────────────────────
const STEPS = [
  { n: 1, label: 'Building' },
  { n: 2, label: 'System' },
  { n: 3, label: 'BOM' },
  { n: 4, label: 'Visualize' },
]
const step = ref(1)

// ── Building faces ────────────────────────────────────────────────────────────
interface FaceSpec { label: string; length: number; height: number }
const faces = ref<FaceSpec[]>([
  { label: 'North', length: 20, height: 8 },
  { label: 'South', length: 20, height: 8 },
])
const inputMode = ref<'manual' | 'image'>('manual')

// ── Image ruler state ─────────────────────────────────────────────────────────
const rulerCanvasEl  = ref<HTMLCanvasElement | null>(null)
const scaleInputEl   = ref<HTMLInputElement | null>(null)
const imgLoaded      = ref(false)
const imgEl          = new Image()
const drawMode       = ref<'none' | 'scale' | 'L' | 'H'>('none')
const isDrawing      = ref(false)
const p0             = ref({ x: 0, y: 0 })
const p1             = ref({ x: 0, y: 0 })

// Scale
const scalePixels    = ref(0)
const scaleMeters    = ref(1)
const pxPerM         = computed(() => scalePixels.value > 0 ? scalePixels.value / scaleMeters.value : 0)
const scaleSet       = computed(() => scalePixels.value > 0)
const scaleDialogOpen = ref(false)
const scaleDialogValue = ref<number | null>(null)
const pendingScalePx  = ref(0)

// Measurements
const measL = ref<number | null>(null)
const measH = ref<number | null>(null)

interface RulerLine { mode: string; p0: {x:number;y:number}; p1: {x:number;y:number}; color: string }
const rulerLines = ref<RulerLine[]>([])

const LINE_COLORS: Record<string, string> = {
  scale: '#fade2a', L: '#73bf69', H: '#5794f2',
}

// ── System config ─────────────────────────────────────────────────────────────
interface SystemSpec {
  id: string; label: string; description: string
  default_bay_width: number; default_lift_height: number
  bay_widths: number[]; lift_heights: number[]
  connector: string
}
const systems    = ref<SystemSpec[]>([])
const config     = reactive({
  system: 'ringlock', bayWidth: 2.57, liftHeight: 2.0,
  workingWidth: 0.9, boardsPerBay: 3,
})
const activeSys  = computed(() => systems.value.find(s => s.id === config.system))

// ── BOM result ────────────────────────────────────────────────────────────────
interface BOMItem {
  id: string; component: string; description: string
  quantity: number; unit: string
  unit_weight_kg: number; total_weight_kg: number; category: string
}
interface BOMSummary {
  total_bays: number; total_lifts: number; total_standards: number
  scaffold_area_m2: number; face_area_m2: number; total_weight_kg: number; truck_loads: number
}
interface ScaffoldBOM {
  system: string; faces: FaceSpec[]
  bay_width: number; lift_height: number
  items: BOMItem[]; total_weight_kg: number; summary: BOMSummary
}
const bom        = ref<ScaffoldBOM | null>(null)
const calculating = ref(false)

// ── Visualization ─────────────────────────────────────────────────────────────
const vizTab      = ref<'schematic' | 'graph'>('schematic')
const schematicEl = ref<HTMLCanvasElement | null>(null)
const compGraphEl = ref<HTMLElement | null>(null)
const schematicFace = ref(0)
const graphSystem = ref('ringlock')
let compChart: echarts.ECharts | null = null

// ── Category colours ──────────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  Structural: '#5794f2', Platform: '#b0975a', Safety: '#f2495c',
  Foundation: '#fade2a', Access: '#73bf69', Connector: '#b877d9', Anchoring: '#ff9830',
}
function catColor(cat: string) { return CAT_COLORS[cat] ?? '#555a6e' }

// ── API helpers ───────────────────────────────────────────────────────────────
async function fetchSystems() {
  const res = await api.get<{ systems: SystemSpec[] }>('/scaffold/systems')
  if (res) {
    systems.value = res.systems
    if (res.systems.length) selectSystem(res.systems[0])
  }
}

function selectSystem(sys: SystemSpec) {
  config.system = sys.id
  config.bayWidth = sys.default_bay_width
  config.liftHeight = sys.default_lift_height
  graphSystem.value = sys.id
}

async function runCalculation() {
  calculating.value = true
  step.value = 3
  const payload = {
    system: config.system,
    faces: faces.value.map(f => ({ label: f.label, length: f.length, height: f.height })),
    bay_width: config.bayWidth,
    lift_height: config.liftHeight,
    working_width: config.workingWidth,
    boards_per_bay: config.boardsPerBay,
  }
  const res = await api.post<ScaffoldBOM>('/scaffold/calculate', payload)
  if (res) bom.value = res
  calculating.value = false
}

// ── Image ruler ───────────────────────────────────────────────────────────────
function onImagePick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  imgEl.onload = () => {
    imgLoaded.value = true
    resizeRulerCanvas()
    renderRuler()
  }
  imgEl.src = url
}

function resizeRulerCanvas() {
  const canvas = rulerCanvasEl.value
  if (!canvas) return
  const container = canvas.parentElement!
  const scale = Math.min(container.clientWidth / imgEl.width, 500 / imgEl.height)
  canvas.width  = imgEl.width  * scale
  canvas.height = imgEl.height * scale
}

function canvasPoint(e: MouseEvent): { x: number; y: number } {
  const rect = rulerCanvasEl.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function setMode(m: typeof drawMode.value) {
  drawMode.value = drawMode.value === m ? 'none' : m
  isDrawing.value = false
}

function clearLines() {
  rulerLines.value = []
  measL.value = null
  measH.value = null
  scalePixels.value = 0
  renderRuler()
}

function onRulerDown(e: MouseEvent) {
  if (drawMode.value === 'none') return
  isDrawing.value = true
  p0.value = canvasPoint(e)
  p1.value = { ...p0.value }
}

function onRulerMove(e: MouseEvent) {
  if (!isDrawing.value) return
  p1.value = canvasPoint(e)
  renderRuler()
}

function onRulerUp(e: MouseEvent) {
  if (!isDrawing.value) return
  isDrawing.value = false
  p1.value = canvasPoint(e)
  const dist = Math.hypot(p1.value.x - p0.value.x, p1.value.y - p0.value.y)
  if (dist < 5) { renderRuler(); return }

  const mode = drawMode.value
  if (mode === 'scale') {
    pendingScalePx.value = dist
    scaleDialogValue.value = null
    scaleDialogOpen.value = true
    nextTick(() => scaleInputEl.value?.focus())
  } else {
    const m = dist / pxPerM.value
    rulerLines.value.push({ mode, p0: { ...p0.value }, p1: { ...p1.value }, color: LINE_COLORS[mode] })
    if (mode === 'L') measL.value = m
    if (mode === 'H') measH.value = m
    drawMode.value = 'none'
  }
  renderRuler()
}

function onRulerLeave() {
  if (isDrawing.value) { isDrawing.value = false; renderRuler() }
}

function confirmScale() {
  if (!scaleDialogValue.value || scaleDialogValue.value <= 0) return
  scalePixels.value = pendingScalePx.value
  scaleMeters.value = scaleDialogValue.value
  rulerLines.value.push({ mode: 'scale', p0: { ...p0.value }, p1: { ...p1.value }, color: LINE_COLORS.scale })
  scaleDialogOpen.value = false
  drawMode.value = 'none'
  renderRuler()
}

function renderRuler() {
  const canvas = rulerCanvasEl.value
  if (!canvas || !imgLoaded.value) return
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height)

  const drawLine = (pa: {x:number;y:number}, pb: {x:number;y:number}, color: string, label: string, dashed = false) => {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    if (dashed) ctx.setLineDash([6, 3])
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = 3
    ctx.beginPath()
    ctx.moveTo(pa.x, pa.y)
    ctx.lineTo(pb.x, pb.y)
    ctx.stroke()
    ctx.setLineDash([])
    // End markers
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(pa.x, pa.y, 4, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(pb.x, pb.y, 4, 0, Math.PI * 2); ctx.fill()
    // Label
    if (label) {
      const mx = (pa.x + pb.x) / 2
      const my = (pa.y + pb.y) / 2 - 8
      ctx.font = 'bold 12px monospace'
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      ctx.fillText(label, mx + 1, my + 1)
      ctx.fillStyle = color
      ctx.fillText(label, mx, my)
    }
    ctx.restore()
  }

  // Committed lines
  for (const ln of rulerLines.value) {
    const m = ln.mode === 'scale' ? `${scaleMeters.value}m (scale)`
            : ln.mode === 'L'     ? `L=${measL.value?.toFixed(2)}m`
            :                       `H=${measH.value?.toFixed(2)}m`
    drawLine(ln.p0, ln.p1, ln.color, m)
  }

  // Preview while drawing
  if (isDrawing.value) {
    drawLine(p0.value, p1.value, LINE_COLORS[drawMode.value] ?? '#fff', '', true)
  }
}

function applyImageMeasurements() {
  if (!measL.value || !measH.value) return
  faces.value[0].length = Math.round(measL.value * 10) / 10
  faces.value[0].height = Math.round(measH.value * 10) / 10
  inputMode.value = 'manual'
}

// ── 2D Elevation schematic ────────────────────────────────────────────────────
function drawSchematic() {
  const canvas = schematicEl.value
  if (!canvas || !bom.value) return
  const face   = bom.value.faces[schematicFace.value]
  const bays   = Math.ceil(face.length / bom.value.bay_width)
  const lifts  = Math.ceil(face.height / bom.value.lift_height)
  const W = canvas.parentElement?.clientWidth ?? 800
  const H = Math.min(500, W * 0.55)
  canvas.width  = W
  canvas.height = H

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)

  const pad   = { left: 50, right: 20, top: 30, bottom: 40 }
  const drawW = W - pad.left - pad.right
  const drawH = H - pad.top  - pad.bottom
  const bayPx  = drawW / bays
  const liftPx = drawH / lifts

  const ox = pad.left
  const oy = pad.top + drawH   // bottom of scaffold

  // Background
  ctx.fillStyle = '#1a1d26'
  ctx.fillRect(0, 0, W, H)

  // Ground
  ctx.strokeStyle = '#555'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + drawW, oy); ctx.stroke()

  // Boards (platform fill per lift)
  for (let l = 0; l < lifts; l++) {
    const by = oy - (l + 1) * liftPx
    ctx.fillStyle = 'rgba(176, 151, 90, 0.35)'
    ctx.fillRect(ox + 1, by + liftPx * 0.7, drawW - 2, liftPx * 0.18)
  }

  // Guard rails (top of each lift)
  ctx.strokeStyle = '#f2495c'
  ctx.lineWidth = 2
  for (let l = 0; l < lifts; l++) {
    const gy = oy - (l + 1) * liftPx + 4
    ctx.beginPath(); ctx.moveTo(ox, gy); ctx.lineTo(ox + drawW, gy); ctx.stroke()
    // mid rail
    ctx.lineWidth = 1
    const mr = gy + liftPx * 0.4
    ctx.beginPath(); ctx.moveTo(ox, mr); ctx.lineTo(ox + drawW, mr); ctx.stroke()
    ctx.lineWidth = 2
  }

  // Diagonal braces (every 6 bays per lift, orange)
  ctx.strokeStyle = '#ff9830'
  ctx.lineWidth = 1
  for (let l = 0; l < lifts; l++) {
    for (let b = 0; b < bays; b += 6) {
      const x1 = ox + b * bayPx
      const y1 = oy - l * liftPx
      const x2 = ox + Math.min(b + 1, bays) * bayPx
      const y2 = oy - (l + 1) * liftPx
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
    }
  }

  // Ledgers (horizontals — green)
  ctx.strokeStyle = '#73bf69'
  ctx.lineWidth = 1.5
  for (let l = 0; l <= lifts; l++) {
    const ly = oy - l * liftPx
    ctx.beginPath(); ctx.moveTo(ox, ly); ctx.lineTo(ox + drawW, ly); ctx.stroke()
  }

  // Standards (verticals — blue)
  ctx.strokeStyle = '#5794f2'
  ctx.lineWidth = 2
  for (let b = 0; b <= bays; b++) {
    const sx = ox + b * bayPx
    ctx.beginPath(); ctx.moveTo(sx, oy); ctx.lineTo(sx, pad.top); ctx.stroke()
    // Base plates (gold circles)
    ctx.fillStyle = '#fade2a'
    ctx.beginPath(); ctx.arc(sx, oy, 4, 0, Math.PI * 2); ctx.fill()
  }

  // Annotations
  ctx.fillStyle = '#9098b0'
  ctx.font = '10px monospace'
  // Bay labels
  ctx.textAlign = 'center'
  ctx.fillText(`${bom.value.bay_width}m`, ox + bayPx / 2, oy + 18)
  ctx.fillText(`×${bays} bays`, ox + drawW / 2, oy + 30)
  // Lift labels
  ctx.textAlign = 'right'
  for (let l = 0; l < lifts; l++) {
    ctx.fillText(`L${l + 1}`, ox - 4, oy - l * liftPx - liftPx / 2 + 4)
  }
  // Title
  ctx.textAlign = 'left'
  ctx.fillStyle = '#d0d5e6'
  ctx.font = 'bold 11px monospace'
  ctx.fillText(`${face.label} — ${face.length}m × ${face.height}m — ${bom.value.system}`, ox, pad.top - 8)

  // Scale bar
  ctx.fillStyle = '#9098b0'
  ctx.font = '9px monospace'
  ctx.textAlign = 'right'
  ctx.fillText(`${bom.value.bay_width}m/bay`, W - 4, H - 4)
}

// ── Component graph (ECharts) ─────────────────────────────────────────────────
const CAT_NODE_COLORS = ['#5794f2','#b0975a','#f2495c','#fade2a','#73bf69','#b877d9','#ff9830']

async function loadComponentGraph() {
  if (!compGraphEl.value) return
  if (!compChart) {
    compChart = echarts.init(compGraphEl.value, 'dark')
    new ResizeObserver(() => compChart?.resize()).observe(compGraphEl.value)
  }
  const res = await api.get<any>(`/scaffold/graph/${graphSystem.value}`)
  if (!res) return

  const nodes = res.nodes.map((n: any) => ({
    id: n.id,
    name: n.label,
    value: n.value,
    symbolSize: n.symbolSize ?? 28,
    itemStyle: { color: CAT_NODE_COLORS[n.category] ?? '#555' },
    label: { show: true, color: '#d0d5e6', fontSize: 10 },
  }))

  const edges = res.edges.map((e: any) => ({
    source: e.source,
    target: e.target,
    label: { show: true, formatter: e.label, color: '#9098b0', fontSize: 9 },
    lineStyle: { width: Math.max(0.8, e.weight * 0.4), color: '#555a6e' },
  }))

  const cats = (res.categories as string[]).map((c, i) => ({
    name: c, itemStyle: { color: CAT_NODE_COLORS[i] ?? '#555' }
  }))

  compChart.setOption({
    backgroundColor: 'transparent',
    legend: { data: cats.map(c => c.name), textStyle: { color: '#9098b0' }, top: 4, right: 8 },
    series: [{
      type: 'graph', layout: 'force',
      data: nodes, links: edges, categories: cats,
      roam: true, draggable: true,
      force: { repulsion: 280, edgeLength: 120, gravity: 0.04 },
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: 8,
      emphasis: { focus: 'adjacency' },
    }],
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => p.dataType === 'node' ? `<b>${p.name}</b><br>${res.categories[p.data.category ?? 0] ?? ''}` : `${p.data.source} → ${p.data.target}`,
    },
  }, { replaceMerge: ['series'] })
}

// ── Export ────────────────────────────────────────────────────────────────────
function exportBOM() {
  if (!bom.value) return
  const blob = new Blob([JSON.stringify(bom.value, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `scaffold_bom_${bom.value.system}_${Date.now()}.json`
  a.click()
}

function saveToWorkbench() {
  if (!bom.value) return
  const nodes = bom.value.items.map((item, i) => ({
    id: item.id,
    label: item.component,
    category: Object.keys(CAT_COLORS).indexOf(item.category),
    value: Math.round(item.total_weight_kg / 100),
    symbolSize: 28,
  }))
  const edges: any[] = []
  wbStore.seed(nodes, edges, `Scaffold BOM — ${bom.value.system}`)
}

function goVisualize() {
  step.value = 4
  nextTick(() => {
    if (vizTab.value === 'schematic') drawSchematic()
    else loadComponentGraph()
  })
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(fetchSystems)
onUnmounted(() => { compChart?.dispose() })

watch(step, (v) => {
  if (v === 4) nextTick(() => {
    if (vizTab.value === 'schematic') drawSchematic()
    else loadComponentGraph()
  })
})
</script>

<style scoped>
.scaffold-planner {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  background: #12141d;
  color: #d0d5e6;
  padding: 0 0 40px;
}

/* ── Step nav ─────────────────────────────────────────────────────────────── */
.step-nav {
  display: flex;
  gap: 0;
  background: #1a1d2b;
  border-bottom: 1px solid #2a2d3e;
  padding: 0 24px;
}
.step-btn {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 20px;
  background: none; border: none; border-bottom: 2px solid transparent;
  color: #6b7394; cursor: pointer; font-size: 13px;
  transition: color 0.15s, border-color 0.15s;
}
.step-btn.active  { color: #d0d5e6; border-bottom-color: #5794f2; }
.step-btn.done    { color: #73bf69; }
.step-circle {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: #2a2d3e;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: bold;
}
.step-btn.active  .step-circle { background: #5794f2; color: #fff; }
.step-btn.done    .step-circle { background: #73bf69; color: #fff; }

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

/* ── Step body ────────────────────────────────────────────────────────────── */
.step-body {
  max-width: 900px;
  margin: 0 auto;
  padding: 28px 24px;
  width: 100%;
}
.step-body h2 { margin: 0 0 20px; font-size: 18px; color: #d0d5e6; }
.step-header { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; }
.step-header h2 { margin: 0; }
.step-footer { display: flex; gap: 10px; align-items: center; margin-top: 24px; flex-wrap: wrap; }

/* ── Faces ────────────────────────────────────────────────────────────────── */
.faces-panel { display: flex; flex-direction: column; gap: 8px; }
.face-row    { display: flex; align-items: center; gap: 8px; }
.face-dim    { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #9098b0; }
.dim-input   { width: 70px; }

/* ── Image ruler ──────────────────────────────────────────────────────────── */
.image-ruler-panel { display: flex; flex-direction: column; gap: 8px; }
.ruler-toolbar     { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.meas-display      { display: flex; gap: 10px; }
.meas-badge {
  padding: 3px 10px; border-radius: 20px;
  background: #2a2d3e; font-size: 12px; color: #6b7394;
}
.meas-badge.set { color: #73bf69; background: rgba(115,191,105,0.12); }
.canvas-wrap {
  position: relative;
  background: #0d0f18;
  border: 1px solid #2a2d3e;
  border-radius: 6px;
  overflow: hidden;
  min-height: 80px;
}
.canvas-wrap.draw-cursor canvas { cursor: crosshair; }
.canvas-placeholder {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: #4a5070; font-size: 13px;
}

/* Dialog */
.dialog-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.dialog-box {
  background: #1e2130; border: 1px solid #3a3d50; border-radius: 8px;
  padding: 24px; width: 300px;
}
.dialog-title { font-weight: bold; margin-bottom: 6px; }
.dialog-hint  { color: #9098b0; font-size: 12px; margin-bottom: 10px; }
.dialog-actions { display: flex; gap: 8px; margin-top: 14px; justify-content: flex-end; }

/* ── System cards ─────────────────────────────────────────────────────────── */
.system-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
.sys-card {
  border: 1px solid #2a2d3e; border-radius: 8px;
  padding: 14px; cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.sys-card:hover  { border-color: #3a3d50; }
.sys-card.active { border-color: #5794f2; background: rgba(87,148,242,0.08); }
.sys-name        { font-weight: bold; margin-bottom: 4px; }
.sys-desc        { font-size: 11px; margin-bottom: 4px; }
.sys-meta        { font-size: 11px; }
.sys-connector   { font-size: 10px; margin-top: 4px; font-style: italic; }

/* ── Params ───────────────────────────────────────────────────────────────── */
.config-params { display: flex; flex-direction: column; gap: 10px; }
.param-row { display: flex; align-items: center; gap: 10px; }
.param-row label { width: 120px; font-size: 12px; color: #9098b0; }

/* ── Summary cards ────────────────────────────────────────────────────────── */
.summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; margin-bottom: 20px; }
.sum-card {
  background: #1e2130; border: 1px solid #2a2d3e; border-radius: 8px;
  padding: 14px; text-align: center;
}
.sum-card.highlight { border-color: #5794f2; }
.sum-val   { font-size: 22px; font-weight: bold; color: #d0d5e6; }
.sum-label { font-size: 11px; color: #9098b0; margin-top: 3px; }

/* ── BOM table ────────────────────────────────────────────────────────────── */
.bom-table-wrap { overflow-x: auto; margin-bottom: 20px; }
.bom-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.bom-table th { background: #1e2130; color: #9098b0; padding: 8px 10px; text-align: left; border-bottom: 1px solid #2a2d3e; }
.bom-table td { padding: 7px 10px; border-bottom: 1px solid #1e2130; }
.bom-table tfoot td { border-top: 1px solid #2a2d3e; padding-top: 10px; }
.bom-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.bom-table .bold { font-weight: bold; color: #d0d5e6; }
.comp-name { font-weight: 500; }
.cat-badge { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 10px; color: #fff; font-weight: 500; }

/* ── BOM bar chart ────────────────────────────────────────────────────────── */
.bom-chart-row { margin-bottom: 20px; }
.bom-cat-bars  { display: flex; flex-direction: column; gap: 5px; }
.cat-bar-row   { display: flex; align-items: center; gap: 8px; }
.cat-bar-label { width: 160px; font-size: 11px; color: #9098b0; text-align: right; }
.cat-bar-track { flex: 1; height: 10px; background: #2a2d3e; border-radius: 5px; overflow: hidden; }
.cat-bar-fill  { height: 100%; border-radius: 5px; transition: width 0.4s; }
.cat-bar-pct   { width: 42px; font-size: 11px; color: #6b7394; }

/* ── Visualization ────────────────────────────────────────────────────────── */
.viz-tabs { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
.schematic-wrap { display: flex; flex-direction: column; gap: 8px; }
.schematic-legend { display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; color: #9098b0; }
.legend-dot { display: flex; align-items: center; gap: 4px; }
.schematic-canvas { width: 100%; display: block; border: 1px solid #2a2d3e; border-radius: 6px; }
.face-selector { flex-wrap: wrap; }
.comp-graph { height: 520px; border: 1px solid #2a2d3e; border-radius: 6px; }

/* ── Shared chips / form ──────────────────────────────────────────────────── */
.chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 14px;
  background: #2a2d3e; border: 1px solid #3a3d50;
  color: #9098b0; font-size: 12px; cursor: pointer;
}
.chip:hover  { background: #323650; color: #d0d5e6; }
.chip.active { background: rgba(87,148,242,0.2); border-color: #5794f2; color: #5794f2; }
.chip.danger { color: #f2495c; border-color: #f2495c; }
.chip:disabled { opacity: 0.4; cursor: not-allowed; }
.chip-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.btn-primary {
  padding: 7px 18px; border-radius: 6px;
  background: #5794f2; border: none; color: #fff; font-weight: bold; font-size: 13px; cursor: pointer;
}
.btn-primary:hover { background: #6ba3f5; }
.btn-icon { background: none; border: none; cursor: pointer; color: #6b7394; font-size: 13px; padding: 2px 4px; }
.btn-icon:hover       { color: #d0d5e6; }
.btn-icon.danger:hover{ color: #f2495c; }
.form-input {
  background: #1e2130; border: 1px solid #2a2d3e; border-radius: 4px;
  color: #d0d5e6; padding: 5px 8px; font-size: 12px;
}
.form-input:focus { outline: none; border-color: #5794f2; }
.ctrl-select { background: #1e2130; border: 1px solid #2a2d3e; border-radius: 4px; color: #d0d5e6; padding: 5px 8px; font-size: 12px; }
.input-mode-toggle { display: flex; gap: 4px; }
.stat-chip { padding: 2px 8px; border-radius: 10px; background: #1e2130; font-size: 11px; color: #9098b0; }
.text-muted     { color: #9098b0; }
.text-secondary { color: #6b7394; }
.sp-hint { font-size: 12px; color: #9098b0; margin-bottom: 10px; }
.loading-msg { color: #9098b0; padding: 20px 0; text-align: center; }
</style>

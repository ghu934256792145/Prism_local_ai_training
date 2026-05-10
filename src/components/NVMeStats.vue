<template>
  <div class="panel nvme-panel">
    <div class="panel-header">
      <span class="panel-title">NVMe / Engine Stats</span>
      <div style="display:flex;gap:8px;align-items:center">
        <select v-if="devices.length" v-model="selectedDeviceId" class="device-select" title="Disk counter">
          <option v-for="device in devices" :key="device.id" :value="device.id">{{ device.label }}</option>
        </select>
        <select v-model="rangeKey" class="device-select" title="Time range" @change="applyRange">
          <option v-for="r in RANGES" :key="r.key" :value="r.key">{{ r.label }}</option>
        </select>
        <span class="badge badge-cyan">{{ pcieLabel }}</span>
        <span class="badge" :class="isLive ? 'badge-green' : 'badge-orange'">{{ sourceLabel }}</span>
      </div>
    </div>
    <div class="panel-body">
      <div class="stats-grid">
        <div v-for="stat in stats" :key="stat.label" class="stat-card">
          <div class="stat-value" :style="{ color: stat.color }">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
          <div class="stat-bar">
            <div class="stat-bar-fill" :style="{ width: stat.pct + '%', background: stat.color }"></div>
          </div>
        </div>
      </div>
      <div style="height:110px;margin-top:8px">
        <VChart :option="sparkOption" autoresize style="width:100%;height:100%" />
      </div>
      <div class="telemetry-meta">
        <div class="meta-row">
          <span class="text-muted">Device</span>
          <span>{{ deviceId }}</span>
        </div>
        <div class="meta-row">
          <span class="text-muted">Measured</span>
          <span>{{ measuredLabel }}</span>
        </div>
        <div class="meta-row">
          <span class="text-muted">Source</span>
          <span>{{ source }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { usePrismAPI } from '@/composables/usePrismAPI'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

interface NVMeStatsPayload {
  iops: number
  latencyMicros: number
  throughputGBs: number
  queueDepth: number
  pcieLabel?: string
  transport?: string
  source?: string
  isLive?: boolean
  deviceId?: string
  measuredFields?: string[]
  notes?: string
}

interface NVMeDevice {
  id: string
  label: string
  isDefault?: boolean
}

const RANGES = [
  { key: '1m',  label: 'Last 1 min',  points: 30, intervalMs: 2_000  },
  { key: '5m',  label: 'Last 5 min',  points: 30, intervalMs: 10_000 },
  { key: '15m', label: 'Last 15 min', points: 30, intervalMs: 30_000 },
  { key: '30m', label: 'Last 30 min', points: 30, intervalMs: 60_000 },
] as const
type RangeKey = typeof RANGES[number]['key']

const api = usePrismAPI()
const iops = ref(0)
const latency = ref(0)
const throughput = ref(0)
const queueDepth = ref(0)
const pcieLabel = ref('Detecting')
const source = ref('pending')
const isLive = ref(false)
const deviceId = ref('unknown')
const selectedDeviceId = ref('')
const devices = ref<NVMeDevice[]>([])
const measuredFields = ref<string[]>([])
const rangeKey = ref<RangeKey>('1m')
const throughputHistory = ref<number[]>(Array.from({ length: 30 }, () => 0))

let timer: ReturnType<typeof setInterval>

function applyRange() {
  clearInterval(timer)
  const range = RANGES.find(r => r.key === rangeKey.value) ?? RANGES[0]
  throughputHistory.value = Array.from({ length: range.points }, () => 0)
  pollStats()
  timer = setInterval(pollStats, range.intervalMs)
}

onMounted(() => {
  loadDevices()
  applyRange()
})

onUnmounted(() => clearInterval(timer))

async function loadDevices() {
  const response = await api.getNVMeDevices() as { devices: NVMeDevice[] } | null
  devices.value = response?.devices ?? []
  const defaultDevice = devices.value.find(device => device.isDefault) ?? devices.value[0]
  if (defaultDevice && !selectedDeviceId.value) selectedDeviceId.value = defaultDevice.id
}

async function pollStats() {
  const live = await api.getNVMeStats(selectedDeviceId.value || undefined) as NVMeStatsPayload | null
  if (!live) {
    source.value = 'offline'
    isLive.value = false
    return
  }

  iops.value = live.iops ?? 0
  latency.value = live.latencyMicros ?? 0
  throughput.value = live.throughputGBs ?? 0
  queueDepth.value = live.queueDepth ?? 0
  pcieLabel.value = live.pcieLabel ?? live.transport ?? 'NVMe'
  source.value = live.source ?? 'api'
  isLive.value = Boolean(live.isLive)
  deviceId.value = live.deviceId ?? 'unknown'
  measuredFields.value = live.measuredFields ?? []
  const hist = throughputHistory.value
  throughputHistory.value = [...hist.slice(1), throughput.value]
}

const sourceLabel = computed(() => {
  if (isLive.value) return 'Live'
  if (source.value === 'offline') return 'Offline'
  if (source.value === 'pending') return 'Polling'
  return 'Estimated'
})

const stats = computed(() => [
  { label: 'IOPS', value: iops.value >= 1000 ? `${(iops.value / 1000).toFixed(1)}K` : String(iops.value), pct: Math.min((iops.value / 100000) * 100, 100), color: '#5794f2' },
  { label: 'Latency us', value: String(latency.value), pct: Math.min((latency.value / 5000) * 100, 100), color: latency.value < 1000 ? '#73bf69' : '#f2495c' },
  { label: 'GB/s', value: throughput.value.toFixed(3), pct: Math.min((throughput.value / 8) * 100, 100), color: '#19dde2' },
  { label: 'Queue Depth', value: String(queueDepth.value), pct: Math.min((queueDepth.value / 64) * 100, 100), color: '#ff9830' },
])

const measuredLabel = computed(() =>
  measuredFields.value.length ? measuredFields.value.join(', ') : 'none'
)

const sparkOption = computed(() => ({
  backgroundColor: 'transparent',
  tooltip: { trigger: 'axis', backgroundColor: '#1f2330', borderColor: '#2c3235', textStyle: { color: '#d0d0d0', fontSize: 11 } },
  grid: { top: 8, bottom: 18, left: 4, right: 4, containLabel: false },
  xAxis: { type: 'category', show: false, data: throughputHistory.value.map((_, i) => i) },
  yAxis: { type: 'value', show: false, min: 0 },
  series: [{
    type: 'line',
    data: throughputHistory.value,
    smooth: true,
    symbol: 'none',
    lineStyle: { color: '#19dde2', width: 1.5 },
    areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(25,221,226,0.2)' }, { offset: 1, color: 'rgba(25,221,226,0)' }] } }
  }]
}))
</script>

<style scoped>
.nvme-panel { height: 100%; }
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 12px;
}
.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 10px;
}
.stat-value { font-size: 22px; font-weight: 700; line-height: 1; font-family: var(--font-mono); }
.stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 3px; }
.stat-bar { height: 3px; background: var(--border); border-radius: 2px; margin-top: 6px; overflow: hidden; }
.stat-bar-fill { height: 100%; border-radius: 2px; transition: width 0.4s ease; }
.device-select {
  max-width: 130px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  border-radius: 4px;
  padding: 3px 7px;
  font-size: 11px;
  outline: none;
}
.telemetry-meta {
  border-top: 1px solid var(--border);
  padding: 8px 12px 10px;
  display: grid;
  gap: 4px;
}
.meta-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
}
.meta-row span:last-child {
  color: var(--text-secondary);
  font-family: var(--font-mono);
  text-align: right;
}
</style>

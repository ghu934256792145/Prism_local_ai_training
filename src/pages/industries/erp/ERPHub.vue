<template>
  <div class="erp-hub">

    <!-- ── KPI Strip ─────────────────────────────────────────────────────────── -->
    <div class="kpi-strip">
      <div class="kpi-card panel" v-for="k in KPI_CARDS" :key="k.label">
        <div class="kpi-icon" :style="{ background: k.color + '22', color: k.color }">
          <span v-html="k.icon"></span>
        </div>
        <div class="kpi-body">
          <div class="kpi-value">{{ k.value }}</div>
          <div class="kpi-label">{{ k.label }}</div>
        </div>
      </div>
    </div>

    <!-- ── Two-zone body ─────────────────────────────────────────────────────── -->
    <div class="erp-body">

      <!-- Left: Module Card Grid -->
      <div class="modules-zone">
        <div v-if="loadingModules" class="loading-state">
          <div class="spinner"></div>
          <span>Loading ERP modules…</span>
        </div>

        <div v-else class="module-grid">
          <div
            v-for="card in moduleCards"
            :key="card.module"
            class="module-card panel"
          >
            <!-- Icon + header -->
            <div class="module-card-header">
              <div class="module-icon" :style="{ background: card.color + '22', color: card.color }">
                <span v-html="card.icon"></span>
              </div>
              <div class="module-card-title-row">
                <span class="module-name">{{ card.module }}</span>
                <span class="badge badge-count">{{ card.record_count.toLocaleString() }}</span>
              </div>
            </div>

            <!-- KPI line -->
            <div class="module-kpi">
              <span class="kpi-pill">{{ card.kpi_label }}: <strong>{{ card.kpi_value }}</strong></span>
            </div>

            <!-- Industry connection badges -->
            <div class="module-links">
              <span class="links-label">Industry Connections</span>
              <div class="link-badges">
                <button
                  v-for="link in card.industryLinks"
                  :key="link.graphId"
                  class="link-badge"
                  :style="{ background: link.color + '18', color: link.color, borderColor: link.color + '55' }"
                  @click="navigateToIndustry(link.route)"
                  :title="link.graphId"
                >{{ link.label }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Industry Cross-Links Sidebar -->
      <aside class="cross-links-sidebar panel">
        <div class="panel-header">
          <span class="panel-title">Industry Cross-Links</span>
        </div>

        <div v-if="loadingLinks" class="loading-state" style="padding:20px">
          <div class="spinner"></div>
          <span>Loading links…</span>
        </div>

        <div v-else class="cross-links-list">
          <div
            v-for="link in industryLinks"
            :key="link.erp_module + link.linked_graph"
            class="cross-link-row"
            :title="link.description"
          >
            <span class="cl-module">{{ link.erp_module }}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;color:var(--text-muted)">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
            <span class="cl-graph">{{ link.linked_graph }}</span>
            <span class="cl-type-badge" :style="linkTypeBadgeStyle(link.link_type)">{{ link.link_type }}</span>
          </div>
        </div>

        <div class="sidebar-actions">
          <button class="btn btn-primary" style="width:100%;justify-content:center" @click="router.push('/erp/graph')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
              <line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/>
            </svg>
            Open Full Graph
          </button>
          <button class="btn" style="width:100%;justify-content:center" @click="router.push('/erp/data')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"/>
              <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12"/>
              <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
            </svg>
            Explore Data
          </button>
        </div>
      </aside>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// ── Types ──────────────────────────────────────────────────────────────────────

interface ErpModuleStats {
  module: string
  record_count: number
  kpi_label: string
  kpi_value: string
  industry_links: string[]
}

interface ErpIndustryLink {
  erp_module: string
  linked_graph: string
  link_type: string
  description: string
}

// ── KPI strip (static) ─────────────────────────────────────────────────────────

const KPI_CARDS = [
  {
    label: 'Total Revenue',
    value: '$240M',
    color: '#6366f1',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>`,
  },
  {
    label: 'Active Orders',
    value: '10',
    color: '#14b8a6',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>`,
  },
  {
    label: 'Employees',
    value: '1,200',
    color: '#f59e0b',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>`,
  },
  {
    label: 'Suppliers',
    value: '6',
    color: '#ec4899',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>`,
  },
]

// ── Module definitions (icons + connection mapping) ────────────────────────────

interface IndustryLinkDef { graphId: string; label: string; route: string; color: string }

const GRAPH_ROUTE_MAP: Record<string, { route: string; color: string }> = {
  'mfg-bicycle':           { route: '/mfg',           color: '#14b8a6' },
  'mfg-pump':              { route: '/mfg',           color: '#14b8a6' },
  'mfg-electronics':       { route: '/mfg',           color: '#14b8a6' },
  'drug-discovery':        { route: '/drug-discovery', color: '#ec4899' },
  'genomics-p53':          { route: '/genomics',       color: '#73bf69' },
  'semiconductor-alu':     { route: '/semiconductor',  color: '#5794f2' },
  'semiconductor-risc':    { route: '/semiconductor',  color: '#5794f2' },
  'threat-intel-apt29':    { route: '/threat-intel',   color: '#f2495c' },
  'threat-intel-ransomware': { route: '/threat-intel', color: '#f2495c' },
  'pipeline-process':      { route: '/pipeline',       color: '#ff9830' },
  'pipeline-water':        { route: '/pipeline',       color: '#ff9830' },
  'scaffold-ringlock':     { route: '/scaffold',       color: '#fade2a' },
  'supply-chain':          { route: '/graph',          color: '#b877d9' },
  'erp':                   { route: '/graph',          color: '#6366f1' },
}

function graphLabel(graphId: string): string {
  const labels: Record<string, string> = {
    'mfg-bicycle': 'MFG Bicycle',
    'mfg-pump': 'MFG Pump',
    'mfg-electronics': 'MFG Electronics',
    'drug-discovery': 'Drug Discovery',
    'genomics-p53': 'Genomics P53',
    'semiconductor-alu': 'Semiconductor ALU',
    'semiconductor-risc': 'Semiconductor RISC',
    'threat-intel-apt29': 'Threat APT29',
    'threat-intel-ransomware': 'Threat Ransomware',
    'pipeline-process': 'Pipeline Process',
    'pipeline-water': 'Pipeline Water',
    'scaffold-ringlock': 'Scaffold Ringlock',
    'supply-chain': 'Supply Chain',
    'erp': 'ERP Graph',
  }
  return labels[graphId] ?? graphId
}

const MODULE_DEFS: Record<string, {
  color: string
  icon: string
  staticLinks: string[]
}> = {
  Finance: {
    color: '#6366f1',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>`,
    staticLinks: ['supply-chain', 'drug-discovery'],
  },
  HR: {
    color: '#f59e0b',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>`,
    staticLinks: ['genomics-p53', 'erp'],
  },
  Manufacturing: {
    color: '#14b8a6',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M2 20h20"/><path d="M5 20V10l7-7 7 7v10"/>
      <path d="M9 20v-5h6v5"/>
    </svg>`,
    staticLinks: ['mfg-bicycle', 'semiconductor-alu'],
  },
  Procurement: {
    color: '#ec4899',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>`,
    staticLinks: ['supply-chain', 'pipeline-process'],
  },
  Sales: {
    color: '#22c55e',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
      <polyline points="16 7 22 7 22 13"/>
    </svg>`,
    staticLinks: ['drug-discovery', 'supply-chain'],
  },
  Logistics: {
    color: '#ff9830',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="1" y="3" width="15" height="13"/>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>`,
    staticLinks: ['pipeline-water', 'scaffold-ringlock'],
  },
  Inventory: {
    color: '#b877d9',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>`,
    staticLinks: ['mfg-pump', 'mfg-electronics'],
  },
  CRM: {
    color: '#19dde2',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
      <path d="M16 11l2 2 4-4"/>
    </svg>`,
    staticLinks: ['threat-intel-apt29', 'drug-discovery'],
  },
  Reporting: {
    color: '#5794f2',
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>`,
    staticLinks: ['genomics-p53', 'semiconductor-risc'],
  },
}

const STATIC_MODULES: ErpModuleStats[] = [
  { module: 'Finance',       record_count: 1240, kpi_label: 'Revenue',     kpi_value: '$240M',  industry_links: MODULE_DEFS.Finance.staticLinks },
  { module: 'HR',            record_count: 1200, kpi_label: 'Headcount',   kpi_value: '1,200',  industry_links: MODULE_DEFS.HR.staticLinks },
  { module: 'Manufacturing', record_count: 340,  kpi_label: 'Output',      kpi_value: '12K/mo', industry_links: MODULE_DEFS.Manufacturing.staticLinks },
  { module: 'Procurement',   record_count: 86,   kpi_label: 'Suppliers',   kpi_value: '6',      industry_links: MODULE_DEFS.Procurement.staticLinks },
  { module: 'Sales',         record_count: 580,  kpi_label: 'Customers',   kpi_value: '580',    industry_links: MODULE_DEFS.Sales.staticLinks },
  { module: 'Logistics',     record_count: 210,  kpi_label: 'Shipments',   kpi_value: '210',    industry_links: MODULE_DEFS.Logistics.staticLinks },
  { module: 'Inventory',     record_count: 490,  kpi_label: 'Stock Value',  kpi_value: '$142K', industry_links: MODULE_DEFS.Inventory.staticLinks },
  { module: 'CRM',           record_count: 580,  kpi_label: 'Contacts',    kpi_value: '580',    industry_links: MODULE_DEFS.CRM.staticLinks },
  { module: 'Reporting',     record_count: 48,   kpi_label: 'Reports',     kpi_value: '48',     industry_links: MODULE_DEFS.Reporting.staticLinks },
]

// ── State ──────────────────────────────────────────────────────────────────────

const loadingModules = ref(false)
const loadingLinks   = ref(false)
const rawModules     = ref<ErpModuleStats[]>(STATIC_MODULES)
const industryLinks  = ref<ErpIndustryLink[]>([])

// ── Computed cards ─────────────────────────────────────────────────────────────

const moduleCards = computed(() =>
  rawModules.value.map(m => {
    const def = MODULE_DEFS[m.module] ?? { color: '#6366f1', icon: '', staticLinks: [] }
    const industryLinks: IndustryLinkDef[] = m.industry_links
      .filter(id => GRAPH_ROUTE_MAP[id])
      .map(id => ({
        graphId: id,
        label: graphLabel(id),
        route: GRAPH_ROUTE_MAP[id].route,
        color: GRAPH_ROUTE_MAP[id].color,
      }))
    return { ...m, color: def.color, icon: def.icon, industryLinks }
  })
)

// ── Helpers ────────────────────────────────────────────────────────────────────

const LINK_TYPE_COLORS: Record<string, string> = {
  DATA_FEED:      '#6366f1',
  DEPENDENCY:     '#14b8a6',
  CROSS_DOMAIN:   '#f59e0b',
  COMPLIANCE:     '#ec4899',
  OPERATIONS:     '#22c55e',
  ANALYTICS:      '#5794f2',
  INTEGRATION:    '#b877d9',
}

function linkTypeBadgeStyle(type: string) {
  const color = LINK_TYPE_COLORS[type] ?? '#888'
  return {
    background: color + '22',
    color,
    border: `1px solid ${color}44`,
  }
}

function navigateToIndustry(route: string) {
  router.push(route)
}

// ── API fetch ──────────────────────────────────────────────────────────────────

async function fetchModules() {
  loadingModules.value = true
  try {
    const r = await fetch('/api/erp/modules')
    if (!r.ok) throw new Error('API error')
    const d = await r.json()
    if (d.modules?.length) rawModules.value = d.modules
  } catch {
    // Keep static fallback
  } finally {
    loadingModules.value = false
  }
}

async function fetchIndustryLinks() {
  loadingLinks.value = true
  try {
    const r = await fetch('/api/erp/industries')
    if (!r.ok) throw new Error('API error')
    const d = await r.json()
    industryLinks.value = d.links ?? []
  } catch {
    // Fallback static links
    industryLinks.value = [
      { erp_module: 'Finance',       linked_graph: 'supply-chain',       link_type: 'DATA_FEED',    description: 'Finance feeds cost data into supply chain graph' },
      { erp_module: 'Manufacturing', linked_graph: 'mfg-bicycle',        link_type: 'DEPENDENCY',   description: 'Manufacturing BOM dependencies' },
      { erp_module: 'Manufacturing', linked_graph: 'semiconductor-alu',   link_type: 'CROSS_DOMAIN', description: 'EDA chip design feeds manufacturing' },
      { erp_module: 'HR',            linked_graph: 'genomics-p53',        link_type: 'COMPLIANCE',   description: 'HR compliance links to genomics research' },
      { erp_module: 'Procurement',   linked_graph: 'supply-chain',        link_type: 'DEPENDENCY',   description: 'Procurement drives supplier graph' },
      { erp_module: 'Procurement',   linked_graph: 'pipeline-process',    link_type: 'OPERATIONS',   description: 'Procurement feeds pipeline materials' },
      { erp_module: 'Logistics',     linked_graph: 'pipeline-water',      link_type: 'OPERATIONS',   description: 'Water logistics mapped to pipeline graph' },
      { erp_module: 'Logistics',     linked_graph: 'scaffold-ringlock',   link_type: 'OPERATIONS',   description: 'Scaffold logistics network' },
      { erp_module: 'CRM',           linked_graph: 'threat-intel-apt29',  link_type: 'COMPLIANCE',   description: 'CRM breach exposure tracked via threat intel' },
      { erp_module: 'Sales',         linked_graph: 'drug-discovery',      link_type: 'CROSS_DOMAIN', description: 'Pharma sales pipeline linked to drug discovery' },
      { erp_module: 'Inventory',     linked_graph: 'mfg-electronics',     link_type: 'DATA_FEED',    description: 'Electronics stock levels feed inventory graph' },
      { erp_module: 'Reporting',     linked_graph: 'semiconductor-risc',  link_type: 'ANALYTICS',    description: 'RISC chip metrics reported via ERP reporting' },
    ]
  } finally {
    loadingLinks.value = false
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

onMounted(() => {
  fetchModules()
  fetchIndustryLinks()
})
</script>

<style scoped>
.erp-hub {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  gap: 12px;
}

/* ── KPI strip ─────────────────────────────────────────────────────────────── */

.kpi-strip {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.kpi-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  flex-direction: row;
}

.kpi-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.kpi-body { display: flex; flex-direction: column; }

.kpi-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  color: var(--text-primary);
}

.kpi-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-top: 4px;
}

/* ── Two-zone body ─────────────────────────────────────────────────────────── */

.erp-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
  overflow: hidden;
}

/* ── Module grid ───────────────────────────────────────────────────────────── */

.modules-zone {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}

.loading-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 24px;
  color: var(--text-muted);
  font-size: 13px;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

.module-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.module-card {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.15s;
}

.module-card:hover {
  border-color: var(--border-hover);
}

.module-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.module-icon {
  width: 34px;
  height: 34px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.module-card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.module-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.badge-count {
  background: rgba(99, 102, 241, 0.15);
  color: #6366f1;
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 10px;
  font-weight: 600;
}

.module-kpi {
  display: flex;
  align-items: center;
}

.kpi-pill {
  font-size: 12px;
  color: var(--text-muted);
}

.kpi-pill strong {
  color: var(--text-secondary);
  font-weight: 600;
}

.module-links {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.links-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.link-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.link-badge {
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid;
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  background: transparent;
  transition: opacity 0.15s, transform 0.1s;
  white-space: nowrap;
}

.link-badge:hover {
  opacity: 0.8;
  transform: translateY(-1px);
}

/* ── Cross-links sidebar ───────────────────────────────────────────────────── */

.cross-links-sidebar {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cross-links-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
  min-height: 0;
}

.cross-link-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
  cursor: default;
}

.cross-link-row:last-child {
  border-bottom: none;
}

.cross-link-row:hover {
  background: var(--bg-panel-hover);
}

.cl-module {
  font-size: 11px;
  font-weight: 600;
  color: #6366f1;
  min-width: 72px;
  white-space: nowrap;
}

.cl-graph {
  flex: 1;
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cl-type-badge {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 8px;
  white-space: nowrap;
  flex-shrink: 0;
}

.sidebar-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
</style>

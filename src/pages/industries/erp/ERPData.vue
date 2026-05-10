<template>
  <div class="erpdata-shell">

    <!-- ── Left sidebar: table list ─────────────────────────────────────────── -->
    <aside class="erpdata-sidebar">
      <div class="panel-header">
        <span class="panel-title">ERP Tables</span>
      </div>
      <nav class="table-nav">
        <button
          v-for="t in TABLES"
          :key="t.key"
          class="table-nav-item"
          :class="{ active: activeTable === t.key }"
          @click="selectTable(t.key)"
        >
          <span class="table-nav-icon" v-html="t.icon"></span>
          <span class="table-nav-label">{{ t.label }}</span>
          <span class="table-count-badge" v-if="recordCounts[t.key] !== undefined">
            {{ recordCounts[t.key] }}
          </span>
          <div v-else-if="loadingTable === t.key" class="spinner-xs"></div>
        </button>
      </nav>
    </aside>

    <!-- ── Main: table area ──────────────────────────────────────────────────── -->
    <div class="erpdata-main">

      <!-- Table header bar -->
      <div class="table-header-bar">
        <div class="table-header-left">
          <span class="table-main-title">{{ currentTableDef?.label ?? '—' }}</span>
          <span v-if="filteredRows.length" class="badge badge-count-main">
            {{ filteredRows.length }} records
          </span>
        </div>
        <div class="table-header-right">
          <div class="search-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              v-model="searchQuery"
              class="search-input"
              placeholder="Search…"
              @input="currentPage = 1"
            />
          </div>
          <button class="btn" @click="exportCSV" :disabled="!pagedRows.length">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="isLoading" class="table-loading">
        <div class="spinner"></div>
        <span>Loading {{ currentTableDef?.label }}…</span>
      </div>

      <!-- Empty state -->
      <div v-else-if="!activeTable" class="table-empty">
        Select a table from the sidebar.
      </div>

      <!-- No results -->
      <div v-else-if="filteredRows.length === 0" class="table-empty">
        No records found{{ searchQuery ? ` for "${searchQuery}"` : '' }}.
      </div>

      <!-- Data table -->
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th
                v-for="col in columns"
                :key="col"
                class="th"
                @click="setSortCol(col)"
              >
                <div class="th-inner">
                  <span>{{ col }}</span>
                  <span v-if="sortCol === col" class="sort-arrow">
                    {{ sortDir === 'asc' ? '↑' : '↓' }}
                  </span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, ri) in pagedRows"
              :key="ri"
              class="td-row"
              :class="{ highlighted: row.industry_graph }"
            >
              <td v-for="col in columns" :key="col" class="td">
                <!-- industry_graph badge -->
                <template v-if="col === 'industry_graph' && row[col]">
                  <span class="badge badge-industry">{{ row[col] }}</span>
                </template>
                <!-- status badge -->
                <template v-else-if="col === 'status' && row[col]">
                  <span class="badge" :class="statusBadgeClass(row[col])">{{ row[col] }}</span>
                </template>
                <!-- default cell -->
                <template v-else>
                  <span class="cell-value">{{ formatCell(row[col]) }}</span>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination-bar">
        <button class="btn" :disabled="currentPage === 1" @click="currentPage--">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Prev
        </button>
        <span class="page-info">
          Page {{ currentPage }} / {{ totalPages }}
          <span class="page-total">({{ filteredRows.length }} total)</span>
        </span>
        <button class="btn" :disabled="currentPage === totalPages" @click="currentPage++">
          Next
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

// ── Table definitions ──────────────────────────────────────────────────────────

const TABLES = [
  {
    key: 'companies',
    label: 'Companies',
    endpoint: '/api/erp/companies',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>`,
  },
  {
    key: 'departments',
    label: 'Departments',
    endpoint: '/api/erp/departments',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>`,
  },
  {
    key: 'employees',
    label: 'Employees',
    endpoint: '/api/erp/employees',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>`,
  },
  {
    key: 'products',
    label: 'Products',
    endpoint: '/api/erp/products',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>`,
  },
  {
    key: 'customers',
    label: 'Customers',
    endpoint: '/api/erp/customers',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>`,
  },
  {
    key: 'orders',
    label: 'Orders',
    endpoint: '/api/erp/orders',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>`,
  },
  {
    key: 'invoices',
    label: 'Invoices',
    endpoint: '/api/erp/invoices',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="16" y2="17"/>
    </svg>`,
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    endpoint: '/api/erp/suppliers',
    icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
      <rect x="1" y="3" width="15" height="13"/>
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
      <circle cx="5.5" cy="18.5" r="2.5"/>
      <circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>`,
  },
]

// ── State ──────────────────────────────────────────────────────────────────────

const activeTable  = ref<string | null>(null)
const searchQuery  = ref('')
const sortCol      = ref<string | null>(null)
const sortDir      = ref<'asc' | 'desc'>('asc')
const currentPage  = ref(1)
const isLoading    = ref(false)
const loadingTable = ref<string | null>(null)

const PAGE_SIZE = 10

// Cache: key → row array
const tableCache = ref<Record<string, any[]>>({})
// Record counts per table
const recordCounts = ref<Record<string, number>>({})

// ── Computed ───────────────────────────────────────────────────────────────────

const currentTableDef = computed(() =>
  TABLES.find(t => t.key === activeTable.value) ?? null
)

const currentRows = computed((): any[] =>
  activeTable.value ? (tableCache.value[activeTable.value] ?? []) : []
)

const columns = computed((): string[] => {
  const rows = currentRows.value
  if (!rows.length) return []
  return Object.keys(rows[0])
})

const filteredRows = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  let rows = currentRows.value
  if (q) {
    rows = rows.filter(row =>
      Object.values(row).some(v =>
        String(v ?? '').toLowerCase().includes(q)
      )
    )
  }
  if (sortCol.value) {
    const col = sortCol.value
    const dir = sortDir.value === 'asc' ? 1 : -1
    rows = [...rows].sort((a, b) => {
      const av = a[col], bv = b[col]
      if (av == null && bv == null) return 0
      if (av == null) return dir
      if (bv == null) return -dir
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }
  return rows
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / PAGE_SIZE)))

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return filteredRows.value.slice(start, start + PAGE_SIZE)
})

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusBadgeClass(status: string): string {
  const s = (status ?? '').toLowerCase()
  if (['paid', 'delivered', 'completed', 'active', 'approved'].includes(s)) return 'badge-green'
  if (['overdue', 'cancelled', 'rejected', 'failed', 'error'].includes(s))  return 'badge-red'
  if (['pending', 'draft', 'review', 'processing', 'open'].includes(s))     return 'badge-orange'
  return 'badge-muted'
}

function formatCell(val: any): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function setSortCol(col: string) {
  if (sortCol.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortCol.value = col
    sortDir.value = 'asc'
  }
  currentPage.value = 1
}

// ── Data loading ───────────────────────────────────────────────────────────────

async function fetchTable(key: string): Promise<any[]> {
  const def = TABLES.find(t => t.key === key)
  if (!def) return []
  try {
    const r = await fetch(def.endpoint)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const d = await r.json()
    // API may return array directly or wrapped
    if (Array.isArray(d)) return d
    // Try common wrapper keys
    const wrapper = d[key] ?? d.data ?? d.rows ?? d.results
    if (Array.isArray(wrapper)) return wrapper
    return []
  } catch {
    return []
  }
}

async function selectTable(key: string) {
  if (activeTable.value === key) return
  activeTable.value = key
  searchQuery.value = ''
  sortCol.value = null
  currentPage.value = 1

  if (tableCache.value[key]) return  // Already cached

  isLoading.value = true
  loadingTable.value = key
  try {
    const rows = await fetchTable(key)
    tableCache.value = { ...tableCache.value, [key]: rows }
    recordCounts.value = { ...recordCounts.value, [key]: rows.length }
  } finally {
    isLoading.value = false
    loadingTable.value = null
  }
}

// Pre-fetch all record counts lazily on mount (just the first table auto-selected,
// and counts fetched in background for sidebar badges)
async function prefetchCounts() {
  for (const t of TABLES) {
    if (tableCache.value[t.key]) {
      recordCounts.value[t.key] = tableCache.value[t.key].length
      continue
    }
    // Non-blocking — fire and forget each
    ;(async () => {
      try {
        const rows = await fetchTable(t.key)
        tableCache.value = { ...tableCache.value, [t.key]: rows }
        recordCounts.value = { ...recordCounts.value, [t.key]: rows.length }
      } catch { /* ignore */ }
    })()
  }
}

// ── Export CSV ─────────────────────────────────────────────────────────────────

function exportCSV() {
  const rows = filteredRows.value
  if (!rows.length) return
  const cols = columns.value
  const header = cols.join(',')
  const body = rows.map(row =>
    cols.map(c => {
      const v = row[c]
      if (v === null || v === undefined) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }).join(',')
  ).join('\n')
  const csv = `${header}\n${body}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${activeTable.value ?? 'erp'}_export.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

onMounted(() => {
  prefetchCounts()
  // Auto-select first table
  selectTable(TABLES[0].key)
})
</script>

<style scoped>
.erpdata-shell {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* ── Sidebar ───────────────────────────────────────────────────────────────── */

.erpdata-sidebar {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--bg-panel);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.table-nav {
  display: flex;
  flex-direction: column;
  padding: 6px 0;
}

.table-nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 14px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 13px;
  text-align: left;
  border-left: 2px solid transparent;
  transition: all 0.12s;
}

.table-nav-item:hover {
  background: var(--bg-panel-hover);
  color: var(--text-primary);
}

.table-nav-item.active {
  color: #6366f1;
  border-left-color: #6366f1;
  background: rgba(99, 102, 241, 0.08);
}

.table-nav-icon {
  display: flex;
  align-items: center;
  opacity: 0.75;
}

.table-nav-label {
  flex: 1;
  font-weight: 500;
}

.table-count-badge {
  font-size: 10px;
  font-weight: 600;
  background: var(--bg-secondary);
  color: var(--text-muted);
  padding: 1px 7px;
  border-radius: 10px;
  border: 1px solid var(--border);
}

.spinner-xs {
  width: 12px;
  height: 12px;
  border: 1.5px solid var(--border);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

/* ── Main ──────────────────────────────────────────────────────────────────── */

.erpdata-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-panel);
  flex-shrink: 0;
  gap: 12px;
}

.table-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.table-main-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.badge-count-main {
  background: rgba(99, 102, 241, 0.15);
  color: #6366f1;
  font-size: 11px;
  padding: 2px 9px;
  border-radius: 10px;
}

.table-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 9px;
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text-primary);
  font-size: 12px;
  padding: 5px 10px 5px 30px;
  width: 200px;
  outline: none;
  transition: border-color 0.15s;
}

.search-input:focus {
  border-color: #6366f1;
}

.search-input::placeholder {
  color: var(--text-muted);
}

/* ── Loading / empty ───────────────────────────────────────────────────────── */

.table-loading,
.table-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 13px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Data table ────────────────────────────────────────────────────────────── */

.table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.th {
  position: sticky;
  top: 0;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  padding: 0;
  cursor: pointer;
  white-space: nowrap;
  z-index: 1;
}

.th:hover { background: var(--bg-panel-hover); }

.th-inner {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
}

.sort-arrow {
  color: #6366f1;
  font-size: 12px;
}

.td-row {
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}

.td-row:hover {
  background: var(--bg-panel-hover);
}

.td-row.highlighted {
  background: rgba(99, 102, 241, 0.05);
}

.td-row.highlighted:hover {
  background: rgba(99, 102, 241, 0.1);
}

.td {
  padding: 8px 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: middle;
}

.cell-value {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
  white-space: nowrap;
}

/* Badges */
.badge-industry {
  background: rgba(99, 102, 241, 0.18);
  color: #818cf8;
  border: 1px solid rgba(99, 102, 241, 0.35);
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 8px;
  font-weight: 600;
}

.badge-green  { background: rgba(115,191,105,0.15); color: var(--accent-green); }
.badge-red    { background: rgba(242,73,92,0.15);   color: var(--accent-red); }
.badge-orange { background: rgba(255,152,48,0.15);  color: var(--accent-orange); }
.badge-muted  { background: var(--bg-secondary);    color: var(--text-muted); }

/* ── Pagination ────────────────────────────────────────────────────────────── */

.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: var(--bg-panel);
  flex-shrink: 0;
}

.page-info {
  font-size: 12px;
  color: var(--text-secondary);
}

.page-total {
  color: var(--text-muted);
  font-size: 11px;
}
</style>

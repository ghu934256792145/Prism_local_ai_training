<template>
  <div class="collections-page">
    <!-- Tab bar -->
    <div class="tab-bar">
      <button
        v-for="t in TABS"
        :key="t.id"
        class="tab-btn"
        :class="{ active: activeTab === t.id }"
        @click="activeTab = t.id"
      >{{ t.label }}</button>
      <div class="tab-spacer" />
      <button class="btn btn-sm" @click="refresh">↻ Refresh</button>
    </div>

    <!-- Datasets tab -->
    <div v-if="activeTab === 'datasets'" class="tab-content">
      <div class="section-title">Available Datasets</div>
      <div class="dataset-grid">
        <div
          v-for="ds in datasets"
          :key="ds.name"
          class="dataset-card panel"
          :class="{ active: currentDataset === ds.name }"
        >
          <div class="ds-header">
            <span class="ds-name">{{ ds.label }}</span>
            <span class="badge badge-cyan" style="font-size:10px">{{ ds.name }}</span>
          </div>
          <div class="ds-desc text-secondary">{{ ds.description }}</div>
          <div class="ds-meta">
            <span class="meta-chip">{{ ds.nodeCount }}n</span>
            <span class="meta-chip">{{ ds.edgeCount }}e</span>
            <span v-for="t in ds.tags" :key="t" class="meta-chip tag-chip">{{ t }}</span>
          </div>
          <button
            class="btn btn-sm"
            :class="currentDataset === ds.name ? 'btn-active' : ''"
            :disabled="loading"
            @click="loadDataset(ds.name)"
          >{{ currentDataset === ds.name ? '✓ Loaded' : 'Load' }}</button>
        </div>
      </div>
    </div>

    <!-- Nodes tab -->
    <div v-if="activeTab === 'nodes'" class="tab-content">
      <div class="table-toolbar">
        <div class="section-title">Nodes <span class="count-badge">{{ nodes.length }}</span></div>
        <div class="toolbar-right">
          <input v-model="nodeSearch" class="search-input" placeholder="Filter nodes…" />
          <button class="btn btn-sm btn-add" @click="showAddNode = !showAddNode">+ Add Node</button>
        </div>
      </div>

      <!-- Inline add form -->
      <div v-if="showAddNode" class="add-form panel">
        <div class="form-row">
          <input v-model="newNode.id" class="form-input" placeholder="id *" />
          <input v-model="newNode.label" class="form-input" placeholder="label *" />
          <input v-model.number="newNode.category" class="form-input" type="number" min="0" max="9" placeholder="category" style="width:90px" />
          <input v-model.number="newNode.value" class="form-input" type="number" min="1" max="20" placeholder="value" style="width:80px" />
          <input v-model.number="newNode.symbolSize" class="form-input" type="number" min="16" max="60" placeholder="size" style="width:80px" />
          <button class="btn btn-sm btn-add" :disabled="!newNode.id || !newNode.label" @click="addNode">Add</button>
          <button class="btn btn-sm" @click="showAddNode = false">Cancel</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th @click="sortBy('nodes','id')">ID <span class="sort-icon">{{ sortIcon('nodes','id') }}</span></th>
              <th @click="sortBy('nodes','label')">Label <span class="sort-icon">{{ sortIcon('nodes','label') }}</span></th>
              <th @click="sortBy('nodes','category')">Cat <span class="sort-icon">{{ sortIcon('nodes','category') }}</span></th>
              <th @click="sortBy('nodes','value')">Value <span class="sort-icon">{{ sortIcon('nodes','value') }}</span></th>
              <th @click="sortBy('nodes','symbolSize')">Size <span class="sort-icon">{{ sortIcon('nodes','symbolSize') }}</span></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="n in filteredNodes" :key="n.id">
              <td class="mono text-accent-blue">{{ n.id }}</td>
              <td>{{ n.label }}</td>
              <td><span class="cat-badge" :style="catStyle(n.category)">{{ n.category }}</span></td>
              <td>{{ n.value }}</td>
              <td>{{ n.symbolSize }}</td>
              <td>
                <button class="btn-icon danger" title="Delete" @click="deleteNode(n.id)">✕</button>
              </td>
            </tr>
            <tr v-if="filteredNodes.length === 0">
              <td colspan="6" class="empty-row text-secondary">No nodes found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Edges tab -->
    <div v-if="activeTab === 'edges'" class="tab-content">
      <div class="table-toolbar">
        <div class="section-title">Edges <span class="count-badge">{{ edges.length }}</span></div>
        <div class="toolbar-right">
          <input v-model="edgeSearch" class="search-input" placeholder="Filter edges…" />
          <button class="btn btn-sm btn-add" @click="showAddEdge = !showAddEdge">+ Add Edge</button>
        </div>
      </div>

      <div v-if="showAddEdge" class="add-form panel">
        <div class="form-row">
          <input v-model="newEdge.source" class="form-input" placeholder="source *" />
          <input v-model="newEdge.target" class="form-input" placeholder="target *" />
          <input v-model="newEdge.label" class="form-input" placeholder="label" />
          <input v-model.number="newEdge.weight" class="form-input" type="number" min="1" max="10" placeholder="weight" style="width:80px" />
          <button class="btn btn-sm btn-add" :disabled="!newEdge.source || !newEdge.target" @click="addEdge">Add</button>
          <button class="btn btn-sm" @click="showAddEdge = false">Cancel</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th @click="sortBy('edges','source')">Source <span class="sort-icon">{{ sortIcon('edges','source') }}</span></th>
              <th @click="sortBy('edges','target')">Target <span class="sort-icon">{{ sortIcon('edges','target') }}</span></th>
              <th @click="sortBy('edges','label')">Label <span class="sort-icon">{{ sortIcon('edges','label') }}</span></th>
              <th @click="sortBy('edges','weight')">Weight <span class="sort-icon">{{ sortIcon('edges','weight') }}</span></th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in filteredEdges" :key="`${e.source}->${e.target}`">
              <td class="mono text-accent-blue">{{ e.source }}</td>
              <td class="mono text-accent-green">{{ e.target }}</td>
              <td><span class="label-chip">{{ e.label }}</span></td>
              <td>
                <div class="weight-bar">
                  <div class="weight-fill" :style="{ width: `${e.weight * 10}%` }" />
                  <span>{{ e.weight }}</span>
                </div>
              </td>
              <td>
                <button class="btn-icon danger" title="Delete" @click="deleteEdge(e.source, e.target)">✕</button>
              </td>
            </tr>
            <tr v-if="filteredEdges.length === 0">
              <td colspan="5" class="empty-row text-secondary">No edges found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Vectors tab -->
    <div v-if="activeTab === 'vectors'" class="tab-content">
      <div class="table-toolbar">
        <div class="section-title">Vectors <span class="count-badge">{{ vectors.length }}</span></div>
        <div class="toolbar-right">
          <input v-model="vectorSearch" class="search-input" placeholder="Filter vectors…" />
          <button class="btn btn-sm btn-add" @click="showAddVector = !showAddVector">+ Add Vector</button>
        </div>
      </div>

      <div v-if="showAddVector" class="add-form panel">
        <div class="form-row">
          <input v-model="newVec.id" class="form-input" placeholder="id *" />
          <input v-model="newVec.label" class="form-input" placeholder="label *" />
          <input v-model.number="newVec.x" class="form-input" type="number" step="0.01" placeholder="x" style="width:80px" />
          <input v-model.number="newVec.y" class="form-input" type="number" step="0.01" placeholder="y" style="width:80px" />
          <input v-model.number="newVec.cluster" class="form-input" type="number" min="0" placeholder="cluster" style="width:80px" />
          <input v-model.number="newVec.score" class="form-input" type="number" step="0.01" min="0" max="1" placeholder="score" style="width:80px" />
          <input v-model="newVec.tagsRaw" class="form-input" placeholder="tags (comma)" />
          <button class="btn btn-sm btn-add" :disabled="!newVec.id || !newVec.label" @click="addVector">Add</button>
          <button class="btn btn-sm" @click="showAddVector = false">Cancel</button>
        </div>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th @click="sortBy('vectors','id')">ID <span class="sort-icon">{{ sortIcon('vectors','id') }}</span></th>
              <th @click="sortBy('vectors','label')">Label <span class="sort-icon">{{ sortIcon('vectors','label') }}</span></th>
              <th @click="sortBy('vectors','x')">X <span class="sort-icon">{{ sortIcon('vectors','x') }}</span></th>
              <th @click="sortBy('vectors','y')">Y <span class="sort-icon">{{ sortIcon('vectors','y') }}</span></th>
              <th @click="sortBy('vectors','cluster')">Cluster <span class="sort-icon">{{ sortIcon('vectors','cluster') }}</span></th>
              <th @click="sortBy('vectors','score')">Score <span class="sort-icon">{{ sortIcon('vectors','score') }}</span></th>
              <th>Tags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in filteredVectors" :key="v.id">
              <td class="mono text-accent-blue">{{ v.id }}</td>
              <td>{{ v.label }}</td>
              <td class="mono">{{ v.x.toFixed(3) }}</td>
              <td class="mono">{{ v.y.toFixed(3) }}</td>
              <td><span class="cat-badge" :style="catStyle(v.cluster)">{{ v.cluster }}</span></td>
              <td>
                <div class="score-bar">
                  <div class="score-fill" :style="{ width: `${v.score * 100}%` }" />
                  <span>{{ v.score.toFixed(2) }}</span>
                </div>
              </td>
              <td>
                <span v-for="tag in v.tags" :key="tag" class="tag-chip">{{ tag }}</span>
              </td>
              <td>
                <button class="btn-icon danger" title="Delete" @click="deleteVector(v.id)">✕</button>
              </td>
            </tr>
            <tr v-if="filteredVectors.length === 0">
              <td colspan="8" class="empty-row text-secondary">No vectors found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePrismAPI, type NodeRecord, type EdgeRecord, type VectorRecord, type DatasetInfo } from '@/composables/usePrismAPI'

const api = usePrismAPI()

const TABS = [
  { id: 'datasets', label: 'Datasets' },
  { id: 'nodes',    label: 'Nodes' },
  { id: 'edges',    label: 'Edges' },
  { id: 'vectors',  label: 'Vectors' },
]

const activeTab = ref('datasets')
const loading   = ref(false)

const datasets        = ref<DatasetInfo[]>([])
const currentDataset  = ref('default')
const nodes           = ref<NodeRecord[]>([])
const edges           = ref<EdgeRecord[]>([])
const vectors         = ref<VectorRecord[]>([])

// ── Search ────────────────────────────────────────────────────────────────────
const nodeSearch   = ref('')
const edgeSearch   = ref('')
const vectorSearch = ref('')

// ── Sort ──────────────────────────────────────────────────────────────────────
type SortState = { col: string; dir: 1 | -1 }
const nodeSortState   = ref<SortState>({ col: 'id',     dir: 1 })
const edgeSortState   = ref<SortState>({ col: 'source', dir: 1 })
const vectorSortState = ref<SortState>({ col: 'id',     dir: 1 })

function sortBy(tab: 'nodes' | 'edges' | 'vectors', col: string) {
  const map = { nodes: nodeSortState, edges: edgeSortState, vectors: vectorSortState }
  const s = map[tab]
  if (s.value.col === col) {
    s.value.dir = s.value.dir === 1 ? -1 : 1
  } else {
    s.value = { col, dir: 1 }
  }
}

function sortIcon(tab: 'nodes' | 'edges' | 'vectors', col: string) {
  const map = { nodes: nodeSortState, edges: edgeSortState, vectors: vectorSortState }
  const s = map[tab].value
  if (s.col !== col) return '⇅'
  return s.dir === 1 ? '↑' : '↓'
}

function applySortFilter<T extends Record<string, any>>(
  items: T[], search: string, searchKeys: (keyof T)[], sort: SortState,
): T[] {
  let result = items
  if (search.trim()) {
    const q = search.toLowerCase()
    result = result.filter(item => searchKeys.some(k => String(item[k]).toLowerCase().includes(q)))
  }
  return [...result].sort((a, b) => {
    const va = a[sort.col], vb = b[sort.col]
    if (va < vb) return -sort.dir
    if (va > vb) return sort.dir
    return 0
  })
}

const filteredNodes   = computed(() => applySortFilter(nodes.value, nodeSearch.value, ['id', 'label'], nodeSortState.value))
const filteredEdges   = computed(() => applySortFilter(edges.value, edgeSearch.value, ['source', 'target', 'label'], edgeSortState.value))
const filteredVectors = computed(() => applySortFilter(vectors.value, vectorSearch.value, ['id', 'label'], vectorSortState.value))

// ── Add forms ─────────────────────────────────────────────────────────────────
const showAddNode   = ref(false)
const showAddEdge   = ref(false)
const showAddVector = ref(false)

const newNode = ref<NodeRecord>({ id: '', label: '', category: 0, value: 5, symbolSize: 28 })
const newEdge = ref<EdgeRecord>({ source: '', target: '', label: 'LINK', weight: 2 })
const newVec  = ref<VectorRecord & { tagsRaw?: string }>({ id: '', label: '', x: 0, y: 0, cluster: 0, score: 0.7, tags: [] })

// ── Category colour map ───────────────────────────────────────────────────────
const CAT_COLORS = ['#5794f2','#73bf69','#fade2a','#ff9830','#f2495c','#b877d9','#56a64b','#e0b400','#c4162a','#8f3bb8']
function catStyle(cat: number) {
  const c = CAT_COLORS[cat % CAT_COLORS.length]
  return { background: c + '22', color: c, border: `1px solid ${c}66` }
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function refresh() {
  loading.value = true
  const [dsRes, nodeRes, edgeRes, vecRes] = await Promise.all([
    api.getDatasets(),
    api.getStoreNodes(),
    api.getStoreEdges(),
    api.getStoreVectors(),
  ])
  if (dsRes)   datasets.value = dsRes.datasets
  if (nodeRes) nodes.value    = nodeRes.nodes
  if (edgeRes) edges.value    = edgeRes.edges
  if (vecRes)  vectors.value  = vecRes.vectors
  loading.value = false
}

async function loadDataset(name: string) {
  loading.value = true
  await api.postLoadDataset(name)
  currentDataset.value = name
  await refresh()
}

async function addNode() {
  await api.postStoreNode({ ...newNode.value })
  newNode.value = { id: '', label: '', category: 0, value: 5, symbolSize: 28 }
  showAddNode.value = false
  const res = await api.getStoreNodes()
  if (res) nodes.value = res.nodes
}

async function deleteNode(id: string) {
  await api.deleteStoreNode(id)
  const res = await api.getStoreNodes()
  if (res) nodes.value = res.nodes
}

async function addEdge() {
  await api.postStoreEdge({ ...newEdge.value })
  newEdge.value = { source: '', target: '', label: 'LINK', weight: 2 }
  showAddEdge.value = false
  const res = await api.getStoreEdges()
  if (res) edges.value = res.edges
}

async function deleteEdge(source: string, target: string) {
  await api.deleteStoreEdge(`${source}->${target}`)
  const res = await api.getStoreEdges()
  if (res) edges.value = res.edges
}

async function addVector() {
  const tags = (newVec.value.tagsRaw ?? '').split(',').map(t => t.trim()).filter(Boolean)
  await api.postStoreVector({ ...newVec.value, tags })
  newVec.value = { id: '', label: '', x: 0, y: 0, cluster: 0, score: 0.7, tags: [] }
  showAddVector.value = false
  const res = await api.getStoreVectors()
  if (res) vectors.value = res.vectors
}

async function deleteVector(id: string) {
  await api.deleteStoreVector(id)
  const res = await api.getStoreVectors()
  if (res) vectors.value = res.vectors
}

onMounted(refresh)
</script>

<style scoped>
.collections-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0;
}

/* Tab bar */
.tab-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  margin-bottom: 12px;
}
.tab-spacer { flex: 1; }
.tab-btn {
  padding: 7px 16px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
}
.tab-btn:hover { color: var(--text-primary); }
.tab-btn.active {
  color: var(--accent-blue);
  border-bottom-color: var(--accent-blue);
}

.tab-content { flex: 1; overflow: auto; }

/* Dataset grid */
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 12px;
}
.dataset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 10px;
}
.dataset-card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.15s;
}
.dataset-card.active { border-color: var(--accent-blue); }
.ds-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.ds-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.ds-desc { font-size: 12px; line-height: 1.4; }
.ds-meta { display: flex; flex-wrap: wrap; gap: 4px; }
.meta-chip {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}
.tag-chip {
  font-size: 10px; padding: 2px 6px; border-radius: 3px;
  background: rgba(87,148,242,0.12); border: 1px solid rgba(87,148,242,0.3);
  color: var(--accent-blue);
}
.btn-active { background: rgba(87,148,242,0.15) !important; border-color: var(--accent-blue) !important; color: var(--accent-blue) !important; }

/* Table toolbar */
.table-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.table-toolbar .section-title { margin-bottom: 0; }
.toolbar-right { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.count-badge {
  font-size: 11px; padding: 1px 6px; border-radius: 8px;
  background: rgba(87,148,242,0.15); color: var(--accent-blue);
  font-weight: 600;
}
.search-input {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 5px 10px;
  color: var(--text-primary);
  font-size: 12px;
  width: 200px;
}
.search-input:focus { outline: none; border-color: var(--accent-blue); }

/* Add form */
.add-form { padding: 10px 12px; margin-bottom: 10px; }
.form-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.form-input {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 5px 10px;
  color: var(--text-primary);
  font-size: 12px;
  flex: 1;
  min-width: 100px;
}
.form-input:focus { outline: none; border-color: var(--accent-blue); }

/* Table */
.table-wrap { overflow-x: auto; }
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.data-table th {
  text-align: left;
  padding: 7px 10px;
  color: var(--text-muted);
  font-weight: 500;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}
.data-table th:hover { color: var(--text-primary); }
.data-table td {
  padding: 6px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  color: var(--text-primary);
}
.data-table tr:hover td { background: rgba(255,255,255,0.02); }
.sort-icon { font-size: 10px; opacity: 0.5; }
.mono { font-family: var(--font-mono); font-size: 11px; }
.text-accent-blue  { color: var(--accent-blue); }
.text-accent-green { color: var(--accent-green); }
.empty-row { text-align: center; padding: 24px !important; }

.cat-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 18px; padding: 0 5px;
  border-radius: 3px; font-size: 11px; font-weight: 600;
}
.label-chip {
  font-family: var(--font-mono); font-size: 10px; padding: 2px 6px;
  border-radius: 3px; background: var(--bg-secondary); border: 1px solid var(--border);
}

/* Weight / score bars */
.weight-bar, .score-bar {
  display: flex; align-items: center; gap: 6px;
}
.weight-fill {
  height: 4px; border-radius: 2px;
  background: var(--accent-blue); min-width: 2px;
}
.score-fill {
  height: 4px; border-radius: 2px;
  background: var(--accent-green); min-width: 2px;
}
.weight-bar span, .score-bar span { font-family: var(--font-mono); font-size: 11px; }

/* Buttons */
.btn-sm { font-size: 11px; padding: 4px 10px; }
.btn-add {
  background: rgba(87,148,242,0.1);
  border-color: rgba(87,148,242,0.3);
  color: var(--accent-blue);
}
.btn-add:hover { background: rgba(87,148,242,0.2); }
.btn-icon {
  background: none; border: none; cursor: pointer;
  font-size: 12px; padding: 2px 5px; border-radius: 3px;
  color: var(--text-muted);
  transition: all 0.15s;
}
.btn-icon:hover { background: rgba(255,255,255,0.06); color: var(--text-primary); }
.btn-icon.danger:hover { color: var(--accent-red, #f2495c); background: rgba(242,73,92,0.1); }
</style>

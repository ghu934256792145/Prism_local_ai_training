<template>
  <div class="workbench">

    <!-- ── Left sidebar ──────────────────────────────────────────────────── -->
    <div class="wb-sidebar panel">

      <!-- Panel tab strip -->
      <div class="side-tabs">
        <button v-for="t in SIDE_TABS" :key="t.id" class="side-tab" :class="{ active: sideTab === t.id }" @click="sideTab = t.id" :title="t.label">
          <span v-html="t.icon" />
        </button>
      </div>

      <!-- DATA SOURCE -->
      <div v-if="sideTab === 'data'" class="side-panel">
        <div class="sp-title">Data Source</div>
        <select v-model="selectedDataset" class="ctrl-select full" @change="loadDataset">
          <option value="__store__">Live Store (dynamic)</option>
          <option value="__local__">Local Brain (RAM)</option>
          <optgroup label="Datasets">
            <option v-for="ds in datasets" :key="ds.name" :value="ds.name">{{ ds.label }}</option>
          </optgroup>
        </select>
        <div class="stat-row">
          <span class="stat-chip">{{ graph.nodes.length }} nodes</span>
          <span class="stat-chip">{{ visibleEdges.length }} / {{ graph.edges.length }} edges</span>
          <span v-if="graph.dataset" class="stat-chip">{{ graph.dataset }}</span>
          <span class="stat-chip" :class="wsConnected ? 'ws-live' : 'ws-off'" :title="wsConnected ? 'WebSocket live' : 'WebSocket disconnected'">
            {{ wsConnected ? '⬤ live' : '○ off' }}
          </span>
        </div>
        <!-- JSON drag-drop import -->
        <div class="sp-title" style="margin-top:10px">Import Graph</div>
        <div
          class="drop-zone"
          :class="{ 'drag-over': dragging }"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onFileDrop"
        >
          <div class="drop-hint">{{ importing ? 'Importing…' : 'Drop JSON or CSV file' }}</div>
          <div class="drop-sub text-muted">or</div>
          <label class="chip drop-browse">
            Browse
            <input type="file" accept=".json,.csv,.tsv" style="display:none" @change="onFilePick" />
          </label>
        </div>
        <label class="toggle-row" style="margin-top:6px">
          <input type="checkbox" v-model="importMerge" />
          <span>Merge with existing store</span>
        </label>
        <div v-if="importStatus" class="import-status" :class="importStatus.ok ? 'status-ok' : 'status-err'">
          {{ importStatus.message }}
        </div>

        <div class="sp-title" style="margin-top:10px">View Presets</div>
        <div class="preset-row">
          <input v-model="presetName" class="form-input" placeholder="preset name…" style="flex:1" />
          <button class="chip" @click="savePreset" :disabled="!presetName.trim()">Save</button>
        </div>
        <div v-for="p in presets" :key="p.name" class="preset-item">
          <span class="preset-name">{{ p.name }}</span>
          <button class="btn-icon" @click="loadPreset(p)" title="Load">↩</button>
          <button class="btn-icon danger" @click="deletePreset(p.name)" title="Delete">✕</button>
        </div>

        <!-- LOCAL BRAIN panel -->
        <template v-if="selectedDataset === '__local__'">
          <div class="sp-title" style="margin-top:12px">Local Brain: {{ wbStore.name }}</div>
          <div class="stat-row">
            <span class="stat-chip">{{ wbStore.nodes.length }} nodes</span>
            <span class="stat-chip">{{ wbStore.edges.length }} edges</span>
          </div>
          <div class="chip-row" style="margin-top:4px">
            <button class="chip" @click="seedFromPrismSelf">Seed: Prism Self-Map</button>
            <button class="chip danger" @click="clearLocalBrain">Clear</button>
          </div>
          <div class="sp-subtitle" style="margin-top:8px">Add Node</div>
          <input v-model="lbNewNode.id" class="form-input" placeholder="id (unique)" />
          <input v-model="lbNewNode.label" class="form-input" style="margin-top:4px" placeholder="label" />
          <div class="chip-row" style="margin-top:4px; align-items:center; gap:4px">
            <span class="text-muted" style="font-size:10px">Cat</span>
            <input v-model.number="lbNewNode.category" type="number" min="0" max="9" class="form-input" style="width:44px;padding:2px 4px" />
            <span class="text-muted" style="font-size:10px">Val</span>
            <input v-model.number="lbNewNode.value" type="number" min="1" max="100" class="form-input" style="width:44px;padding:2px 4px" />
          </div>
          <button class="chip" style="margin-top:4px" @click="addLocalNode" :disabled="!lbNewNode.id.trim()">+ Add node</button>
          <div class="sp-subtitle" style="margin-top:8px">Add Edge</div>
          <input v-model="lbNewEdge.source" class="form-input" placeholder="source id" />
          <input v-model="lbNewEdge.target" class="form-input" style="margin-top:4px" placeholder="target id" />
          <input v-model="lbNewEdge.label" class="form-input" style="margin-top:4px" placeholder="relation label (e.g. USES)" />
          <button class="chip" style="margin-top:4px" @click="addLocalEdge" :disabled="!lbNewEdge.source.trim() || !lbNewEdge.target.trim()">+ Add edge</button>
          <button class="chip" style="margin-top:10px; width:100%; justify-content:center" @click="pushLocalToServer">↑ Push to server</button>
        </template>
      </div>

      <!-- LAYOUT -->
      <div v-if="sideTab === 'layout'" class="side-panel">
        <div class="sp-title">Layout Algorithm</div>
        <div class="chip-row">
          <button v-for="lay in LAYOUTS" :key="lay.id" class="chip" :class="{ active: layout === lay.id }" @click="layout = lay.id; redraw()">{{ lay.label }}</button>
        </div>
        <template v-if="layout === 'force'">
          <div class="sp-title" style="margin-top:8px">Force params</div>
          <div class="param-row"><label>Repulsion</label><input v-model.number="force.repulsion" type="range" min="50" max="800" step="10" class="range-input" @input="redraw" /><span class="range-val">{{ force.repulsion }}</span></div>
          <div class="param-row"><label>Edge len</label><input v-model.number="force.edgeLength" type="range" min="30" max="400" step="10" class="range-input" @input="redraw" /><span class="range-val">{{ force.edgeLength }}</span></div>
          <div class="param-row"><label>Gravity</label><input v-model.number="force.gravity" type="range" min="0" max="1" step="0.01" class="range-input" @input="redraw" /><span class="range-val">{{ force.gravity.toFixed(2) }}</span></div>
        </template>
        <div class="sp-title" style="margin-top:10px">Node labels</div>
        <label class="toggle-row"><input type="checkbox" v-model="showLabels" @change="redraw" /><span>Show labels</span></label>
        <label class="toggle-row"><input type="checkbox" v-model="showEdgeLabels" @change="redraw" /><span>Show edge labels</span></label>
      </div>

      <!-- EDGE RULES -->
      <div v-if="sideTab === 'edges'" class="side-panel">
        <div class="sp-title">Edge Type Rules</div>
        <div class="sp-hint text-secondary">Per-label-type colour, style, visibility.</div>
        <div class="param-row" style="margin-top:4px">
          <label>Weight ≥</label>
          <input v-model.number="edgeWeightMin" type="range" min="0" max="10" step="1" class="range-input" @input="redraw" />
          <span class="range-val">{{ edgeWeightMin }}</span>
        </div>
        <div class="param-row">
          <label>Label</label>
          <input v-model="edgeLabelFilter" class="form-input" placeholder="contains…" @input="redraw" />
        </div>
        <div class="edge-rules-list">
          <div v-for="rule in edgeRules" :key="rule.label" class="edge-rule">
            <label class="toggle-row" style="flex:0 0 auto">
              <input type="checkbox" v-model="rule.visible" @change="redraw" />
            </label>
            <span class="rule-label" :style="{ color: rule.color }">{{ rule.label }}</span>
            <input type="color" v-model="rule.color" class="color-input" @change="redraw" />
            <select v-model="rule.style" class="ctrl-select mini" @change="redraw">
              <option value="solid">——</option>
              <option value="dashed">- -</option>
              <option value="dotted">···</option>
            </select>
            <select v-model="rule.symbol" class="ctrl-select mini" @change="redraw">
              <option value="none">→</option>
              <option value="arrow">▶</option>
              <option value="circle">●</option>
            </select>
            <input v-model.number="rule.width" type="range" min="1" max="6" step="0.5" class="range-input mini" @input="redraw" />
          </div>
        </div>
        <label class="toggle-row" style="margin-top:6px">
          <input type="checkbox" v-model="weightBasedThickness" @change="redraw" />
          <span>Auto-scale width from weight</span>
        </label>
        <button class="chip" style="margin-top:4px" @click="resetEdgeRules">↺ Reset rules</button>
      </div>

      <!-- NODE STYLE -->
      <div v-if="sideTab === 'nodes'" class="side-panel">
        <div class="sp-title">Node Colour</div>
        <div class="chip-row">
          <button v-for="m in NODE_COLOR_MODES" :key="m.id" class="chip" :class="{ active: nodeColorMode === m.id }" @click="nodeColorMode = m.id; redraw()">{{ m.label }}</button>
        </div>
        <div class="sp-title" style="margin-top:8px">Node Size</div>
        <div class="chip-row">
          <button v-for="m in NODE_SIZE_MODES" :key="m.id" class="chip" :class="{ active: nodeSizeMode === m.id }" @click="nodeSizeMode = m.id; redraw()">{{ m.label }}</button>
        </div>
        <div class="sp-title" style="margin-top:8px">Filter / Search</div>
        <input v-model="nodeFilter" class="form-input" placeholder="id or label contains…" @input="redraw" />
        <div v-if="filterMatchSet" class="stat-row" style="margin-top:3px">
          <span class="stat-chip">{{ filterMatchSet.size }} match{{ filterMatchSet.size !== 1 ? 'es' : '' }}</span>
          <button class="chip" @click="nodeFilter=''; redraw()">✕ clear</button>
        </div>
        <div class="sp-title" style="margin-top:8px">Focus</div>
        <input v-model="focusNode" class="form-input" placeholder="node id to focus…" @input="redraw" />
        <button v-if="focusNode" class="chip" style="margin-top:4px" @click="focusNode=''; redraw()">Clear focus</button>
        <div class="sp-title" style="margin-top:8px">Subgraph Extraction</div>
        <div class="param-row">
          <label>Hops</label>
          <input v-model.number="subgraphHops" type="range" min="1" max="5" step="1" class="range-input" />
          <span class="range-val">{{ subgraphHops }}</span>
        </div>
        <div class="sp-hint text-secondary" style="margin-top:2px">Select a node then press <kbd>E</kbd> to extract its N-hop neighbourhood. Press <kbd>Esc</kbd> to restore.</div>
        <button v-if="isSubgraphActive" class="chip" @click="restoreGraph">↩ Restore full graph</button>
      </div>

      <!-- OVERLAYS -->
      <div v-if="sideTab === 'overlays'" class="side-panel">
        <div class="sp-title">Background</div>
        <label class="toggle-row"><input type="checkbox" v-model="overlayMap" @change="redraw" /><span>Image / map overlay</span></label>
        <div v-if="overlayMap" class="overlay-sub">
          <input v-model="mapUrl" class="form-input" placeholder="Image URL or data URI" @change="redraw" />
          <div class="param-row"><label>Opacity</label><input v-model.number="mapOpacity" type="range" min="0.02" max="0.7" step="0.01" class="range-input" @input="redraw" /><span class="range-val">{{ mapOpacity.toFixed(2) }}</span></div>
          <div class="sp-hint text-secondary">Position nodes via map coords: assign x/y in node data to match image pixel space. Use "Free" layout to prevent re-layout.</div>
          <button class="chip" @click="layout='none'; redraw()">Lock to image (Free layout)</button>
        </div>

        <div class="sp-title" style="margin-top:10px">UI Overlays</div>
        <label class="toggle-row"><input type="checkbox" v-model="showMinimap" @change="showMinimap && $nextTick(drawMinimap)" /><span>Minimap</span></label>
        <div class="sp-title" style="margin-top:10px">Data Overlays</div>
        <label class="toggle-row"><input type="checkbox" v-model="overlayVectors" @change="redraw" /><span>Vector embedding cloud</span></label>
        <label class="toggle-row"><input type="checkbox" v-model="overlayHeatmap" @change="redraw" /><span>Node value heatmap rings</span></label>
        <label class="toggle-row"><input type="checkbox" v-model="overlayGrid" @change="redraw" /><span>Coordinate grid</span></label>
        <label class="toggle-row"><input type="checkbox" v-model="overlayDegree" @change="redraw" /><span>Degree centrality glow</span></label>

        <div v-if="overlayVectors" class="overlay-sub">
          <div class="param-row"><label>V. size</label><input v-model.number="vectorDotSize" type="range" min="2" max="14" step="1" class="range-input" @input="redraw" /><span class="range-val">{{ vectorDotSize }}</span></div>
          <div class="param-row"><label>V. opacity</label><input v-model.number="vectorOpacity" type="range" min="0.1" max="1" step="0.05" class="range-input" @input="redraw" /><span class="range-val">{{ vectorOpacity.toFixed(2) }}</span></div>
        </div>
      </div>

      <!-- COMPUTE -->
      <div v-if="sideTab === 'compute'" class="side-panel">
        <div class="sp-title">Graph Algorithms</div>

        <!-- BFS step-through animation -->
        <div class="compute-block">
          <div class="sp-subtitle">BFS Traversal Animation</div>
          <input v-model="traverseFrom" class="form-input" placeholder="source node id" />
          <div class="chip-row">
            <button class="chip" :class="{ active: traverseAlgo === 'bfs' }" @click="traverseAlgo = 'bfs'">BFS</button>
            <button class="chip" :class="{ active: traverseAlgo === 'dfs' }" @click="traverseAlgo = 'dfs'">DFS</button>
          </div>
          <div class="param-row">
            <label>Speed</label>
            <input v-model.number="traverseSpeed" type="range" min="80" max="1200" step="40" class="range-input" />
            <span class="range-val">{{ traverseSpeed }}ms</span>
          </div>
          <div class="traverse-controls">
            <button class="chip" :disabled="!traverseFrom" @click="startTraverse">▶ Load</button>
            <button class="chip" :disabled="!traverseLevels.length || traversePlaying" @click="stepTraverse(-1)">‹</button>
            <button class="chip" :disabled="!traverseLevels.length" @click="toggleTraversePlay">
              {{ traversePlaying ? '⏸' : '⏵' }}
            </button>
            <button class="chip" :disabled="!traverseLevels.length || traversePlaying" @click="stepTraverse(1)">›</button>
            <button class="chip text-muted" @click="clearTraverse">✕</button>
          </div>
          <div v-if="traverseLevels.length" class="traverse-progress">
            <div class="traverse-bar-wrap">
              <div class="traverse-bar-fill" :style="{ width: `${traverseStep / Math.max(traverseLevels.length - 1, 1) * 100}%` }" />
            </div>
            <span class="traverse-label text-muted">
              depth {{ traverseStep }} / {{ traverseLevels.length - 1 }} · {{ traverseVisited.size }} visited
            </span>
          </div>
        </div>

        <div class="compute-block">
          <div class="sp-subtitle">BFS Shortest Path</div>
          <input v-model="pathSource" class="form-input" placeholder="source node id" />
          <input v-model="pathTarget" class="form-input" placeholder="target node id" />
          <button class="chip" @click="runBFS" :disabled="!pathSource || !pathTarget">Find path</button>
          <div v-if="bfsResult !== null" class="compute-result">
            <span v-if="bfsResult.length === 0" class="text-secondary">No path found</span>
            <template v-else>
              <span class="result-label">{{ bfsResult.length - 1 }} hops</span>
              <div class="path-chain">
                <span v-for="(id, i) in bfsResult" :key="id" class="path-node mono" @click="focusNode=id;redraw()">
                  {{ id }}<span v-if="i < bfsResult.length - 1" class="path-arrow">→</span>
                </span>
              </div>
            </template>
          </div>
        </div>

        <div class="compute-block">
          <div class="sp-subtitle">Centrality (Rust engine)</div>
          <div class="chip-row">
            <button class="chip" :class="{ active: rustCentralityMetric === 'degree' }" @click="rustCentralityMetric = 'degree'">Degree</button>
            <button class="chip" :class="{ active: rustCentralityMetric === 'betweenness' }" @click="rustCentralityMetric = 'betweenness'">Betweenness</button>
            <button class="chip" :class="{ active: rustCentralityMetric === 'pagerank' }" @click="rustCentralityMetric = 'pagerank'">PageRank</button>
          </div>
          <button class="chip" :disabled="centralityLoading" @click="fetchRustCentrality">
            {{ centralityLoading ? 'Computing…' : '▶ Compute' }}
          </button>
          <div v-if="rustCentrality.length" class="centrality-list">
            <div v-for="cs in rustCentrality.slice(0, 15)" :key="cs.id" class="centrality-row" @click="focusNode=cs.id;redraw()">
              <span class="centrality-rank">#{{ cs.rank }}</span>
              <span class="centrality-bar" :style="{ width: `${(cs.score / (rustCentrality[0]?.score || 1)) * 100}%` }" />
              <span class="mono centrality-id">{{ cs.label }}</span>
              <span class="centrality-val">{{ cs.score.toFixed(4) }}</span>
            </div>
          </div>
        </div>

        <div class="compute-block">
          <div class="sp-subtitle">Degree (client-side)</div>
          <button class="chip" @click="runDegreeCentrality">Compute</button>
          <div v-if="degreeCentrality.length" class="centrality-list">
            <div v-for="d in degreeCentrality.slice(0,10)" :key="d.id" class="centrality-row" @click="focusNode=d.id;redraw()">
              <span class="centrality-bar" :style="{ width: `${d.pct}%` }" />
              <span class="mono centrality-id">{{ d.id }}</span>
              <span class="centrality-val">{{ d.degree }}</span>
            </div>
          </div>
        </div>

        <div class="compute-block">
          <div class="sp-subtitle">Graph Statistics</div>
          <button class="chip" :disabled="statsLoading" @click="runGraphStats">
            {{ statsLoading ? 'Computing…' : '▶ Compute stats' }}
          </button>
          <div v-if="graphStats" class="stats-grid">
            <span class="stats-key">Nodes</span><span class="stats-val">{{ graphStats.nodeCount }}</span>
            <span class="stats-key">Edges</span><span class="stats-val">{{ graphStats.edgeCount }}</span>
            <span class="stats-key">Density</span><span class="stats-val">{{ graphStats.density }}</span>
            <span class="stats-key">Avg degree</span><span class="stats-val">{{ graphStats.avgDegree }}</span>
            <span class="stats-key">Components</span><span class="stats-val">{{ graphStats.components }}</span>
            <span class="stats-key">Diameter</span>
            <span class="stats-val">{{ graphStats.diameter !== null ? graphStats.diameter : graphStats.nodeCount > 300 ? '(>300 nodes)' : '—' }}</span>
          </div>
        </div>

        <div class="compute-block">
          <div class="sp-subtitle">Node Filter (compute subset)</div>
          <label class="toggle-row"><input type="checkbox" v-model="filterByCategory" @change="redraw" /><span>Filter by category</span></label>
          <div v-if="filterByCategory" class="chip-row" style="margin-top:4px">
            <button
              v-for="(cat, i) in graph.categories"
              :key="cat"
              class="chip"
              :class="{ active: activeCats.has(i) }"
              :style="activeCats.has(i) ? { borderColor: CAT_COLORS[i % CAT_COLORS.length], color: CAT_COLORS[i % CAT_COLORS.length] } : {}"
              @click="toggleCat(i)"
            >{{ cat }}</button>
          </div>
        </div>
      </div>

      <!-- EXPORT -->
      <div v-if="sideTab === 'export'" class="side-panel">
        <div class="sp-title">Export</div>
        <button class="chip full" @click="exportPNG">↓ PNG (current view)</button>
        <button class="chip full" @click="exportSVG">↓ SVG</button>
        <button class="chip full" @click="exportJSON">↓ JSON (nodes + edges)</button>
        <button class="chip full" @click="exportCSV('nodes')">↓ CSV — Nodes</button>
        <button class="chip full" @click="exportCSV('edges')">↓ CSV — Edges</button>
        <button class="chip full" @click="exportGEXF">↓ GEXF (Gephi)</button>
      </div>

    </div><!-- /.wb-sidebar -->

    <!-- ── Main chart area ───────────────────────────────────────────────── -->
    <div class="wb-main" ref="mainEl">

      <!-- Background image/map -->
      <div
        v-if="overlayMap && mapUrl"
        class="map-overlay"
        :style="{ backgroundImage: `url('${mapUrl}')`, opacity: mapOpacity }"
      />

      <!-- Coordinate grid (CSS) -->
      <div v-if="overlayGrid" class="grid-overlay" />

      <!-- ECharts canvas -->
      <div ref="chartEl" class="wb-chart" />

      <!-- BFS path highlight ribbon -->
      <div v-if="bfsResult && bfsResult.length > 1" class="path-ribbon">
        <span class="path-ribbon-label">Path:</span>
        <span v-for="(id, i) in bfsResult" :key="id" class="mono path-hop" @click="focusNode=id;redraw()">
          {{ id }}<span v-if="i < bfsResult.length - 1" class="path-sep">›</span>
        </span>
        <button class="btn-icon" @click="bfsResult=null;redraw()">✕</button>
      </div>

      <!-- Subgraph extraction banner -->
      <div v-if="isSubgraphActive" class="subgraph-banner">
        <span class="subgraph-label">Subgraph extracted — {{ graph.nodes.length }} nodes, {{ graph.edges.length }} edges</span>
        <button class="btn-icon" @click="restoreGraph" title="Restore full graph (Esc)">↩ Restore</button>
      </div>

      <!-- Selected node info -->
      <transition name="slide-in">
        <div v-if="selectedNode" class="node-info-panel panel">
          <div class="ni-header">
            <span class="ni-id mono">{{ selectedNode.id }}</span>
            <span class="badge" :style="catBadgeStyle(selectedNode.category)">cat {{ selectedNode.category }}</span>
            <button class="btn-icon" @click="selectedNode=null;focusNode='';redraw()">✕</button>
          </div>
          <div class="ni-row"><span class="ni-key">Label</span><span>{{ selectedNode.label }}</span></div>
          <div class="ni-row"><span class="ni-key">Value</span><span>{{ selectedNode.value }}</span></div>
          <div class="ni-row"><span class="ni-key">Size</span><span>{{ selectedNode.symbolSize }}</span></div>
          <div class="ni-row"><span class="ni-key">In-degree</span><span>{{ inDegree(selectedNode.id) }}</span></div>
          <div class="ni-row"><span class="ni-key">Out-degree</span><span>{{ outDegree(selectedNode.id) }}</span></div>
          <div class="ni-edges">
            <div class="ni-key" style="margin-bottom:4px">Edges</div>
            <div v-for="e in edgesOf(selectedNode.id)" :key="`${e.source}-${e.target}`" class="ni-edge-row">
              <span class="ni-edge-dir" :class="e.source===selectedNode.id ? 'out':'in'">{{ e.source===selectedNode.id ? '→' : '←' }}</span>
              <span class="mono ni-edge-peer" @click="selectNodeById(e.source===selectedNode.id ? e.target : e.source)">{{ e.source===selectedNode.id ? e.target : e.source }}</span>
              <span class="ni-edge-label label-chip">{{ e.label }}</span>
            </div>
          </div>
        </div>
      </transition>

      <!-- Legend -->
      <div v-if="graph.categories.length && nodeColorMode==='category'" class="legend-panel">
        <div v-for="(cat, i) in graph.categories" :key="cat" class="legend-item">
          <span class="legend-dot" :style="{ background: CAT_COLORS[i % CAT_COLORS.length] }" />
          <span class="legend-label">{{ cat }}</span>
        </div>
      </div>

      <!-- Minimap -->
      <canvas
        v-if="showMinimap"
        ref="minimapEl"
        class="minimap-canvas"
        width="180"
        height="120"
        title="Click to hide minimap"
        @click="showMinimap = false"
      />
      <button v-else class="minimap-toggle" title="Show minimap" @click="showMinimap = true; $nextTick(drawMinimap)">⊞</button>

    </div><!-- /.wb-main -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import {
  usePrismAPI,
  type NodeRecord, type EdgeRecord, type DatasetInfo,
  type CentralityScore,
} from '@/composables/usePrismAPI'
import { useWebSocket } from '@/composables/useWebSocket'
import { useWorkbenchStore } from '@/stores/workbenchStore'

const api = usePrismAPI()
const wbStore = useWorkbenchStore()

// ── Sidebar tabs ──────────────────────────────────────────────────────────────
const SIDE_TABS = [
  { id: 'data',     label: 'Data',      icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></svg>` },
  { id: 'layout',   label: 'Layout',    icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>` },
  { id: 'edges',    label: 'Edges',     icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="20" x2="20" y2="4"/><circle cx="4" cy="20" r="2"/><circle cx="20" cy="4" r="2"/></svg>` },
  { id: 'nodes',    label: 'Nodes',     icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><circle cx="4" cy="4" r="2"/><circle cx="20" cy="4" r="2"/><circle cx="4" cy="20" r="2"/><circle cx="20" cy="20" r="2"/></svg>` },
  { id: 'overlays', label: 'Overlays',  icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/></svg>` },
  { id: 'compute',  label: 'Compute',   icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>` },
  { id: 'export',   label: 'Export',    icon: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>` },
]
const sideTab = ref('data')

// ── Constants ─────────────────────────────────────────────────────────────────
const CAT_COLORS = ['#5794f2','#73bf69','#fade2a','#ff9830','#f2495c','#b877d9','#56a64b','#e0b400','#c4162a','#8f3bb8']
const LAYOUTS = [
  { id: 'force',        label: 'Force' },
  { id: 'circular',     label: 'Circular' },
  { id: 'hierarchical', label: 'Hierarchy' },
  { id: 'none',         label: 'Free' },
]
const NODE_COLOR_MODES = [
  { id: 'category', label: 'Category' },
  { id: 'value',    label: 'Heat' },
  { id: 'degree',   label: 'Degree' },
  { id: 'uniform',  label: 'Flat' },
]
const NODE_SIZE_MODES = [
  { id: 'symbolSize', label: 'Field' },
  { id: 'value',      label: 'Value' },
  { id: 'degree',     label: 'Degree' },
  { id: 'uniform',    label: 'Flat' },
]

// ── State ─────────────────────────────────────────────────────────────────────
const datasets      = ref<DatasetInfo[]>([])
const selectedDataset = ref('__store__')

interface LiveGraph { nodes: NodeRecord[]; edges: EdgeRecord[]; categories: string[]; dataset: string }
const graph = ref<LiveGraph>({ nodes: [], edges: [], categories: [], dataset: '' })
const vectors = ref<{ id: string; x: number; y: number; cluster: number; score: number }[]>([])

// Layout
const layout      = ref('force')
const force       = reactive({ repulsion: 200, edgeLength: 120, gravity: 0.05 })
const showLabels  = ref(true)
const showEdgeLabels = ref(false)

// Node style
const nodeColorMode = ref('category')
const nodeSizeMode  = ref('symbolSize')
const focusNode     = ref('')
const filterByCategory = ref(false)
const activeCats    = ref(new Set<number>())

// Overlays
const overlayMap      = ref(false)
const mapUrl          = ref('')
const mapOpacity      = ref(0.2)
const overlayVectors  = ref(false)
const vectorDotSize   = ref(5)
const vectorOpacity   = ref(0.5)
const overlayHeatmap  = ref(false)
const overlayGrid     = ref(false)
const overlayDegree   = ref(false)

// Edge rules (per-label-type custom styling)
interface EdgeRule { label: string; visible: boolean; color: string; style: string; symbol: string; width: number }
const edgeRules           = ref<EdgeRule[]>([])
const edgeLabelFilter     = ref('')
const edgeWeightMin       = ref(0)
const weightBasedThickness = ref(false)

// Node filter
const nodeFilter = ref('')

// Compute
const pathSource   = ref('')
const pathTarget   = ref('')
const bfsResult    = ref<string[] | null>(null)
const degreeCentrality = ref<{ id: string; degree: number; pct: number }[]>([])
const components   = ref<number | null>(null)

// Graph stats
interface GraphStats {
  nodeCount: number; edgeCount: number
  density: number; avgDegree: number
  components: number; diameter: number | null
}
const graphStats     = ref<GraphStats | null>(null)
const statsLoading   = ref(false)

// Node selection
const selectedNode = ref<NodeRecord | null>(null)

// ── Subgraph extraction ───────────────────────────────────────────────────────
const subgraphHops = ref(2)
let savedGraph: { nodes: NodeRecord[]; edges: EdgeRecord[] } | null = null
const isSubgraphActive = ref(false)

// ── Traversal animation state ─────────────────────────────────────────────────
const traverseFrom    = ref('')
const traverseAlgo    = ref<'bfs' | 'dfs'>('bfs')
const traverseLevels  = ref<string[][]>([])
const traverseEdgesUsed = ref<[string, string][]>([])
const traverseStep    = ref(0)
const traversePlaying = ref(false)
const traverseSpeed   = ref(400)
let   traverseTimer: number | null = null

const traverseVisited = computed(() => {
  const s = new Set<string>()
  for (let i = 0; i <= traverseStep.value; i++) {
    (traverseLevels.value[i] ?? []).forEach(id => s.add(id))
  }
  return s
})

// ── Local Brain form state ────────────────────────────────────────────────────
const lbNewNode = reactive({ id: '', label: '', category: 0, value: 5 })
const lbNewEdge = reactive({ source: '', target: '', label: 'USES' })

// ── JSON import state ─────────────────────────────────────────────────────────
const dragging      = ref(false)
const importing     = ref(false)
const importMerge   = ref(false)
const importStatus  = ref<{ ok: boolean; message: string } | null>(null)

// ── Rust centrality ───────────────────────────────────────────────────────────
const rustCentralityMetric  = ref<'degree' | 'betweenness' | 'pagerank'>('degree')
const rustCentrality        = ref<CentralityScore[]>([])
const centralityLoading     = ref(false)

// View presets
interface ViewPreset { name: string; config: Record<string, any> }
const presets       = ref<ViewPreset[]>([])
const presetName    = ref('')

// Chart
const chartEl = ref<HTMLElement | null>(null)
const mainEl  = ref<HTMLElement | null>(null)
let chart: echarts.ECharts | null = null

// ── Minimap ───────────────────────────────────────────────────────────────────
const minimapEl   = ref<HTMLCanvasElement | null>(null)
const showMinimap = ref(true)

function drawMinimap() {
  const canvas = minimapEl.value
  if (!canvas || !chart || !showMinimap.value) return
  const ctx = canvas.getContext('2d')!
  const W = canvas.width, H = canvas.height
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(14,18,26,0.9)'
  ctx.fillRect(0, 0, W, H)

  // Access ECharts internal layout positions
  const model = (chart as any).getModel()
  const allSeries: any[] = model.getSeries()
  if (!allSeries.length) return
  const mainSeries = allSeries[allSeries.length - 1]
  const nodeData = mainSeries.getData()

  type Pos = { x: number; y: number }
  const idToPos = new Map<string, Pos>()
  const dots: { x: number; y: number; color: string }[] = []

  for (let i = 0; i < nodeData.count(); i++) {
    const layout = nodeData.getItemLayout(i) as Pos | undefined
    if (!layout || !isFinite(layout.x) || !isFinite(layout.y)) continue
    const node = visibleNodes.value[i]
    if (!node) continue
    idToPos.set(node.id, layout)
    dots.push({ x: layout.x, y: layout.y, color: nodeColor(node) })
  }

  if (!dots.length) return

  const xs = dots.map(d => d.x), ys = dots.map(d => d.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const pad = 9
  const rX = maxX - minX || 1, rY = maxY - minY || 1
  const sc = Math.min((W - pad * 2) / rX, (H - pad * 2) / rY)
  const ox = pad + ((W - pad * 2) - rX * sc) / 2 - minX * sc
  const oy = pad + ((H - pad * 2) - rY * sc) / 2 - minY * sc
  const mx = (x: number) => ox + x * sc
  const my = (y: number) => oy + y * sc

  // Draw edges
  ctx.strokeStyle = 'rgba(100,115,150,0.22)'
  ctx.lineWidth = 0.5
  for (const e of visibleEdges.value) {
    const sp = idToPos.get(e.source), tp = idToPos.get(e.target)
    if (!sp || !tp) continue
    ctx.beginPath(); ctx.moveTo(mx(sp.x), my(sp.y)); ctx.lineTo(mx(tp.x), my(tp.y)); ctx.stroke()
  }

  // Draw nodes
  for (const d of dots) {
    ctx.beginPath(); ctx.arc(mx(d.x), my(d.y), 2.5, 0, Math.PI * 2)
    ctx.fillStyle = d.color; ctx.fill()
  }

  // Border
  ctx.strokeStyle = 'rgba(87,148,242,0.3)'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1)
}

// ── Edge rules builder ────────────────────────────────────────────────────────
const DEFAULT_EDGE_COLORS: Record<string, string> = {
  CRUD:'#5794f2', READ:'#73bf69', WRITE:'#fade2a', ALERT:'#f2495c', PUBLISH:'#ff9830',
  CONSUME:'#b877d9', AUTH:'#55c8e8', ROUTES:'#73bf69', DEPENDS_ON:'#ff9830',
  TARGETS:'#5794f2', MONITORS:'#b877d9', ALLOW:'#73bf69', DENY:'#f2495c',
  LINK:'#666', CALLS:'#5794f2', SHIPS:'#fade2a', SUPPLIES:'#ff9830',
}

function buildEdgeRules(edges: EdgeRecord[]) {
  const labels = [...new Set(edges.map(e => e.label))]
  const existing = new Map(edgeRules.value.map(r => [r.label, r]))
  edgeRules.value = labels.map(label => existing.get(label) ?? {
    label,
    visible: true,
    color: DEFAULT_EDGE_COLORS[label.split('_')[0]] ?? '#555a6e',
    style: 'solid',
    symbol: 'arrow',
    width: 1.5,
  })
}

function resetEdgeRules() {
  const labels = [...new Set(graph.value.edges.map(e => e.label))]
  edgeRules.value = labels.map(label => ({
    label,
    visible: true,
    color: DEFAULT_EDGE_COLORS[label.split('_')[0]] ?? '#555a6e',
    style: 'solid',
    symbol: 'arrow',
    width: 1.5,
  }))
  redraw()
}

// ── Derived edge/node sets ────────────────────────────────────────────────────
const ruleMap = computed(() => new Map(edgeRules.value.map(r => [r.label, r])))

const visibleEdges = computed(() => {
  let edges = graph.value.edges
  // Rule visibility
  edges = edges.filter(e => ruleMap.value.get(e.label)?.visible !== false)
  // Label filter
  if (edgeLabelFilter.value.trim()) {
    const q = edgeLabelFilter.value.toLowerCase()
    edges = edges.filter(e => e.label.toLowerCase().includes(q))
  }
  // Weight filter
  if (edgeWeightMin.value > 0) edges = edges.filter(e => e.weight >= edgeWeightMin.value)
  return edges
})

const nodeFilterLower = computed(() => nodeFilter.value.trim().toLowerCase())
const filterMatchSet = computed(() => {
  if (!nodeFilterLower.value) return null
  const q = nodeFilterLower.value
  const s = new Set<string>()
  for (const n of graph.value.nodes) {
    if (n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q)) s.add(n.id)
  }
  return s
})

const visibleNodes = computed(() => {
  let nodes = graph.value.nodes
  if (filterByCategory.value && activeCats.value.size > 0)
    nodes = nodes.filter(n => activeCats.value.has(n.category))
  return nodes
})

// ── Degree helpers ────────────────────────────────────────────────────────────
function inDegree(id: string)  { return graph.value.edges.filter(e => e.target === id).length }
function outDegree(id: string) { return graph.value.edges.filter(e => e.source === id).length }
function totalDegree(id: string) { return inDegree(id) + outDegree(id) }
function edgesOf(id: string)   { return graph.value.edges.filter(e => e.source === id || e.target === id) }
function neighborsOf(id: string) {
  const s = new Set<string>()
  for (const e of graph.value.edges) {
    if (e.source === id) s.add(e.target)
    if (e.target === id) s.add(e.source)
  }
  return [...s]
}

// ── Category toggle ───────────────────────────────────────────────────────────
function toggleCat(i: number) {
  const s = new Set(activeCats.value)
  s.has(i) ? s.delete(i) : s.add(i)
  activeCats.value = s
  redraw()
}

// ── Colour helpers ────────────────────────────────────────────────────────────
function nodeColor(n: NodeRecord) {
  if (nodeColorMode.value === 'uniform') return '#5794f2'
  if (nodeColorMode.value === 'value') {
    const maxV = Math.max(...graph.value.nodes.map(x => x.value), 1)
    return lerpColor('#1a2a3e', '#f2495c', n.value / maxV)
  }
  if (nodeColorMode.value === 'degree') {
    const maxD = Math.max(...graph.value.nodes.map(x => totalDegree(x.id)), 1)
    return lerpColor('#1e3a2a', '#73bf69', totalDegree(n.id) / maxD)
  }
  return CAT_COLORS[n.category % CAT_COLORS.length]
}

function lerpColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a), cb = hexToRgb(b)
  if (!ca || !cb) return a
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t)
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t)
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t)
  return `rgb(${r},${g},${bl})`
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null
}

function nodeSize(n: NodeRecord) {
  if (nodeSizeMode.value === 'uniform') return 24
  if (nodeSizeMode.value === 'value')   return 14 + n.value * 1.6
  if (nodeSizeMode.value === 'degree')  return 14 + totalDegree(n.id) * 2.5
  return Math.max(16, n.symbolSize ?? 28)
}

function catBadgeStyle(cat: number) {
  const c = CAT_COLORS[cat % CAT_COLORS.length]
  return { background: c + '22', color: c, border: `1px solid ${c}55`, borderRadius: '3px', padding: '1px 5px', fontSize: '10px' }
}

// ── BFS (client-side on live data) ───────────────────────────────────────────
function runBFS() {
  const nodes = graph.value.nodes
  const edges = graph.value.edges
  const src = pathSource.value.trim(), tgt = pathTarget.value.trim()
  if (!src || !tgt) return
  if (src === tgt) { bfsResult.value = [src]; return }

  const adj = new Map<string, string[]>()
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, [])
    adj.get(e.source)!.push(e.target)
  }
  const nodeIds = new Set(nodes.map(n => n.id))
  if (!nodeIds.has(src) || !nodeIds.has(tgt)) { bfsResult.value = []; return }

  const prev = new Map<string, string>()
  const seen = new Set([src])
  const queue = [src]
  let found = false
  while (queue.length && !found) {
    const cur = queue.shift()!
    for (const nb of (adj.get(cur) ?? [])) {
      if (!seen.has(nb)) {
        seen.add(nb); prev.set(nb, cur); queue.push(nb)
        if (nb === tgt) { found = true; break }
      }
    }
  }
  if (!found) { bfsResult.value = []; return }
  const path: string[] = []
  let cur = tgt
  while (cur !== src) { path.push(cur); cur = prev.get(cur)! }
  path.push(src)
  bfsResult.value = path.reverse()
  redraw()
}

function runDegreeCentrality() {
  const nodes = graph.value.nodes
  const max = Math.max(...nodes.map(n => totalDegree(n.id)), 1)
  degreeCentrality.value = [...nodes]
    .sort((a, b) => totalDegree(b.id) - totalDegree(a.id))
    .slice(0, 20)
    .map(n => ({ id: n.id, degree: totalDegree(n.id), pct: (totalDegree(n.id) / max) * 100 }))
}

// ── Subgraph extraction (E key) ───────────────────────────────────────────────
function extractSubgraph(rootId: string, hops: number) {
  const adj = new Map<string, string[]>()
  for (const e of graph.value.edges) {
    if (!adj.has(e.source)) adj.set(e.source, [])
    if (!adj.has(e.target)) adj.set(e.target, [])
    adj.get(e.source)!.push(e.target)
    adj.get(e.target)!.push(e.source)
  }
  const reached = new Map<string, number>([[rootId, 0]])
  const queue = [rootId]
  let qi = 0
  while (qi < queue.length) {
    const cur = queue[qi++]
    const d = reached.get(cur)!
    if (d >= hops) continue
    for (const nb of (adj.get(cur) ?? [])) {
      if (!reached.has(nb)) { reached.set(nb, d + 1); queue.push(nb) }
    }
  }
  savedGraph = { nodes: [...graph.value.nodes], edges: [...graph.value.edges] }
  isSubgraphActive.value = true
  graph.value.nodes = graph.value.nodes.filter(n => reached.has(n.id))
  graph.value.edges = graph.value.edges.filter(e => reached.has(e.source) && reached.has(e.target))
  buildEdgeRules(graph.value.edges)
  redraw()
}

function restoreGraph() {
  if (!savedGraph) return
  graph.value.nodes = savedGraph.nodes
  graph.value.edges = savedGraph.edges
  savedGraph = null
  isSubgraphActive.value = false
  buildEdgeRules(graph.value.edges)
  redraw()
}

function runComponents() {
  const nodes = graph.value.nodes
  const adj = new Map<string, Set<string>>()
  for (const e of graph.value.edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set())
    if (!adj.has(e.target)) adj.set(e.target, new Set())
    adj.get(e.source)!.add(e.target)
    adj.get(e.target)!.add(e.source)
  }
  const visited = new Set<string>()
  let count = 0
  for (const n of nodes) {
    if (!visited.has(n.id)) {
      count++
      const stack = [n.id]
      while (stack.length) {
        const cur = stack.pop()!
        if (visited.has(cur)) continue
        visited.add(cur)
        for (const nb of (adj.get(cur) ?? [])) { if (!visited.has(nb)) stack.push(nb) }
      }
    }
  }
  components.value = count
}

// ── Graph statistics ──────────────────────────────────────────────────────────
function buildUndirectedAdj() {
  const adj = new Map<string, string[]>()
  for (const e of graph.value.edges) {
    if (!adj.has(e.source)) adj.set(e.source, [])
    if (!adj.has(e.target)) adj.set(e.target, [])
    adj.get(e.source)!.push(e.target)
    adj.get(e.target)!.push(e.source)
  }
  return adj
}

function bfsDistances(src: string, adj: Map<string, string[]>): Map<string, number> {
  const dist = new Map<string, number>([[src, 0]])
  const queue = [src]
  while (queue.length) {
    const cur = queue.shift()!
    for (const nb of (adj.get(cur) ?? [])) {
      if (!dist.has(nb)) { dist.set(nb, dist.get(cur)! + 1); queue.push(nb) }
    }
  }
  return dist
}

async function runGraphStats() {
  statsLoading.value = true
  await new Promise(r => setTimeout(r, 0)) // yield to let UI update
  const nodes = graph.value.nodes
  const edges = graph.value.edges
  const n = nodes.length, e = edges.length
  const maxPossible = n > 1 ? n * (n - 1) : 1
  const density = e / maxPossible
  const avgDegree = n > 0 ? (2 * e) / n : 0

  const adj = buildUndirectedAdj()
  // Connected components
  const visited = new Set<string>()
  let comps = 0
  for (const nd of nodes) {
    if (!visited.has(nd.id)) {
      comps++
      const stack = [nd.id]
      while (stack.length) {
        const cur = stack.pop()!
        if (visited.has(cur)) continue
        visited.add(cur)
        for (const nb of (adj.get(cur) ?? [])) { if (!visited.has(nb)) stack.push(nb) }
      }
    }
  }

  // Diameter: only attempt on small graphs (≤300 nodes) to keep it snappy
  let diameter: number | null = null
  if (n <= 300 && n > 0) {
    let maxDist = 0
    for (const nd of nodes) {
      const dists = bfsDistances(nd.id, adj)
      for (const d of dists.values()) { if (d > maxDist) maxDist = d }
    }
    diameter = maxDist > 0 ? maxDist : 0
  }

  graphStats.value = {
    nodeCount: n, edgeCount: e,
    density: Math.round(density * 10000) / 10000,
    avgDegree: Math.round(avgDegree * 100) / 100,
    components: comps, diameter,
  }
  statsLoading.value = false
}

// ── CSV import ────────────────────────────────────────────────────────────────
function parseCsvEdgeList(text: string): { nodes: any[]; edges: any[] } {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'))
  const header = lines[0].toLowerCase().split(',').map(h => h.trim())
  const srcIdx = header.findIndex(h => ['source', 'from', 'src', 'id1'].includes(h))
  const tgtIdx = header.findIndex(h => ['target', 'to', 'dst', 'id2'].includes(h))
  const lblIdx = header.findIndex(h => ['label', 'type', 'rel', 'relation'].includes(h))
  const wgtIdx = header.findIndex(h => ['weight', 'w', 'value'].includes(h))

  const dataStart = (srcIdx >= 0 && tgtIdx >= 0) ? 1 : 0 // skip header row if found
  const si = srcIdx >= 0 ? srcIdx : 0
  const ti = tgtIdx >= 0 ? tgtIdx : 1

  const nodeSet = new Set<string>()
  const edges: any[] = []
  for (const line of lines.slice(dataStart)) {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const src = cols[si], tgt = cols[ti]
    if (!src || !tgt) continue
    nodeSet.add(src); nodeSet.add(tgt)
    edges.push({
      source: src, target: tgt,
      label: lblIdx >= 0 ? (cols[lblIdx] || 'LINK') : 'LINK',
      weight: wgtIdx >= 0 ? (Number(cols[wgtIdx]) || 1) : 1,
    })
  }
  const nodes = [...nodeSet].map(id => ({ id, label: id }))
  return { nodes, edges }
}

// ── Traversal animation ───────────────────────────────────────────────────────
async function startTraverse() {
  clearTraverse()
  const from = traverseFrom.value.trim()
  if (!from) return
  const result = await api.postGraphTraverse(from, traverseAlgo.value, 30)
  if (!result) return
  traverseLevels.value = result.layers
  traverseEdgesUsed.value = (result.edgesUsed as any) ?? []
  traverseStep.value = 0
  redraw()
}

function stepTraverse(dir: number) {
  const next = traverseStep.value + dir
  if (next < 0 || next >= traverseLevels.value.length) return
  traverseStep.value = next
  redraw()
}

function toggleTraversePlay() {
  if (traversePlaying.value) { pauseTraverse(); return }
  if (traverseStep.value >= traverseLevels.value.length - 1) traverseStep.value = 0
  traversePlaying.value = true
  traverseTimer = window.setInterval(() => {
    if (traverseStep.value >= traverseLevels.value.length - 1) { pauseTraverse(); return }
    traverseStep.value++
    redraw()
  }, traverseSpeed.value)
}

function pauseTraverse() {
  traversePlaying.value = false
  if (traverseTimer !== null) { clearInterval(traverseTimer); traverseTimer = null }
}

function clearTraverse() {
  pauseTraverse()
  traverseLevels.value = []
  traverseEdgesUsed.value = []
  traverseStep.value = 0
  redraw()
}

// ── JSON / CSV import ─────────────────────────────────────────────────────────
async function processImportFile(file: File) {
  importing.value = true
  importStatus.value = null
  try {
    const text = await file.text()
    let payload: { nodes: any[]; edges: any[] }
    if (file.name.endsWith('.csv') || file.name.endsWith('.tsv')) {
      payload = parseCsvEdgeList(text)
    } else {
      const json = JSON.parse(text)
      payload = { nodes: json.nodes ?? [], edges: json.edges ?? json.links ?? [] }
    }
    const result = await api.postStoreImport(payload.nodes, payload.edges, importMerge.value)
    if (result?.ok) {
      importStatus.value = { ok: true, message: `Imported ${result.nodeCount} nodes, ${result.edgeCount} edges` }
      await loadDataset()
    } else {
      importStatus.value = { ok: false, message: 'Import failed' }
    }
  } catch (e: any) {
    importStatus.value = { ok: false, message: `Parse error: ${e.message}` }
  }
  importing.value = false
}

function onFileDrop(e: DragEvent) {
  dragging.value = false
  const f = e.dataTransfer?.files[0]
  if (f) processImportFile(f)
}

function onFilePick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) processImportFile(f)
}

// ── Rust centrality ───────────────────────────────────────────────────────────
async function fetchRustCentrality() {
  centralityLoading.value = true
  const res = await api.getGraphCentrality(rustCentralityMetric.value, 20)
  rustCentrality.value = res?.scores ?? []
  centralityLoading.value = false
}

// ── Node selection ────────────────────────────────────────────────────────────
function selectNodeById(id: string) {
  const n = graph.value.nodes.find(x => x.id === id)
  if (n) { selectedNode.value = n; focusNode.value = id; redraw() }
}

// ── Hierarchical layout ───────────────────────────────────────────────────────
function buildHierarchicalPositions(nodes: NodeRecord[], edges: EdgeRecord[]): Map<string, { x: number; y: number }> {
  const adj = new Map<string, string[]>()
  const indegree = new Map<string, number>()
  for (const n of nodes) { adj.set(n.id, []); indegree.set(n.id, 0) }
  for (const e of edges) {
    adj.get(e.source)?.push(e.target)
    indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1)
  }

  // BFS from all zero-indegree roots (or first node if none)
  const roots = nodes.filter(n => (indegree.get(n.id) ?? 0) === 0).map(n => n.id)
  if (!roots.length && nodes.length) roots.push(nodes[0].id)

  const depth = new Map<string, number>()
  const queue = roots.map(id => { depth.set(id, 0); return id })
  let qi = 0
  while (qi < queue.length) {
    const cur = queue[qi++]
    const d = depth.get(cur)!
    for (const nb of (adj.get(cur) ?? [])) {
      if (!depth.has(nb)) { depth.set(nb, d + 1); queue.push(nb) }
    }
  }
  // Nodes not reached (disconnected) get depth = max + 1
  const maxD = Math.max(0, ...depth.values())
  for (const n of nodes) { if (!depth.has(n.id)) depth.set(n.id, maxD + 1) }

  // Group by layer
  const layers = new Map<number, string[]>()
  for (const [id, d] of depth) {
    if (!layers.has(d)) layers.set(d, [])
    layers.get(d)!.push(id)
  }

  const W = 800, H = 600
  const layerCount = Math.max(...layers.keys()) + 1
  const pos = new Map<string, { x: number; y: number }>()
  for (const [d, ids] of layers) {
    const y = (d / Math.max(layerCount - 1, 1)) * H
    ids.forEach((id, i) => {
      const x = ((i + 0.5) / ids.length) * W
      pos.set(id, { x, y })
    })
  }
  return pos
}

// ── Chart build ───────────────────────────────────────────────────────────────
function buildOption(): any {
  const pathSet = bfsResult.value ? new Set(bfsResult.value) : null
  const pathEdgeSet = bfsResult.value
    ? new Set(bfsResult.value.slice(0, -1).map((id, i) => `${id}->${bfsResult.value![i + 1]}`))
    : null

  const isFocused = focusNode.value.trim() !== ''
  const focusNeighbors = isFocused ? new Set(neighborsOf(focusNode.value)) : null

  // Traversal animation state
  const isTraversing = traverseLevels.value.length > 0
  const traverseFrontierSet = isTraversing ? new Set(traverseLevels.value[traverseStep.value] ?? []) : null
  const traverseVisitedSet  = isTraversing ? traverseVisited.value : null
  // Build layer lookup for edges: edge is active if target node layer ≤ current step
  const nodeLayerMap = new Map<string, number>()
  if (isTraversing) {
    traverseLevels.value.forEach((layer, d) => layer.forEach(id => nodeLayerMap.set(id, d)))
  }
  const activeTraverseEdges = isTraversing
    ? new Set(traverseEdgesUsed.value
        .filter(([, tgt]) => (nodeLayerMap.get(tgt) ?? Infinity) <= traverseStep.value)
        .map(([src, tgt]) => `${src}->${tgt}`))
    : null

  const series: any[] = []

  // ── vector scatter ──
  if (overlayVectors.value && vectors.value.length) {
    const clusterColors = CAT_COLORS
    series.push({
      type: 'scatter',
      data: vectors.value.map(v => ({ value: [v.x, v.y], itemStyle: { color: clusterColors[v.cluster % clusterColors.length] } })),
      symbolSize: vectorDotSize.value,
      itemStyle: { opacity: vectorOpacity.value },
      tooltip: { show: false },
      silent: true,
      z: 1,
    })
  }

  // ── degree glow halo ──
  if (overlayDegree.value) {
    const maxD = Math.max(...visibleNodes.value.map(n => totalDegree(n.id)), 1)
    series.push({
      type: 'graph', layout: 'none',
      nodes: visibleNodes.value.map(n => ({
        id: n.id, symbolSize: nodeSize(n) * 2.8,
        itemStyle: { color: `rgba(87,148,242,${(totalDegree(n.id) / maxD) * 0.22})`, borderWidth: 0 },
        label: { show: false },
      })),
      edges: [], silent: true, z: 2,
    })
  }

  // ── heatmap halo ──
  if (overlayHeatmap.value) {
    const maxV = Math.max(...visibleNodes.value.map(n => n.value), 1)
    series.push({
      type: 'graph', layout: 'none',
      nodes: visibleNodes.value.map(n => ({
        id: n.id, symbolSize: nodeSize(n) * 3,
        itemStyle: { color: `rgba(242,73,92,${(n.value / maxV) * 0.2})`, borderWidth: 0 },
        label: { show: false },
      })),
      edges: [], silent: true, z: 2,
    })
  }

  // ── main graph ──
  const isHierarchical = layout.value === 'hierarchical'
  const hierPos = isHierarchical
    ? buildHierarchicalPositions(visibleNodes.value, visibleEdges.value)
    : null
  series.push({
    type: 'graph',
    layout: isHierarchical ? 'none' : layout.value,
    roam: true,
    draggable: true,
    animation: !isHierarchical && layout.value !== 'none',
    label: {
      show: showLabels.value,
      fontSize: 11,
      color: '#c0cfe0',
      position: 'bottom',
    },
    force: {
      repulsion: force.repulsion,
      edgeLength: [force.edgeLength * 0.5, force.edgeLength],
      gravity: force.gravity,
    },
    emphasis: { focus: 'adjacency', lineStyle: { width: 3, opacity: 1 }, label: { show: true } },
    nodes: visibleNodes.value.map(n => {
      const dimmed      = isFocused && focusNode.value !== n.id && !focusNeighbors?.has(n.id)
      const filteredOut = filterMatchSet.value !== null && !filterMatchSet.value.has(n.id)
      const inPath      = pathSet?.has(n.id)
      const inFrontier  = traverseFrontierSet?.has(n.id) ?? false
      const inVisited   = (traverseVisitedSet?.has(n.id) ?? false) && !inFrontier
      const unvisited   = isTraversing && !inFrontier && !(traverseVisitedSet?.has(n.id))
      const finalOpacity = unvisited ? 0.2 : filteredOut ? 0.12 : (dimmed ? 0.18 : 1)
      const hp = hierPos?.get(n.id)
      return {
        id: n.id,
        name: n.label,
        ...(hp ? { x: hp.x, y: hp.y } : {}),
        symbolSize: (inFrontier || inPath) ? nodeSize(n) * 1.4 : nodeSize(n),
        itemStyle: {
          color: inFrontier ? '#f2cc0c'
               : inVisited  ? '#3a7fd4'
               : inPath     ? '#fade2a'
               : nodeColor(n),
          opacity: finalOpacity,
          borderColor: (inFrontier || focusNode.value === n.id || inPath) ? '#fff' : undefined,
          borderWidth: (inFrontier || focusNode.value === n.id || inPath) ? 2 : 0,
          shadowBlur:  inFrontier ? 16 : inPath ? 12 : 0,
          shadowColor: inFrontier ? '#f2cc0c99' : '#fade2a',
        },
        label: { show: showLabels.value && !dimmed && !unvisited && !filteredOut },
        _raw: n,
      }
    }),
    edges: visibleEdges.value.map(e => {
      const rule           = ruleMap.value.get(e.label)
      const inPath         = pathEdgeSet?.has(`${e.source}->${e.target}`)
      const inTraversal    = activeTraverseEdges?.has(`${e.source}->${e.target}`)
      return {
        source: e.source,
        target: e.target,
        lineStyle: {
          color: inPath      ? '#fade2a'
               : inTraversal ? '#73bf69'
               : (rule?.color ?? '#555'),
          type:  rule?.style ?? 'solid',
          width: inPath ? 3 : inTraversal ? 2
               : weightBasedThickness.value ? Math.max(0.7, Math.min(6, e.weight * 0.85))
               : (rule?.width ?? 1.5),
          opacity: isTraversing && !inTraversal && !inPath ? 0.1 : (inPath ? 1 : 0.75),
        },
        edgeSymbol: ['none', rule?.symbol === 'none' ? 'none' : 'arrow'],
        edgeSymbolSize: 7,
        label: {
          show: showEdgeLabels.value,
          formatter: e.label,
          fontSize: 9,
          color: '#8899aa',
        },
        _raw: e,
      }
    }),
    z: 3,
  })

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (p: any) => {
        if (p.dataType === 'node') {
          const n = p.data._raw as NodeRecord
          return `<b>${n.label}</b><br/>id: <code>${n.id}</code><br/>cat: ${n.category} · val: ${n.value}<br/>in: ${inDegree(n.id)} · out: ${outDegree(n.id)}`
        }
        if (p.dataType === 'edge') {
          const e = p.data._raw as EdgeRecord
          return `${e.source} <b>→</b> ${e.target}<br/><code>${e.label}</code> · w=${e.weight}`
        }
        return ''
      },
    },
    series,
  }
}

function redraw() {
  if (!chart) return
  chart.setOption(buildOption(), { replaceMerge: ['series'] })
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadDataset() {
  if (selectedDataset.value === '__local__') {
    loadLocalBrain()
    return
  }
  if (selectedDataset.value !== '__store__') {
    await api.postLoadDataset(selectedDataset.value)
  }
  const [gRes, vRes] = await Promise.all([api.getLiveGraph(), api.getStoreVectors()])
  if (gRes) { graph.value = gRes as LiveGraph }
  if (vRes) { vectors.value = vRes.vectors }
  buildEdgeRules(graph.value.edges)
  bfsResult.value = null
  degreeCentrality.value = []
  components.value = null
  selectedNode.value = null
  activeCats.value = new Set()
  redraw()
}

// ── Local Brain helpers ───────────────────────────────────────────────────────
function loadLocalBrain() {
  const cats = [...new Set(wbStore.nodes.map(n => n.category))]
    .sort()
    .map(c => `Cat ${c}`)
  graph.value = {
    nodes: [...wbStore.nodes],
    edges: [...wbStore.edges],
    categories: cats,
    dataset: wbStore.name,
  }
  buildEdgeRules(graph.value.edges)
  bfsResult.value = null
  degreeCentrality.value = []
  components.value = null
  selectedNode.value = null
  activeCats.value = new Set()
  redraw()
}

async function seedFromPrismSelf() {
  await api.postLoadDataset('prism-self')
  const gRes = await api.getLiveGraph()
  if (gRes) {
    const g = gRes as LiveGraph
    wbStore.seed(g.nodes, g.edges, 'Prism Self-Map')
    loadLocalBrain()
  }
}

function addLocalNode() {
  const n: NodeRecord = {
    id: lbNewNode.id.trim(),
    label: lbNewNode.label.trim() || lbNewNode.id.trim(),
    category: lbNewNode.category,
    value: lbNewNode.value,
    symbolSize: 28,
  }
  wbStore.addNode(n)
  lbNewNode.id = ''
  lbNewNode.label = ''
  loadLocalBrain()
}

function addLocalEdge() {
  const e: EdgeRecord = {
    source: lbNewEdge.source.trim(),
    target: lbNewEdge.target.trim(),
    label: lbNewEdge.label.trim() || 'LINK',
    weight: 1,
  }
  wbStore.addEdge(e)
  lbNewEdge.source = ''
  lbNewEdge.target = ''
  loadLocalBrain()
}

function clearLocalBrain() {
  wbStore.clear()
  loadLocalBrain()
}

async function pushLocalToServer() {
  const res = await api.postStoreImport(wbStore.nodes, wbStore.edges, false)
  if (res) {
    importStatus.value = { ok: true, message: `Pushed ${wbStore.nodes.length} nodes + ${wbStore.edges.length} edges to server` }
  } else {
    importStatus.value = { ok: false, message: 'Push to server failed' }
  }
}

// ── View presets ──────────────────────────────────────────────────────────────
const PRESET_KEY = 'prism-wb-presets'

function loadPresetsFromStorage() {
  try { presets.value = JSON.parse(localStorage.getItem(PRESET_KEY) ?? '[]') } catch {}
}

function savePreset() {
  const config = {
    layout: layout.value, force: { ...force }, showLabels: showLabels.value,
    showEdgeLabels: showEdgeLabels.value, nodeColorMode: nodeColorMode.value,
    nodeSizeMode: nodeSizeMode.value, edgeRules: JSON.parse(JSON.stringify(edgeRules.value)),
    overlayMap: overlayMap.value, mapUrl: mapUrl.value, mapOpacity: mapOpacity.value,
    overlayVectors: overlayVectors.value, overlayHeatmap: overlayHeatmap.value,
    overlayGrid: overlayGrid.value, overlayDegree: overlayDegree.value,
    edgeLabelFilter: edgeLabelFilter.value, edgeWeightMin: edgeWeightMin.value,
  }
  const existing = presets.value.filter(p => p.name !== presetName.value)
  presets.value = [{ name: presetName.value, config }, ...existing]
  localStorage.setItem(PRESET_KEY, JSON.stringify(presets.value))
  presetName.value = ''
}

function loadPreset(p: ViewPreset) {
  const c = p.config
  layout.value = c.layout ?? 'force'
  Object.assign(force, c.force ?? {})
  showLabels.value = c.showLabels ?? true
  showEdgeLabels.value = c.showEdgeLabels ?? false
  nodeColorMode.value = c.nodeColorMode ?? 'category'
  nodeSizeMode.value = c.nodeSizeMode ?? 'symbolSize'
  if (c.edgeRules) edgeRules.value = c.edgeRules
  overlayMap.value = c.overlayMap ?? false
  mapUrl.value = c.mapUrl ?? ''
  mapOpacity.value = c.mapOpacity ?? 0.2
  overlayVectors.value = c.overlayVectors ?? false
  overlayHeatmap.value = c.overlayHeatmap ?? false
  overlayGrid.value = c.overlayGrid ?? false
  overlayDegree.value = c.overlayDegree ?? false
  edgeLabelFilter.value = c.edgeLabelFilter ?? ''
  edgeWeightMin.value = c.edgeWeightMin ?? 0
  redraw()
}

function deletePreset(name: string) {
  presets.value = presets.value.filter(p => p.name !== name)
  localStorage.setItem(PRESET_KEY, JSON.stringify(presets.value))
}

// ── Exports ───────────────────────────────────────────────────────────────────
function exportPNG() {
  if (!chart) return
  const url = chart.getDataURL({ type: 'png', backgroundColor: '#141519', pixelRatio: 2 })
  dlFile(url, `graph-${graph.value.dataset || 'export'}.png`)
}

function exportSVG() {
  if (!chart) return
  const url = chart.getDataURL({ type: 'svg' })
  dlFile(url, `graph-${graph.value.dataset || 'export'}.svg`)
}

function exportJSON() {
  const data = { dataset: graph.value.dataset, nodes: visibleNodes.value, edges: visibleEdges.value }
  dlBlob(JSON.stringify(data, null, 2), 'application/json', `graph-${graph.value.dataset || 'export'}.json`)
}

function exportCSV(type: 'nodes' | 'edges') {
  let content: string
  if (type === 'nodes') {
    content = 'id,label,category,value,symbolSize\n' +
      visibleNodes.value.map(n => `${n.id},${n.label},${n.category},${n.value},${n.symbolSize}`).join('\n')
    dlBlob(content, 'text/csv', `nodes-${graph.value.dataset}.csv`)
  } else {
    content = 'source,target,label,weight\n' +
      visibleEdges.value.map(e => `${e.source},${e.target},${e.label},${e.weight}`).join('\n')
    dlBlob(content, 'text/csv', `edges-${graph.value.dataset}.csv`)
  }
}

function exportGEXF() {
  const nodes = visibleNodes.value.map(n =>
    `      <node id="${n.id}" label="${n.label}"><attvalues><attvalue for="0" value="${n.category}"/><attvalue for="1" value="${n.value}"/></attvalues></node>`
  ).join('\n')
  const edges = visibleEdges.value.map((e, i) =>
    `      <edge id="${i}" source="${e.source}" target="${e.target}" label="${e.label}" weight="${e.weight}"/>`
  ).join('\n')
  const gexf = `<?xml version="1.0" encoding="UTF-8"?>
<gexf xmlns="http://gexf.net/1.3" version="1.3">
  <graph defaultedgetype="directed">
    <attributes class="node"><attribute id="0" title="category" type="integer"/><attribute id="1" title="value" type="integer"/></attributes>
    <nodes>\n${nodes}\n    </nodes>
    <edges>\n${edges}\n    </edges>
  </graph>
</gexf>`
  dlBlob(gexf, 'application/xml', `graph-${graph.value.dataset}.gexf`)
}

function dlFile(url: string, name: string) {
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
}

function dlBlob(content: string, mime: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  dlFile(url, name)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ── Resize ────────────────────────────────────────────────────────────────────
const ro = new ResizeObserver(() => chart?.resize())

// ── Lifecycle ─────────────────────────────────────────────────────────────────
// ── WebSocket — live store push ───────────────────────────────────────────────
const { connected: wsConnected } = useWebSocket('/api/ws', (data) => {
  if (data.type === 'graph_changed' && selectedDataset.value === '__store__') {
    loadDataset()
  }
})

onMounted(async () => {
  loadPresetsFromStorage()
  const dsRes = await api.getDatasets()
  if (dsRes) datasets.value = dsRes.datasets
  await loadDataset()
  await nextTick()
  if (chartEl.value) {
    chart = echarts.init(chartEl.value, 'dark')
    chart.on('click', (p: any) => {
      if (p.dataType === 'node') {
        const raw = p.data._raw as NodeRecord
        selectedNode.value = raw
        focusNode.value = raw.id
        redraw()
      }
    })
    chart.on('finished', drawMinimap)
    ro.observe(chartEl.value)
    redraw()
  }

  // Global keydown: E = extract subgraph, Escape = restore
  function onGlobalKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.key === 'e' || e.key === 'E') {
      if (selectedNode.value) extractSubgraph(selectedNode.value.id, subgraphHops.value)
    }
    if (e.key === 'Escape' && isSubgraphActive.value) restoreGraph()
  }
  window.addEventListener('keydown', onGlobalKey)
  onUnmounted(() => window.removeEventListener('keydown', onGlobalKey))
})

onUnmounted(() => { pauseTraverse(); ro.disconnect(); chart?.dispose() })
</script>

<style scoped>
.workbench {
  display: flex;
  height: 100%;
  gap: 10px;
  overflow: hidden;
}

/* ── Sidebar ── */
.wb-sidebar {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  padding: 0;
  overflow: hidden;
}

.side-tabs {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 36px;
  flex-shrink: 0;
  padding: 6px 0;
  gap: 2px;
  border-right: 1px solid var(--border);
  background: var(--bg-secondary);
}
.side-tab {
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: 4px;
  color: var(--text-muted); cursor: pointer;
  transition: all 0.15s;
}
.side-tab:hover { color: var(--text-primary); background: rgba(255,255,255,0.06); }
.side-tab.active { color: var(--accent-blue); background: rgba(87,148,242,0.12); }

.side-panel {
  flex: 1;
  padding: 10px 10px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sp-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 600;
  color: var(--text-muted);
  margin-top: 2px;
}
.sp-subtitle {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.sp-hint { font-size: 10px; line-height: 1.4; }

/* Controls */
.ctrl-select {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 4px; padding: 4px 7px; color: var(--text-primary); font-size: 11px;
}
.ctrl-select.full { width: 100%; }
.ctrl-select.mini { padding: 2px 4px; font-size: 10px; }
.form-input {
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 4px; padding: 4px 7px; color: var(--text-primary); font-size: 11px;
}
.form-input:focus { outline: none; border-color: var(--accent-blue); }
.chip-row { display: flex; flex-wrap: wrap; gap: 3px; }
.chip {
  font-size: 10px; padding: 3px 7px; border-radius: 3px;
  background: var(--bg-secondary); border: 1px solid var(--border);
  color: var(--text-muted); cursor: pointer; transition: all 0.15s;
  white-space: nowrap;
}
.chip:hover { color: var(--text-primary); }
.chip.active { background: rgba(87,148,242,0.15); border-color: rgba(87,148,242,0.4); color: var(--accent-blue); }
.chip.full { width: 100%; text-align: left; margin-bottom: 3px; }
.toggle-row { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-secondary); cursor: pointer; }
.stat-row { display: flex; flex-wrap: wrap; gap: 4px; }
.stat-chip {
  font-size: 10px; padding: 2px 6px; border-radius: 3px;
  background: rgba(87,148,242,0.1); color: var(--accent-blue);
  border: 1px solid rgba(87,148,242,0.2);
}
.ws-live { background: rgba(115,191,105,0.15); color: #73bf69; border-color: rgba(115,191,105,0.3); }
.ws-off  { background: rgba(110,110,110,0.1);  color: #888;    border-color: rgba(110,110,110,0.2); }
.param-row { display: flex; align-items: center; gap: 5px; }
.param-row label { font-size: 10px; color: var(--text-muted); min-width: 52px; }
.range-input { flex: 1; accent-color: var(--accent-blue); }
.range-input.mini { width: 50px; flex: none; }
.range-val { font-family: var(--font-mono); font-size: 10px; color: var(--text-secondary); min-width: 22px; }
.color-input { width: 22px; height: 18px; border: none; border-radius: 2px; cursor: pointer; padding: 0; }

/* Edge rules */
.edge-rules-list { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
.edge-rule { display: flex; align-items: center; gap: 4px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 3px; padding: 3px 5px; }
.rule-label { font-size: 10px; font-weight: 600; flex: 1; font-family: var(--font-mono); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Preset list */
.preset-row { display: flex; gap: 4px; }
.preset-item { display: flex; align-items: center; gap: 4px; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.preset-name { flex: 1; font-size: 11px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Overlay sub-section */
.overlay-sub { display: flex; flex-direction: column; gap: 5px; padding: 6px 8px; background: var(--bg-secondary); border-radius: 4px; border: 1px solid var(--border); }

/* Compute blocks */
.compute-block { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 4px; padding: 8px; display: flex; flex-direction: column; gap: 5px; }
.compute-result { font-size: 11px; padding: 4px 0; }
.result-label { font-weight: 600; color: var(--accent-blue); }
.path-chain { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 3px; }
.path-node { font-size: 10px; color: var(--accent-blue); cursor: pointer; }
.path-node:hover { text-decoration: underline; }
.path-arrow { color: var(--text-muted); padding: 0 2px; }
.centrality-list { display: flex; flex-direction: column; gap: 2px; }
.centrality-row { display: flex; align-items: center; gap: 5px; cursor: pointer; padding: 2px 0; }
.centrality-row:hover .centrality-id { color: var(--accent-blue); }
.centrality-bar { height: 3px; border-radius: 2px; background: var(--accent-blue); opacity: 0.6; min-width: 2px; }
.centrality-id { font-size: 10px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.centrality-val { font-size: 10px; color: var(--text-muted); min-width: 18px; text-align: right; }

/* ── Traversal animation ── */
.traverse-controls { display: flex; gap: 4px; flex-wrap: wrap; }
.traverse-progress { display: flex; flex-direction: column; gap: 4px; }
.traverse-bar-wrap { height: 3px; background: var(--bg-primary); border-radius: 2px; overflow: hidden; }
.traverse-bar-fill { height: 100%; background: #f2cc0c; border-radius: 2px; transition: width 0.3s; }
.traverse-label { font-size: 10px; }

/* ── File import ── */
.drop-zone {
  border: 1px dashed var(--border-hover);
  border-radius: 4px;
  padding: 12px 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  transition: border-color 0.15s, background 0.15s;
  cursor: default;
}
.drop-zone.drag-over { border-color: var(--accent-blue); background: rgba(87,148,242,0.06); }
.drop-hint { font-size: 12px; color: var(--text-secondary); }
.drop-sub  { font-size: 10px; }
.drop-browse { cursor: pointer; }
.import-status { font-size: 11px; padding: 5px 8px; border-radius: 3px; }
.status-ok  { color: var(--accent-green); background: rgba(115,191,105,0.1); }
.status-err { color: #f2495c; background: rgba(242,73,92,0.1); }

/* ── Main area ── */
.wb-main {
  flex: 1;
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  border: 1px solid var(--border);
}
.wb-chart { width: 100%; height: 100%; }

.map-overlay {
  position: absolute; inset: 0;
  background-size: cover;
  background-position: center;
  pointer-events: none;
  z-index: 0;
}
.grid-overlay {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
  z-index: 0;
}

/* BFS path ribbon */
.path-ribbon {
  position: absolute;
  bottom: 12px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; flex-wrap: wrap; gap: 4px;
  background: rgba(14,18,26,0.9); border: 1px solid rgba(250,222,42,0.4);
  border-radius: 6px; padding: 5px 10px; z-index: 10;
  max-width: 80%;
}
.path-ribbon-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.path-hop { font-size: 11px; color: #fade2a; cursor: pointer; }
.path-hop:hover { text-decoration: underline; }
.path-sep { color: var(--text-muted); padding: 0 3px; }

/* Node info panel */
.node-info-panel {
  position: absolute; top: 12px; right: 12px;
  width: 230px; padding: 10px 12px; z-index: 10;
  display: flex; flex-direction: column; gap: 5px;
}
.ni-header { display: flex; align-items: center; gap: 6px; }
.ni-id { font-size: 13px; font-weight: 600; color: var(--accent-blue); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ni-row { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.ni-key { color: var(--text-muted); min-width: 68px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
.ni-edges { margin-top: 4px; max-height: 140px; overflow-y: auto; }
.ni-edge-row { display: flex; align-items: center; gap: 5px; padding: 2px 0; font-size: 11px; }
.ni-edge-dir { font-weight: 700; min-width: 14px; }
.ni-edge-dir.out { color: var(--accent-blue); }
.ni-edge-dir.in  { color: var(--accent-green); }
.ni-edge-peer { flex: 1; cursor: pointer; color: var(--text-secondary); }
.ni-edge-peer:hover { color: var(--accent-blue); }
.ni-edge-label { flex-shrink: 0; }
.label-chip { font-family: var(--font-mono); font-size: 9px; padding: 1px 4px; border-radius: 2px; background: var(--bg-secondary); border: 1px solid var(--border); color: var(--text-muted); }

/* Legend */
.legend-panel {
  position: absolute; bottom: 12px; left: 12px;
  background: rgba(14,18,26,0.82); border: 1px solid var(--border);
  border-radius: 4px; padding: 7px 10px; z-index: 10;
  display: flex; flex-direction: column; gap: 3px; max-width: 150px;
}
.legend-item { display: flex; align-items: center; gap: 6px; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.legend-label { font-size: 10px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Slide-in transition */
.slide-in-enter-active, .slide-in-leave-active { transition: transform 0.2s ease, opacity 0.2s ease; }
.slide-in-enter-from, .slide-in-leave-to { transform: translateX(20px); opacity: 0; }

/* Traversal animation */
.traverse-controls { display: flex; gap: 3px; flex-wrap: wrap; }
.traverse-progress { display: flex; flex-direction: column; gap: 3px; }
.traverse-bar-wrap { height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
.traverse-bar-fill { height: 100%; background: var(--accent-blue); border-radius: 2px; transition: width 0.2s; }
.traverse-label { font-size: 10px; }

/* Drop zone */
.drop-zone {
  border: 1.5px dashed var(--border); border-radius: 6px;
  padding: 12px 8px; display: flex; flex-direction: column; align-items: center; gap: 5px;
  cursor: pointer; transition: all 0.15s;
}
.drop-zone.drag-over { border-color: var(--accent-blue); background: rgba(87,148,242,0.07); }
.drop-hint { font-size: 11px; color: var(--text-secondary); }
.drop-sub { font-size: 10px; }
.drop-browse { cursor: pointer; }
.import-status { font-size: 11px; padding: 4px 6px; border-radius: 3px; margin-top: 3px; }
.status-ok  { background: rgba(115,191,105,0.1); color: #73bf69; border: 1px solid rgba(115,191,105,0.25); }
.status-err { background: rgba(242,73,92,0.1);  color: #f2495c; border: 1px solid rgba(242,73,92,0.25); }

/* Centrality extras */
.centrality-rank { font-size: 9px; color: var(--text-muted); min-width: 18px; }

/* Graph stats grid */
.stats-grid {
  display: grid; grid-template-columns: auto 1fr;
  gap: 2px 10px; margin-top: 5px;
}
.stats-key { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
.stats-val { font-family: var(--font-mono); font-size: 11px; color: var(--text-primary); }

/* Shared */
.mono { font-family: var(--font-mono); font-size: 11px; }
.btn-icon {
  background: none; border: none; cursor: pointer; font-size: 12px;
  padding: 2px 5px; border-radius: 3px; color: var(--text-muted);
  transition: all 0.15s; flex-shrink: 0;
}
.btn-icon:hover { background: rgba(255,255,255,0.06); color: var(--text-primary); }
.btn-icon.danger:hover { color: #f2495c; background: rgba(242,73,92,0.1); }

/* Subgraph banner */
.subgraph-banner {
  position: absolute;
  top: 12px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 10px;
  background: rgba(14,18,26,0.92); border: 1px solid rgba(115,191,105,0.45);
  border-radius: 6px; padding: 5px 12px; z-index: 10;
  font-size: 11px; color: #73bf69;
}
.subgraph-label { flex: 1; white-space: nowrap; }

kbd {
  font-family: var(--font-mono); font-size: 10px;
  background: var(--bg-secondary); border: 1px solid var(--border);
  border-radius: 3px; padding: 1px 4px; color: var(--text-secondary);
}

/* Minimap */
.minimap-canvas {
  position: absolute;
  bottom: 12px; right: 12px;
  width: 180px; height: 120px;
  border-radius: 4px;
  cursor: pointer;
  z-index: 10;
  opacity: 0.88;
  transition: opacity 0.15s;
}
.minimap-canvas:hover { opacity: 1; }
.minimap-toggle {
  position: absolute;
  bottom: 12px; right: 12px;
  background: rgba(14,18,26,0.72);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-muted);
  z-index: 10;
  transition: all 0.15s;
}
.minimap-toggle:hover { color: var(--text-primary); border-color: var(--accent-blue); }
</style>

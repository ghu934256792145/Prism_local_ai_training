<template>
  <div class="app-shell">
    <!-- Keyboard shortcut help overlay -->
    <Teleport to="body">
      <div v-if="showHelp" class="kbd-overlay" @click.self="showHelp = false">
        <div class="kbd-modal panel">
          <div class="panel-header">
            <span class="panel-title">Keyboard Shortcuts</span>
            <button class="btn" style="padding:2px 8px;font-size:11px" @click="showHelp = false">✕</button>
          </div>
          <div style="padding:14px;display:flex;flex-direction:column;gap:8px">
            <div v-for="k in SHORTCUTS" :key="k.key" class="kbd-row">
              <kbd class="kbd">{{ k.key }}</kbd>
              <span class="text-secondary" style="font-size:13px">{{ k.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Sidebar -->
    <nav class="sidebar">
      <div class="sidebar-logo">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <polygon points="14,2 26,8 26,20 14,26 2,20 2,8" fill="none" stroke="#5794f2" stroke-width="1.5"/>
          <polygon points="14,7 21,11 21,17 14,21 7,17 7,11" fill="rgba(87,148,242,0.15)" stroke="#5794f2" stroke-width="1"/>
          <circle cx="14" cy="14" r="3" fill="#5794f2"/>
        </svg>
      </div>
      <div class="sidebar-nav">
        <router-link v-for="item in navItems" :key="item.path" :to="item.path" class="nav-item" :title="item.label">
          <span class="nav-icon" v-html="item.icon"></span>
          <span class="nav-label">{{ item.label }}</span>
        </router-link>
      </div>
      <div class="sidebar-bottom">
        <div class="nav-item" title="Keyboard shortcuts (?)" @click="showHelp = true">
          <span class="nav-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </span>
          <span class="nav-label">Help</span>
        </div>
      </div>
    </nav>

    <!-- Main area -->
    <div class="main-area">
      <!-- Top bar -->
      <header class="topbar">
        <div class="topbar-left">
          <span class="topbar-title">{{ currentTitle }}</span>
          <span class="badge badge-cyan" style="font-size:10px">ALPHA</span>
        </div>
        <div class="topbar-right">
          <div class="engine-status">
            <span class="status-dot" :class="engineOnline ? 'online' : 'offline'"></span>
            <span class="text-secondary" style="font-size:12px">Prism Engine {{ engineOnline ? 'Online' : 'Offline' }}</span>
          </div>
          <div class="tag">NVMe PCIe 5</div>
          <div class="tag">SIMD</div>
          <div class="tag text-purple">AI Ready</div>

          <!-- Theme switcher -->
          <div class="theme-switcher" title="Cycle theme (T)">
            <button
              v-for="t in THEMES"
              :key="t"
              class="theme-btn"
              :class="{ active: theme === t }"
              :title="THEME_LABELS[t]"
              @click="set(t)"
            >{{ t === 'dark' ? '◑' : t === 'darker' ? '●' : '◎' }}</button>
          </div>
        </div>
      </header>

      <!-- Page content -->
      <main class="content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTheme, THEMES, THEME_LABELS } from '@/composables/useTheme'
import { usePluginStore } from '@/stores/pluginStore'

const route = useRoute()
const router = useRouter()
const { theme, set, cycle } = useTheme()
const pluginStore = usePluginStore()

const engineOnline = ref(false)
const showHelp = ref(false)

setTimeout(() => { engineOnline.value = true }, 1200)

const SHORTCUTS = [
  { key: 'D', label: 'Dashboard' },
  { key: 'G', label: 'Graph Explorer' },
  { key: 'M', label: 'Matrix Explorer' },
  { key: 'V', label: 'Vector Explorer' },
  { key: 'A', label: 'AI Workbench' },
  { key: 'S', label: 'Scenario Explorer' },
  { key: 'C', label: 'Data Collections' },
  { key: 'X', label: 'Graph Compare' },
  { key: 'W', label: 'Graph Workbench' },
  { key: 'B', label: 'App Brain (self-graph)' },
  { key: 'N', label: 'Network Security' },
  { key: 'I', label: 'AI Training Hub' },
  { key: 'K', label: 'Drug Discovery' },
  { key: 'F', label: 'Manufacturing BOM' },
  { key: 'P', label: 'Pipeline / P&ID' },
  { key: 'E', label: 'Genomics Explorer' },
  { key: 'U', label: 'Semiconductor EDA' },
  { key: 'R', label: 'Threat Intelligence' },
  { key: 'T', label: 'Cycle theme' },
  { key: '?', label: 'Toggle this help' },
  { key: 'O', label: 'ERP Hub' },
  { key: 'L', label: 'AML Explorer' },
  { key: 'J', label: 'Legal Explorer' },
  { key: 'H', label: 'Materials Science' },
  { key: 'Y', label: 'Project Management' },
  { key: 'Q', label: 'MRP Dashboard' },
  { key: 'Z', label: 'Plugin Manager' },
  { key: 'Esc', label: 'Close overlays' },
]

function onKeyDown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement).tagName
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return
  if (e.ctrlKey || e.altKey || e.metaKey) return

  switch (e.key.toLowerCase()) {
    case 'd': router.push('/');           break
    case 'g': router.push('/graph');      break
    case 'm': router.push('/matrix');     break
    case 'v': router.push('/vector');     break
    case 'a': router.push('/ai');         break
    case 's': router.push('/scenarios');  break
    case 'c': router.push('/collections');break
    case 'x': router.push('/compare');    break
    case 'w': router.push('/workbench');  break
    case 'b': router.push('/self');            break
    case 'n': router.push('/network-security'); break
    case 'i': router.push('/ai-training');     break
    case 'k': router.push('/drug-discovery'); break
    case 'e': router.push('/genomics');        break
    case 'u': router.push('/semiconductor');   break
    case 'r': router.push('/threat-intel');    break
    case 'f': router.push('/mfg');             break
    case 'p': router.push('/pipeline');        break
    case 'o': router.push('/erp');             break
    case 'l': router.push('/aml');             break
    case 'j': router.push('/legal');           break
    case 'h': router.push('/materials');       break
    case 'y': router.push('/projects');        break
    case 'q': router.push('/mrp');             break
    case 'z': router.push('/plugins');         break
    case 't': cycle();                         break
    case '?': showHelp.value = !showHelp.value; break
    case 'escape': showHelp.value = false; break
  }
}

onMounted(() => {
  document.addEventListener('keydown', onKeyDown)
  pluginStore.fetchFromApi()
})
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))

const navItems = [
  {
    path: '/',
    label: 'Dashboard',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`
  },
  {
    path: '/graph',
    label: 'Graph',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/><line x1="7" y1="19" x2="17" y2="19"/></svg>`
  },
  {
    path: '/matrix',
    label: 'Matrix',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="5" height="5"/><rect x="10" y="3" width="5" height="5"/><rect x="17" y="3" width="4" height="5"/><rect x="3" y="10" width="5" height="5"/><rect x="10" y="10" width="5" height="5"/><rect x="17" y="10" width="4" height="5"/><rect x="3" y="17" width="5" height="4"/><rect x="10" y="17" width="5" height="4"/><rect x="17" y="17" width="4" height="4"/></svg>`
  },
  {
    path: '/vector',
    label: 'Vectors',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="6" cy="18" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="18" cy="14" r="2"/><circle cx="9" cy="13" r="1.5"/><circle cx="15" cy="5" r="1.5"/></svg>`
  },
  {
    path: '/ai',
    label: 'AI',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2a7 7 0 0 1 7 7 7 7 0 0 1-4 6.32V17a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-1.68A7 7 0 0 1 5 9a7 7 0 0 1 7-7z"/><line x1="10" y1="21" x2="14" y2="21"/></svg>`
  },
  {
    path: '/scenarios',
    label: 'Scenarios',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12,2 22,8 22,16 12,22 2,16 2,8"/><polyline points="2,8 12,14 22,8"/><line x1="12" y1="14" x2="12" y2="22"/></svg>`
  },
  {
    path: '/collections',
    label: 'Collections',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/></svg>`
  },
  {
    path: '/compare',
    label: 'Compare',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`
  },
  {
    path: '/workbench',
    label: 'Workbench',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="10" r="3"/><line x1="6" y1="10" x2="9" y2="10"/><line x1="15" y1="10" x2="18" y2="10"/></svg>`
  },
  {
    path: '/scaffold',
    label: 'Scaffold',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`
  },
  {
    path: '/mfg',
    label: 'MFG BOM',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/><line x1="8" y1="9" x2="12" y2="9"/></svg>`
  },
  {
    path: '/pipeline',
    label: 'Pipeline',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12h4l3-3 4 6 3-3h6"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="12" r="2"/></svg>`
  },
  {
    path: '/network-security',
    label: 'NetSec',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`
  },
  {
    path: '/ai-training',
    label: 'AI Train',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>`
  },
  {
    path: '/drug-discovery',
    label: 'Drug Disc.',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="9" r="6"/><path d="M9 6v6M6 9h6"/><path d="M15.5 15.5L21 21"/><circle cx="17" cy="17" r="3"/></svg>`
  },
  {
    path: '/genomics',
    label: 'Genomics',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 3c0 4 4 4 4 8s-4 4-4 8"/><path d="M19 3c0 4-4 4-4 8s4 4 4 8"/><path d="M5 7h14M5 17h14"/></svg>`
  },
  {
    path: '/semiconductor',
    label: 'EDA',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="7" width="10" height="10" rx="1"/><path d="M7 9H4M7 12H2M7 15H4M17 9h3M17 12h5M17 15h3M9 7V4M12 7V2M15 7V4M9 17v3M12 17v5M15 17v3"/></svg>`
  },
  {
    path: '/threat-intel',
    label: 'Threat Intel',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
  },
  {
    path: '/erp',
    label: 'ERP',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="5" rx="1"/><rect x="2" y="10" width="9" height="11" rx="1"/><rect x="13" y="10" width="9" height="5" rx="1"/><rect x="13" y="17" width="9" height="4" rx="1"/></svg>`
  },
  {
    path: '/aml',
    label: 'AML',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/><path d="M9 3.5A9 9 0 0 1 21 12"/><circle cx="9" cy="3.5" r="1" fill="currentColor"/></svg>`
  },
  {
    path: '/legal',
    label: 'Legal',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M3 12h18M3 18h18"/><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 9h6M9 13h4"/></svg>`
  },
  {
    path: '/materials',
    label: 'Materials',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/><polygon points="12,7 17,9.5 17,14.5 12,17 7,14.5 7,9.5"/><circle cx="12" cy="12" r="2"/></svg>`
  },
  {
    path: '/projects',
    label: 'Projects',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`
  },
  {
    path: '/mrp',
    label: 'MRP',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="3" width="20" height="4" rx="1"/><rect x="2" y="10" width="13" height="4" rx="1"/><rect x="2" y="17" width="9" height="4" rx="1"/><circle cx="19" cy="19" r="3"/><path d="M19 17v2l1 1"/></svg>`
  },
  {
    path: '/supply-chain',
    label: 'Supply Chain',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6.5 7.5l4 9M17.5 7.5l-4 9"/></svg>`
  },
  {
    path: '/plugins',
    label: 'Plugins',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>`
  },
  {
    path: '/self',
    label: 'App Brain',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.14Z"/></svg>`
  }
]

const titleMap: Record<string, string> = {
  '/': 'Overview Dashboard',
  '/graph': 'Graph Explorer',
  '/matrix': 'Matrix Explorer',
  '/vector': 'Vector Explorer',
  '/ai': 'AI Workbench',
  '/scenarios': 'Scenario Explorer',
  '/collections': 'Data Collections',
  '/compare': 'Graph Compare',
  '/workbench': 'Graph Workbench',
  '/scaffold':          'Scaffold Planner',
  '/mfg':               'Manufacturing BOM Planner',
  '/pipeline':          'Pipeline / P&ID MTO',
  '/network-security':  'Network Security',
  '/ai-training':       'AI Training Hub',
  '/drug-discovery':    'Drug Discovery Explorer',
  '/genomics':          'Genomics Pathway Explorer',
  '/semiconductor':     'Semiconductor EDA / Netlist',
  '/threat-intel':      'Threat Intelligence Graph',
  '/erp':               'ERP Hub',
  '/erp/graph':         'ERP × Industry Graph',
  '/erp/data':          'ERP Data Explorer',
  '/aml':               'AML Transaction Graph',
  '/legal':             'Legal Citation Network',
  '/materials':         'Materials Science Explorer',
  '/projects':          'Project Management',
  '/plugins':           'Plugin Manager',
  '/supply-chain':     'Supply Chain Hub',
  '/mrp':              'MRP Dashboard',
  '/mrp/planner':      'MRP Material Planner',
  '/mrp/cost-centers': 'MRP Cost Centers',
  '/mrp/orders':       'MRP Planned Orders',
  '/self':              'App Brain',
}

const currentTitle = computed(() => titleMap[route.path] ?? 'VuePrismGraf')
</script>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-header);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  z-index: 100;
}

.sidebar-logo {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--border);
}

.sidebar-nav {
  flex: 1;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-bottom {
  padding: 8px 0;
  border-top: 1px solid var(--border);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 10px 4px;
  cursor: pointer;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.15s, background 0.15s;
  border-left: 2px solid transparent;
  position: relative;
}

.nav-item:hover {
  color: var(--text-primary);
  background: rgba(255,255,255,0.04);
}

.nav-item.router-link-active,
.nav-item.router-link-exact-active {
  color: var(--accent-blue);
  border-left-color: var(--accent-blue);
  background: rgba(87,148,242,0.08);
}

.nav-icon { display: flex; align-items: center; justify-content: center; }
.nav-label { font-size: 9px; letter-spacing: 0.04em; font-weight: 500; }

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.topbar {
  height: var(--header-height);
  background: var(--bg-header);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  gap: 12px;
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.topbar-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.engine-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.online  { background: var(--accent-green); box-shadow: 0 0 6px var(--accent-green); }
.status-dot.offline { background: var(--text-muted); }

.content {
  flex: 1;
  overflow: auto;
  padding: 14px;
  min-height: 0;
}

/* Theme switcher */
.theme-switcher {
  display: flex;
  gap: 2px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px;
}
.theme-btn {
  width: 24px; height: 24px;
  border: none; border-radius: 3px;
  background: transparent; color: var(--text-muted);
  cursor: pointer; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.theme-btn:hover { color: var(--text-primary); background: var(--bg-panel); }
.theme-btn.active { background: var(--bg-panel); color: var(--accent-blue); }

/* Keyboard help overlay */
.kbd-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  backdrop-filter: blur(2px);
}
.kbd-modal {
  width: 340px;
}
.kbd-row {
  display: flex; align-items: center; gap: 12px;
}
kbd.kbd {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 32px; height: 24px; padding: 0 6px;
  background: var(--bg-secondary); border: 1px solid var(--border-hover);
  border-bottom-width: 2px; border-radius: 4px;
  font-family: var(--font-mono); font-size: 12px; color: var(--accent-cyan);
  flex-shrink: 0;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

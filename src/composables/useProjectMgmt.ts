// ── Project Management composable ─────────────────────────────────────────────
// API base: http://localhost:3000

const BASE = 'http://localhost:3000'

// ── Types ─────────────────────────────────────────────────────────────────────

export type PmStatus   = 'active' | 'paused' | 'done'
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done'
export type Priority   = 'low' | 'medium' | 'high' | 'critical'

export interface PmProject {
  id: string
  name: string
  industry: string
  graph_dataset: string
  status: PmStatus
  priority: Priority
  start_date?: string
  end_date?: string
  description?: string
  task_count: number
  done_count: number
}

export interface PmTask {
  id: string
  project_id: string
  title: string
  status: TaskStatus
  assignee?: string
  due_date?: string
  graph_node_id?: string
  graph_dataset?: string
  priority: Priority
  notes?: string
}

export interface PmMilestone {
  id: string
  project_id: string
  title: string
  due_date?: string
  completed: boolean
  graph_node_id?: string
}

export interface PmMember {
  id: string
  project_id: string
  name: string
  role: string
  industry_expertise?: string
}

export interface PmGraphLink {
  id: string
  task_id: string
  dataset: string
  node_id: string
  link_type: string
  annotation?: string
}

export interface PmTaskSummary {
  id: string
  title: string
  status: string
}

export interface PmSmartContext {
  industry: string
  graph_dataset: string
  project_count: number
  open_task_count: number
  overdue_count: number
  node_task_map: Record<string, PmTaskSummary[]>
  recommendations: string[]
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useProjectMgmt() {

  // ── Projects ─────────────────────────────────────────────────────────────

  async function fetchProjects(industry?: string): Promise<PmProject[]> {
    try {
      const url = industry
        ? `${BASE}/api/pm/projects?industry=${encodeURIComponent(industry)}`
        : `${BASE}/api/pm/projects`
      const r = await fetch(url)
      if (!r.ok) throw new Error('API error')
      return await r.json()
    } catch {
      return []
    }
  }

  async function fetchProject(id: string): Promise<PmProject | null> {
    try {
      const r = await fetch(`${BASE}/api/pm/projects/${encodeURIComponent(id)}`)
      if (!r.ok) throw new Error('API error')
      return await r.json()
    } catch {
      return null
    }
  }

  async function createProject(payload: Partial<PmProject>): Promise<PmProject | null> {
    try {
      const r = await fetch(`${BASE}/api/pm/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error('API error')
      return await r.json()
    } catch {
      return null
    }
  }

  async function updateProject(id: string, payload: Partial<PmProject>): Promise<boolean> {
    try {
      const r = await fetch(`${BASE}/api/pm/projects/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return r.ok
    } catch {
      return false
    }
  }

  async function deleteProject(id: string): Promise<boolean> {
    try {
      const r = await fetch(`${BASE}/api/pm/projects/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      return r.ok
    } catch {
      return false
    }
  }

  // ── Tasks ─────────────────────────────────────────────────────────────────

  async function fetchTasks(projectId: string): Promise<PmTask[]> {
    try {
      const r = await fetch(`${BASE}/api/pm/projects/${encodeURIComponent(projectId)}/tasks`)
      if (!r.ok) throw new Error('API error')
      return await r.json()
    } catch {
      return []
    }
  }

  async function createTask(projectId: string, payload: Partial<PmTask>): Promise<PmTask | null> {
    try {
      const r = await fetch(`${BASE}/api/pm/projects/${encodeURIComponent(projectId)}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error('API error')
      return await r.json()
    } catch {
      return null
    }
  }

  async function updateTask(id: string, payload: Partial<PmTask>): Promise<boolean> {
    try {
      const r = await fetch(`${BASE}/api/pm/tasks/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return r.ok
    } catch {
      return false
    }
  }

  async function deleteTask(id: string): Promise<boolean> {
    try {
      const r = await fetch(`${BASE}/api/pm/tasks/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      return r.ok
    } catch {
      return false
    }
  }

  // ── Milestones ────────────────────────────────────────────────────────────

  async function fetchMilestones(projectId: string): Promise<PmMilestone[]> {
    try {
      const r = await fetch(`${BASE}/api/pm/projects/${encodeURIComponent(projectId)}/milestones`)
      if (!r.ok) throw new Error('API error')
      return await r.json()
    } catch {
      return []
    }
  }

  async function createMilestone(projectId: string, payload: Partial<PmMilestone>): Promise<PmMilestone | null> {
    try {
      const r = await fetch(`${BASE}/api/pm/projects/${encodeURIComponent(projectId)}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!r.ok) throw new Error('API error')
      return await r.json()
    } catch {
      return null
    }
  }

  async function completeMilestone(id: string): Promise<boolean> {
    try {
      const r = await fetch(`${BASE}/api/pm/milestones/${encodeURIComponent(id)}/complete`, {
        method: 'POST',
      })
      return r.ok
    } catch {
      return false
    }
  }

  // ── Graph Links ───────────────────────────────────────────────────────────

  async function fetchGraphLinks(taskId: string): Promise<PmGraphLink[]> {
    try {
      const r = await fetch(`${BASE}/api/pm/tasks/${encodeURIComponent(taskId)}/graph-links`)
      if (!r.ok) throw new Error('API error')
      return await r.json()
    } catch {
      return []
    }
  }

  async function linkTaskToNode(
    taskId: string,
    dataset: string,
    nodeId: string,
    linkType?: string,
    annotation?: string,
  ): Promise<PmGraphLink | null> {
    try {
      const r = await fetch(`${BASE}/api/pm/tasks/${encodeURIComponent(taskId)}/graph-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset, node_id: nodeId, link_type: linkType, annotation }),
      })
      if (!r.ok) throw new Error('API error')
      return await r.json()
    } catch {
      return null
    }
  }

  // ── Smart View ────────────────────────────────────────────────────────────

  async function fetchSmartView(industry: string): Promise<PmSmartContext | null> {
    try {
      const r = await fetch(`${BASE}/api/pm/smart-view/${encodeURIComponent(industry)}`)
      if (!r.ok) throw new Error('API error')
      return await r.json()
    } catch {
      return null
    }
  }

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    // projects
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    // tasks
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    // milestones
    fetchMilestones,
    createMilestone,
    completeMilestone,
    // graph links
    fetchGraphLinks,
    linkTaskToNode,
    // smart view
    fetchSmartView,
  }
}

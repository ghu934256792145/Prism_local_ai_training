const BASE = 'http://localhost:3000'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MrpCostCenter {
  id: string
  code: string
  name: string
  department_id: string | null
  budget_kusd: number
  spent_kusd: number
}

export interface MrpMaterial {
  id: string
  product_id: string | null
  description: string
  uom: string
  on_hand: number
  safety_stock: number
  reorder_qty: number
  lead_time_days: number
  unit_cost: number
  make_buy: string
  cost_center_id: string | null
}

export interface MrpDemand {
  id: string
  material_id: string
  demand_qty: number
  required_date: string
  source: string
  source_ref: string | null
  cost_center_id: string | null
}

export interface MrpPlannedOrder {
  id: string
  material_id: string
  order_type: string
  qty: number
  planned_date: string
  due_date: string
  cost_center_id: string | null
  unit_cost: number
  total_cost: number
  status: string
  demand_ref: string | null
}

export interface MrpBudgetRollup {
  cost_center_id: string
  code: string
  name: string
  budget_kusd: number
  planned_cost_kusd: number
  utilization_pct: number
}

export interface MrpRunResult {
  planned_orders: MrpPlannedOrder[]
  total_planned_cost: number
  orders_created: number
  by_cost_center: MrpBudgetRollup[]
}

// ── Composable ────────────────────────────────────────────────────────────────

export function useMRP() {
  async function getCostCenters(): Promise<MrpCostCenter[]> {
    try {
      const res = await fetch(`${BASE}/api/mrp/cost-centers`)
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  async function getMaterials(): Promise<MrpMaterial[]> {
    try {
      const res = await fetch(`${BASE}/api/mrp/materials`)
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  async function getDemand(): Promise<MrpDemand[]> {
    try {
      const res = await fetch(`${BASE}/api/mrp/demand`)
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  async function getPlannedOrders(): Promise<MrpPlannedOrder[]> {
    try {
      const res = await fetch(`${BASE}/api/mrp/planned-orders`)
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  async function getBudgetRollup(): Promise<MrpBudgetRollup[]> {
    try {
      const res = await fetch(`${BASE}/api/mrp/budget-rollup`)
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  async function runMRP(horizonDays = 90): Promise<MrpRunResult | null> {
    try {
      const res = await fetch(`${BASE}/api/mrp/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horizon_days: horizonDays }),
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }

  async function createDemand(payload: object): Promise<MrpDemand | null> {
    try {
      const res = await fetch(`${BASE}/api/mrp/demand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }

  async function releaseOrder(id: string): Promise<boolean> {
    try {
      const res = await fetch(`${BASE}/api/mrp/planned-orders/${id}/release`, {
        method: 'POST',
      })
      return res.ok
    } catch {
      return false
    }
  }

  return {
    getCostCenters,
    getMaterials,
    getDemand,
    getPlannedOrders,
    getBudgetRollup,
    runMRP,
    createDemand,
    releaseOrder,
  }
}

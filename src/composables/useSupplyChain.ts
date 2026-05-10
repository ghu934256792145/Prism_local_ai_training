const API_BASE = 'http://localhost:3000'

export interface ScPurchaseOrder {
  id: string
  mrp_order_ref: string | null
  material_id: string
  supplier_id: string | null
  description: string
  qty: number
  uom: string
  unit_price: number
  total_value: number
  cost_center_id: string | null
  status: string
  order_date: string
  expected_date: string
  received_date: string | null
  received_qty: number
}

export interface ScInventoryMovement {
  id: string
  material_id: string
  movement_type: string
  qty: number
  reference_id: string | null
  movement_date: string
  notes: string | null
}

export interface ScSupplierScorecard {
  id: string
  supplier_id: string
  supplier_name: string
  on_time_deliveries: number
  late_deliveries: number
  total_orders: number
  avg_lead_time_days: number
  quality_score: number
  last_updated: string
  on_time_rate: number
}

export interface CreatePoRequest {
  material_id: string
  supplier_id?: string
  description: string
  qty: number
  uom: string
  unit_price: number
  cost_center_id?: string
  expected_date: string
  mrp_order_ref?: string
}

export interface BomImportRequest {
  entries: Array<{
    part_number: string
    description: string
    total_qty: number
    uom: string
    unit_cost: number
  }>
  cost_center_id: string
  due_date: string
  source_ref?: string
}

export function useSupplyChain() {
  async function getPurchaseOrders(): Promise<ScPurchaseOrder[]> {
    try {
      const res = await fetch(`${API_BASE}/api/sc/purchase-orders`)
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  async function getPurchaseOrdersForMaterial(id: string): Promise<ScPurchaseOrder[]> {
    try {
      const res = await fetch(`${API_BASE}/api/sc/purchase-orders?material_id=${encodeURIComponent(id)}`)
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  async function getInventoryMovements(materialId: string): Promise<ScInventoryMovement[]> {
    try {
      const res = await fetch(`${API_BASE}/api/sc/inventory-movements/${encodeURIComponent(materialId)}`)
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  async function getSupplierScorecards(): Promise<ScSupplierScorecard[]> {
    try {
      const res = await fetch(`${API_BASE}/api/sc/supplier-scorecards`)
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }

  async function getSupplyChainGraph(): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/api/sc/graph`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }

  async function createPurchaseOrder(req: CreatePoRequest): Promise<ScPurchaseOrder | null> {
    try {
      const res = await fetch(`${API_BASE}/api/sc/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }

  async function receiveGoods(poId: string, qty: number, notes?: string): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/api/sc/purchase-orders/${encodeURIComponent(poId)}/receive`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty_received: qty, notes: notes ?? null }),
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }

  async function importBomToMrp(req: BomImportRequest): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/api/mrp/import-bom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }

  return {
    getPurchaseOrders,
    getPurchaseOrdersForMaterial,
    getInventoryMovements,
    getSupplierScorecards,
    getSupplyChainGraph,
    createPurchaseOrder,
    receiveGoods,
    importBomToMrp,
  }
}

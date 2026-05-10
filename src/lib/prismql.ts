export type MatrixOp = 'pnl' | 'risk_score' | 'correlation' | 'transition'

export interface GraphFilter {
  field: string   // e.g. "a.value"
  op: '>' | '<' | '>=' | '<=' | '=' | '!='
  value: string
}

export type PrismQLNode =
  | { kind: 'graph';   relation?: string; direction?: 'out' | 'in' | 'both'; limit?: number; where?: string; filter?: GraphFilter }
  | { kind: 'path';    from: string; to: string }
  | { kind: 'explain'; inner: PrismQLNode; steps: ExplainStep[] }
  | { kind: 'matrix';  op: MatrixOp; dataset?: string; target?: string }
  | { kind: 'vector';  id: string; topK: number; metric?: string }
  | { kind: 'select';  fields: string[]; source: string; where?: string }
  | { kind: 'ai';      context?: string; prompt: string }

export interface ExplainStep {
  step: number
  operation: string
  detail: string
  estimatedCost: string
}

export interface ParseResult {
  ast: PrismQLNode | null
  error: string | null
}

const MATRIX_OPS = ['pnl', 'risk_score', 'correlation', 'transition'] as const

export function parsePrismQL(input: string): ParseResult {
  const query = input.trim()
  if (!query) return { ast: null, error: 'Query is empty.' }

  // EXPLAIN prefix
  if (/^EXPLAIN\b/i.test(query)) {
    const inner = query.replace(/^EXPLAIN\s+/i, '')
    const innerResult = parsePrismQL(inner)
    if (!innerResult.ast) return innerResult
    const steps = buildExplainPlan(innerResult.ast)
    return { ast: { kind: 'explain', inner: innerResult.ast, steps }, error: null }
  }

  return (
    parsePath(query) ??
    parseGraph(query) ??
    parseMatrix(query) ??
    parseVector(query) ??
    parseSelect(query) ??
    parseAI(query) ??
    { ast: null, error: 'Unsupported PrismQL command. Try GRAPH PATH, GRAPH MATCH, MATRIX, VECTOR, SELECT, or AI.' }
  )
}

function parsePath(query: string): ParseResult | null {
  if (!/^GRAPH\s+PATH\b/i.test(query)) return null
  const from = query.match(/\bFROM\s+([A-Za-z0-9_.-]+)/i)?.[1]
  const to   = query.match(/\bTO\s+([A-Za-z0-9_.-]+)/i)?.[1]
  if (!from || !to) return { ast: null, error: 'GRAPH PATH requires FROM <id> TO <id>.' }
  return { ast: { kind: 'path', from, to }, error: null }
}

function buildExplainPlan(node: PrismQLNode): ExplainStep[] {
  switch (node.kind) {
    case 'graph': {
      const steps: ExplainStep[] = [
        { step: 1, operation: 'FullScan',     detail: 'Read all nodes from live store',        estimatedCost: 'O(N)' },
        { step: 2, operation: 'EdgeTraversal', detail: node.relation ? `Filter edges WHERE label = "${node.relation}"` : 'Traverse all edge types', estimatedCost: 'O(E)' },
      ]
      if (node.filter) steps.push({ step: 3, operation: 'RowFilter', detail: `WHERE ${node.filter.field} ${node.filter.op} ${node.filter.value}`, estimatedCost: 'O(N)' })
      if (node.limit)  steps.push({ step: steps.length + 1, operation: 'Limit', detail: `Return top ${node.limit} results`, estimatedCost: 'O(1)' })
      return steps
    }
    case 'path':
      return [
        { step: 1, operation: 'NodeLookup', detail: `Locate source node "${node.from}"`,       estimatedCost: 'O(1)' },
        { step: 2, operation: 'BFS',        detail: `BFS traversal to "${node.to}"`,            estimatedCost: 'O(V+E)' },
        { step: 3, operation: 'PathTrace',  detail: 'Backtrack predecessor map to build path', estimatedCost: 'O(P)' },
      ]
    case 'vector':
      return [
        { step: 1, operation: 'EmbeddingLookup', detail: `Find vector for id="${node.id}"`,             estimatedCost: 'O(1)' },
        { step: 2, operation: 'FlatScan',        detail: `${node.metric ?? 'euclidean'} distance to all vectors`, estimatedCost: 'O(V·D)' },
        { step: 3, operation: 'TopK',            detail: `Select top ${node.topK} nearest neighbours`, estimatedCost: 'O(V log K)' },
      ]
    case 'matrix':
      return [
        { step: 1, operation: 'MatrixLoad', detail: `Load ${node.op} matrix`, estimatedCost: 'O(N²)' },
        { step: 2, operation: 'SIMDApply',  detail: 'AVX-512 vectorised op',   estimatedCost: 'O(N²/8)' },
      ]
    default:
      return [{ step: 1, operation: 'Execute', detail: `Run ${node.kind} query`, estimatedCost: 'O(?)' }]
  }
}

function parseGraph(query: string): ParseResult | null {
  if (!/^GRAPH\b/i.test(query)) return null
  if (!/\bMATCH\b/i.test(query)) {
    return { ast: null, error: 'GRAPH queries need a MATCH clause.' }
  }

  // Parse relationship pattern variants:
  //   (a)-[TYPE]->(b)   outgoing
  //   (a)<-[TYPE]-(b)   incoming
  //   (a)-[TYPE]-(b)    undirected
  //   (a)-[*]->(b)      any type
  let relation: string | undefined
  let direction: 'out' | 'in' | 'both' = 'both'

  const outMatch  = query.match(/\(\w*\)\s*-\[([A-Z_*|]+)\]->\s*\(\w*\)/i)
  const inMatch   = query.match(/\(\w*\)\s*<-\[([A-Z_*|]+)\]-\s*\(\w*\)/i)
  const bothMatch = query.match(/\(\w*\)\s*-\[([A-Z_*|]+)\]-\s*\(\w*\)/i)

  if (outMatch)       { relation = outMatch[1].toUpperCase();  direction = 'out' }
  else if (inMatch)   { relation = inMatch[1].toUpperCase();   direction = 'in' }
  else if (bothMatch) { relation = bothMatch[1].toUpperCase(); direction = 'both' }

  // Bracket shorthand: GRAPH MATCH [TYPE] (no parens)
  if (!relation) {
    const bracket = query.match(/\[\s*([A-Z_]+)?\s*\]/i)?.[1]?.toUpperCase()
    if (bracket) relation = bracket
  }

  // WHERE clause (before LIMIT)
  const whereRaw = query.match(/\bWHERE\s+(.+?)(?:\s+(?:LIMIT|RETURN)\s|$)/i)?.[1]?.trim()
  const where = whereRaw || query.match(/\bWHERE\s+(.+)$/i)?.[1]?.trim()

  // Parse first simple filter expression: node.field op value
  let filter: GraphFilter | undefined
  if (where) {
    const fm = where.match(/[a-z_]\w*\.([a-z_]\w*)\s*(>=|<=|!=|>|<|=)\s*([^\s]+)/i)
    if (fm) {
      filter = {
        field: fm[1],
        op: fm[2] as GraphFilter['op'],
        value: fm[3].replace(/^["']|["']$/g, ''),
      }
    }
  }

  const limit = readInt(query, /\bLIMIT\s+(\d+)\b/i)

  return { ast: { kind: 'graph', relation, direction, limit, where, filter }, error: null }
}

function parseMatrix(query: string): ParseResult | null {
  if (!/^MATRIX\b/i.test(query)) return null

  const rawOp = query.match(/\bop\s*=\s*"?([a-z_]+)"?/i)?.[1]?.toLowerCase()
  const op = rawOp && MATRIX_OPS.includes(rawOp as MatrixOp) ? rawOp as MatrixOp : null
  if (!op) {
    return { ast: null, error: `MATRIX op must be one of: ${MATRIX_OPS.join(', ')}.` }
  }

  const dataset = query.match(/\bdataset\s*=\s*"?([A-Za-z0-9_.:-]+)"?/i)?.[1]
  const target = query.match(/\b(?:vector|on)\s*=\s*"?([A-Za-z0-9_.:-]+)"?/i)?.[1]

  return { ast: { kind: 'matrix', op, dataset, target }, error: null }
}

function parseVector(query: string): ParseResult | null {
  if (!/^VECTOR\b/i.test(query)) return null
  if (!/\bSIMILARITY\b/i.test(query)) {
    return { ast: null, error: 'VECTOR queries currently support SIMILARITY.' }
  }

  const id = query.match(/\bid\s*=\s*"?([A-Za-z0-9_.:-]+)"?/i)?.[1]
  if (!id) return { ast: null, error: 'VECTOR SIMILARITY needs an id, for example id=vec-0-0.' }

  const topK = readInt(query, /\bTOP\s+(\d+)\b/i) ?? 10
  const metric = query.match(/\bUSING\s+([A-Za-z0-9_:-]+)\b/i)?.[1]

  return { ast: { kind: 'vector', id, topK: clamp(topK, 1, 100), metric }, error: null }
}

function parseSelect(query: string): ParseResult | null {
  if (!/^SELECT\b/i.test(query)) return null

  const match = query.match(/^SELECT\s+(.+?)\s+FROM\s+([A-Za-z0-9_.:-]+)(?:\s+WHERE\s+(.+))?$/i)
  if (!match) return { ast: null, error: 'SELECT queries need fields and a FROM source.' }

  return {
    ast: {
      kind: 'select',
      fields: match[1].split(',').map(f => f.trim()).filter(Boolean),
      source: match[2],
      where: match[3]?.trim()
    },
    error: null
  }
}

function parseAI(query: string): ParseResult | null {
  if (!/^AI\b/i.test(query)) return null

  const context = query.match(/\bcontext\s*=\s*([A-Za-z0-9_+:-]+)/i)?.[1]
  const prompt = query.match(/\bPROMPT\s+"([^"]+)"/i)?.[1] ?? query.match(/\bPROMPT\s+(.+)$/i)?.[1]
  if (!prompt) return { ast: null, error: 'AI queries need a PROMPT value.' }

  return { ast: { kind: 'ai', context, prompt }, error: null }
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

const KEYWORD_TEMPLATES = [
  'GRAPH MATCH (a)-[DEPENDS_ON]->(b) LIMIT 50',
  'GRAPH MATCH (a)-[*]->(b) WHERE a.value > 5 LIMIT 30',
  'GRAPH PATH FROM api-gw TO payment-svc',
  'EXPLAIN GRAPH MATCH (a)-[*]->(b) LIMIT 50',
  'MATRIX op="pnl"',
  'MATRIX op="correlation"',
  'MATRIX op="risk_score"',
  'VECTOR SIMILARITY id=vec-0-0 TOP 10 USING cosine',
  'SELECT id,label,value FROM graph WHERE category=0',
  'AI PROMPT "Summarise the risk profile of this graph"',
]

export function getSuggestions(input: string, nodeIds: string[] = []): string[] {
  const q = input.trim()
  if (!q) return KEYWORD_TEMPLATES

  // Suggest full templates when only the first keyword is typed
  const upper = q.toUpperCase()
  const templateMatches = KEYWORD_TEMPLATES.filter(t => t.toUpperCase().startsWith(upper))
  if (templateMatches.length) return templateMatches

  // After "id=" suggest node IDs
  if (/\bid=([A-Za-z0-9_.-]*)$/.test(q)) {
    const prefix = q.match(/\bid=([A-Za-z0-9_.-]*)$/)?.[1] ?? ''
    return nodeIds
      .filter(id => id.toLowerCase().startsWith(prefix.toLowerCase()))
      .slice(0, 12)
      .map(id => q.replace(/\bid=[A-Za-z0-9_.-]*$/, `id=${id}`))
  }

  return []
}

// ── helpers ───────────────────────────────────────────────────────────────────

function readInt(query: string, pattern: RegExp) {
  const value = query.match(pattern)?.[1]
  return value ? Number.parseInt(value, 10) : null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

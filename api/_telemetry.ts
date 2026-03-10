import { createClient } from '@libsql/client'

export const config = { runtime: 'nodejs', maxDuration: 5 }

const VALID_METHODS = new Set(['entity', 'alias', 'state', 'abbreviation', 'city-db', 'fuzzy'])
const VALID_ERRORS = new Set(['parse', 'resolve-source', 'resolve-target', 'conversion'])

function validateMethod(v: unknown): string | null {
  return typeof v === 'string' && VALID_METHODS.has(v) ? v : null
}

function validateError(v: unknown): string | null {
  return typeof v === 'string' && VALID_ERRORS.has(v) ? v : null
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const body = req.body
  if (!body || typeof body.query !== 'string' || body.query.trim() === '') {
    res.status(400).json({ error: 'missing query' })
    return
  }

  const query = body.query.slice(0, 500)
  const source_iana = typeof body.source_iana === 'string' ? body.source_iana : null
  const target_iana = typeof body.target_iana === 'string' ? body.target_iana : null
  const source_method = validateMethod(body.source_method)
  const target_method = validateMethod(body.target_method)
  const error_type = validateError(body.error_type)
  const session_id = typeof body.session_id === 'string' ? body.session_id.slice(0, 36) : null

  try {
    await db.execute({
      sql: `INSERT INTO telemetry_events (query, source_iana, target_iana, source_method, target_method, error_type, session_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [query, source_iana, target_iana, source_method, target_method, error_type, session_id],
    })
  } catch {
    // Telemetry must never fail visibly
  }

  res.status(204).end()
}

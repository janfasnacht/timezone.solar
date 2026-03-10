import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecute } = vi.hoisted(() => ({ mockExecute: vi.fn() }))
vi.mock('@libsql/client', () => ({
  createClient: () => ({ execute: mockExecute }),
}))

import handler from './_telemetry'

function makeReq(method: string, body?: unknown) {
  return { method, body }
}

function makeRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) { res.statusCode = code; return res },
    json(data: unknown) { res.body = data; return res },
    end() { return res },
  }
  return res
}

describe('telemetry handler', () => {
  beforeEach(() => {
    mockExecute.mockReset()
    mockExecute.mockResolvedValue({ rows: [], rowsAffected: 1 })
  })

  it('rejects non-POST methods with 405', async () => {
    const res = makeRes()
    await handler(makeReq('GET'), res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 400 when query is missing', async () => {
    const res = makeRes()
    await handler(makeReq('POST', {}), res)
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when query is empty', async () => {
    const res = makeRes()
    await handler(makeReq('POST', { query: '  ' }), res)
    expect(res.statusCode).toBe(400)
  })

  it('inserts valid event with session_id and returns 204', async () => {
    const res = makeRes()
    await handler(makeReq('POST', {
      query: '3pm NYC to London',
      source_iana: 'America/New_York',
      target_iana: 'Europe/London',
      source_method: 'entity',
      target_method: 'city-db',
      error_type: null,
      session_id: 'abc-123',
    }), res)
    expect(res.statusCode).toBe(204)
    expect(mockExecute).toHaveBeenCalledOnce()
    const { sql, args } = mockExecute.mock.calls[0][0]
    expect(sql).toContain('INSERT INTO telemetry_events')
    expect(args).toEqual([
      '3pm NYC to London',
      'America/New_York',
      'Europe/London',
      'entity',
      'city-db',
      null,
      'abc-123',
    ])
  })

  it('nullifies invalid source_method', async () => {
    const res = makeRes()
    await handler(makeReq('POST', {
      query: 'test',
      source_method: 'invalid-method',
    }), res)
    expect(res.statusCode).toBe(204)
    const { args } = mockExecute.mock.calls[0][0]
    // source_method is index 3
    expect(args[3]).toBeNull()
  })

  it('nullifies invalid error_type', async () => {
    const res = makeRes()
    await handler(makeReq('POST', {
      query: 'test',
      error_type: 'unknown-error',
    }), res)
    expect(res.statusCode).toBe(204)
    const { args } = mockExecute.mock.calls[0][0]
    // error_type is index 5
    expect(args[5]).toBeNull()
  })

  it('truncates session_id to 36 chars', async () => {
    const longId = 'a'.repeat(100)
    const res = makeRes()
    await handler(makeReq('POST', { query: 'test', session_id: longId }), res)
    expect(res.statusCode).toBe(204)
    const { args } = mockExecute.mock.calls[0][0]
    // session_id is index 6
    expect(args[6].length).toBe(36)
  })

  it('returns 204 even on DB error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB down'))
    const res = makeRes()
    await handler(makeReq('POST', { query: 'test query' }), res)
    expect(res.statusCode).toBe(204)
  })

  it('truncates query to 500 chars', async () => {
    const longQuery = 'a'.repeat(600)
    const res = makeRes()
    await handler(makeReq('POST', { query: longQuery }), res)
    expect(res.statusCode).toBe(204)
    const { args } = mockExecute.mock.calls[0][0]
    expect(args[0].length).toBe(500)
  })
})

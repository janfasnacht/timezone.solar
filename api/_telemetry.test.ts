import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSql = vi.fn()
vi.mock('@vercel/postgres', () => ({
  sql: (...args: unknown[]) => mockSql(...args),
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
    mockSql.mockReset()
    mockSql.mockResolvedValue(undefined)
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

  it('inserts valid event and returns 204', async () => {
    const res = makeRes()
    await handler(makeReq('POST', {
      query: '3pm NYC to London',
      source_iana: 'America/New_York',
      target_iana: 'Europe/London',
      source_method: 'entity',
      target_method: 'city-db',
      error_type: null,
    }), res)
    expect(res.statusCode).toBe(204)
    expect(mockSql).toHaveBeenCalledOnce()
  })

  it('nullifies invalid source_method', async () => {
    const res = makeRes()
    await handler(makeReq('POST', {
      query: 'test',
      source_method: 'invalid-method',
    }), res)
    expect(res.statusCode).toBe(204)
    // The template literal call passes nullified values
    const callArgs = mockSql.mock.calls[0]
    // sql tagged template: strings array + interpolated values
    const values = callArgs.slice(1)
    // source_method is 4th interpolated value (query, source_iana, target_iana, source_method)
    expect(values[3]).toBeNull()
  })

  it('nullifies invalid error_type', async () => {
    const res = makeRes()
    await handler(makeReq('POST', {
      query: 'test',
      error_type: 'unknown-error',
    }), res)
    expect(res.statusCode).toBe(204)
    const callArgs = mockSql.mock.calls[0]
    const values = callArgs.slice(1)
    // error_type is 6th interpolated value
    expect(values[5]).toBeNull()
  })

  it('returns 204 even on DB error', async () => {
    mockSql.mockRejectedValueOnce(new Error('DB down'))
    const res = makeRes()
    await handler(makeReq('POST', { query: 'test query' }), res)
    expect(res.statusCode).toBe(204)
  })

  it('truncates query to 500 chars', async () => {
    const longQuery = 'a'.repeat(600)
    const res = makeRes()
    await handler(makeReq('POST', { query: longQuery }), res)
    expect(res.statusCode).toBe(204)
    const callArgs = mockSql.mock.calls[0]
    const queryValue = callArgs[1]
    expect(queryValue.length).toBe(500)
  })
})

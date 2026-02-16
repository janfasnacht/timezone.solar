import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendTelemetry } from './telemetry'

vi.mock('@/lib/preferences', () => ({
  getSnapshot: vi.fn(() => ({ telemetryOptOut: false })),
}))

import { getSnapshot } from '@/lib/preferences'

const mockedGetSnapshot = vi.mocked(getSnapshot)

function makeEvent(query: string) {
  return {
    query,
    source_iana: 'America/New_York',
    target_iana: 'Europe/London',
    source_method: 'entity',
    target_method: 'city-db',
    error_type: null,
  }
}

describe('sendTelemetry', () => {
  beforeEach(() => {
    mockedGetSnapshot.mockReturnValue({
      telemetryOptOut: false,
      theme: 'system',
      timeFormat: '12h',
      homeCity: null,
    })
    // Reset dedup state by sending a unique query
    vi.restoreAllMocks()
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    // Re-mock getSnapshot after restoreAllMocks
    mockedGetSnapshot.mockReturnValue({
      telemetryOptOut: false,
      theme: 'system',
      timeFormat: '12h',
      homeCity: null,
    })
  })

  it('logs to console.debug in dev mode', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const event = makeEvent('unique-dev-test-' + Math.random())
    sendTelemetry(event)
    expect(spy).toHaveBeenCalledWith('[telemetry]', event)
  })

  it('skips duplicate query (dedup)', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const query = 'dedup-test-' + Math.random()
    sendTelemetry(makeEvent(query))
    expect(spy).toHaveBeenCalledTimes(1)
    sendTelemetry(makeEvent(query))
    expect(spy).toHaveBeenCalledTimes(1) // not called again
  })

  it('skips when opted out', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    mockedGetSnapshot.mockReturnValue({
      telemetryOptOut: true,
      theme: 'system',
      timeFormat: '12h',
      homeCity: null,
    })
    sendTelemetry(makeEvent('opted-out-test-' + Math.random()))
    expect(spy).not.toHaveBeenCalled()
  })

  it('sends different queries (not deduped)', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    sendTelemetry(makeEvent('query-a-' + Math.random()))
    sendTelemetry(makeEvent('query-b-' + Math.random()))
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

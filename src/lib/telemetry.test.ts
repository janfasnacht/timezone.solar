import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendTelemetry, _resetTelemetryState } from './telemetry'

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
    vi.useFakeTimers()
    _resetTelemetryState()
    vi.restoreAllMocks()
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    mockedGetSnapshot.mockReturnValue({
      telemetryOptOut: false,
      theme: 'system',
      timeFormat: '12h',
      homeCity: null,
    })
  })

  it('logs to console.debug in dev mode', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const event = makeEvent('dev-test')
    sendTelemetry(event)
    expect(spy).toHaveBeenCalledWith('[telemetry]', event)
  })

  it('skips duplicate query (dedup)', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    sendTelemetry(makeEvent('dedup-test'))
    expect(spy).toHaveBeenCalledTimes(1)
    sendTelemetry(makeEvent('dedup-test'))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('skips when opted out', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    mockedGetSnapshot.mockReturnValue({
      telemetryOptOut: true,
      theme: 'system',
      timeFormat: '12h',
      homeCity: null,
    })
    sendTelemetry(makeEvent('opted-out-test'))
    expect(spy).not.toHaveBeenCalled()
  })

  it('sends different queries (not deduped) after throttle window', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    sendTelemetry(makeEvent('query-a'))
    expect(spy).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    sendTelemetry(makeEvent('query-b'))
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('throttles events within 5s window', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    sendTelemetry(makeEvent('first'))
    expect(spy).toHaveBeenCalledTimes(1)

    // Within 5s window — should be queued, not sent
    vi.advanceTimersByTime(1000)
    sendTelemetry(makeEvent('second'))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('trailing send fires the latest event after window', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    sendTelemetry(makeEvent('first'))
    expect(spy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)
    sendTelemetry(makeEvent('second'))
    vi.advanceTimersByTime(1000)
    sendTelemetry(makeEvent('third'))
    expect(spy).toHaveBeenCalledTimes(1)

    // Advance past the remaining throttle window
    vi.advanceTimersByTime(4000)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenLastCalledWith('[telemetry]', makeEvent('third'))
  })

  it('sends immediately after throttle window has passed', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    sendTelemetry(makeEvent('first'))
    expect(spy).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(6000)
    sendTelemetry(makeEvent('after-window'))
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenLastCalledWith('[telemetry]', makeEvent('after-window'))
  })
})

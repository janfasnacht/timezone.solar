import { getSnapshot } from '@/lib/preferences'

export interface TelemetryEvent {
  query: string
  source_iana: string | null
  target_iana: string | null
  source_method: string | null
  target_method: string | null
  error_type: string | null
}

const THROTTLE_WINDOW = 5000
const sessionId = crypto.randomUUID()

let lastSentQuery = ''
let lastSentTime = 0
let pendingEvent: TelemetryEvent | null = null
let pendingTimer: ReturnType<typeof setTimeout> | null = null

export function _resetTelemetryState() {
  lastSentQuery = ''
  lastSentTime = 0
  pendingEvent = null
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer)
    pendingTimer = null
  }
}

function dispatchEvent(event: TelemetryEvent) {
  lastSentQuery = event.query
  lastSentTime = Date.now()

  if (import.meta.env.DEV) {
    console.debug('[telemetry]', { ...event, session_id: sessionId })
    return
  }

  fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...event, session_id: sessionId }),
    keepalive: true,
  }).catch(() => {})
}

export function sendTelemetry(event: TelemetryEvent) {
  if (getSnapshot().telemetryOptOut) return
  if (event.query === lastSentQuery) return

  const elapsed = Date.now() - lastSentTime

  if (elapsed >= THROTTLE_WINDOW) {
    // Clear any pending trailing send
    if (pendingTimer !== null) {
      clearTimeout(pendingTimer)
      pendingTimer = null
    }
    pendingEvent = null
    dispatchEvent(event)
  } else {
    // Queue as pending, schedule trailing send
    pendingEvent = event
    if (pendingTimer === null) {
      const remaining = THROTTLE_WINDOW - elapsed
      pendingTimer = setTimeout(() => {
        pendingTimer = null
        if (pendingEvent) {
          dispatchEvent(pendingEvent)
          pendingEvent = null
        }
      }, remaining)
    }
  }
}

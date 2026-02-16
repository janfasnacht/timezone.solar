import { getSnapshot } from '@/lib/preferences'

export interface TelemetryEvent {
  query: string
  source_iana: string | null
  target_iana: string | null
  source_method: string | null
  target_method: string | null
  error_type: string | null
}

let lastSentQuery = ''

export function sendTelemetry(event: TelemetryEvent) {
  if (getSnapshot().telemetryOptOut) return
  if (event.query === lastSentQuery) return
  lastSentQuery = event.query

  if (import.meta.env.DEV) {
    console.debug('[telemetry]', event)
    return
  }

  fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => {})
}

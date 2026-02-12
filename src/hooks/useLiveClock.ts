import { useState, useEffect } from 'react'
import { DateTime } from 'luxon'

export function useLiveClock(iana: string | null, use24h: boolean = false) {
  const format = use24h ? 'HH:mm' : 'h:mm a'

  const [time, setTime] = useState(() =>
    iana ? DateTime.now().setZone(iana).toFormat(format) : ''
  )

  useEffect(() => {
    if (!iana) return

    const update = () => {
      setTime(DateTime.now().setZone(iana).toFormat(format))
    }
    update()

    // Align to minute boundary
    const now = DateTime.now()
    const msUntilNextMinute = (60 - now.second) * 1000 - now.millisecond

    const timeout = setTimeout(() => {
      update()
      const interval = setInterval(update, 60000)
      // Store cleanup for interval inside the timeout cleanup
      cleanupRef = () => clearInterval(interval)
    }, msUntilNextMinute)

    let cleanupRef: (() => void) | null = null
    return () => {
      clearTimeout(timeout)
      cleanupRef?.()
    }
  }, [iana, format])

  return time
}

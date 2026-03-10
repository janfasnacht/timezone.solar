import { useState, useEffect } from 'react'

/**
 * Returns a Date that updates every minute, aligned to minute boundaries.
 * Used to drive the solar terminator and hover card time displays.
 */
export function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const current = new Date()
    const msUntilNextMinute =
      (60 - current.getSeconds()) * 1000 - current.getMilliseconds()

    let intervalCleanup: (() => void) | null = null

    const timeout = setTimeout(() => {
      setNow(new Date())
      const interval = setInterval(() => setNow(new Date()), 60_000)
      intervalCleanup = () => clearInterval(interval)
    }, msUntilNextMinute)

    return () => {
      clearTimeout(timeout)
      intervalCleanup?.()
    }
  }, [])

  return now
}

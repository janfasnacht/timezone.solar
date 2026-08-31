import { useState, useMemo, useCallback } from 'react'
import { DateTime } from 'luxon'
import { useMinuteTick } from '@/hooks/useMinuteTick'
import { parse } from '@/engine/parser'
import type { ConversionResult } from '@/engine/types'

export interface TimeOffset {
  offsetMinutes: number
  isOffset: boolean
  timeInput: string
  setTimeInput: (value: string) => void
  /** Parses a typed time and turns it into an offset from now. */
  submitTimeInput: (value: string) => void
  nudge: (deltaMinutes: number) => void
  reset: () => void
  /** The moment both views are rendering: the result's time plus the offset. */
  displayTime: Date
  /** That moment formatted in the user's home zone. */
  clockLabel: string
}

/**
 * The "what time are we looking at" state. Owned by App rather than MapView so a
 * nudge is visible in both renderings instead of vanishing when you switch views.
 */
export function useTimeOffset(
  result: ConversionResult | null,
  homeIana: string,
  use24h: boolean,
): TimeOffset {
  const liveTick = useMinuteTick()
  const [offsetMinutes, setOffsetMinutes] = useState(0)
  const [timeInput, setTimeInput] = useState('')

  // A new result means a new anchor, so the offset starts over.
  const [prevResult, setPrevResult] = useState(result)
  if (result !== prevResult) {
    setPrevResult(result)
    setOffsetMinutes(0)
    setTimeInput('')
  }

  const baseTime = useMemo(() => {
    if (result) {
      const dt = DateTime.fromISO(result.sourceDateTime)
      if (dt.isValid) return dt.toJSDate()
    }
    return liveTick
  }, [result, liveTick])

  const displayTime = useMemo(() => {
    if (offsetMinutes === 0) return baseTime
    return new Date(baseTime.getTime() + offsetMinutes * 60_000)
  }, [baseTime, offsetMinutes])

  const clockLabel = useMemo(() => {
    const dt = DateTime.fromJSDate(displayTime).setZone(homeIana)
    return dt.toFormat(use24h ? 'HH:mm' : 'h:mm a')
  }, [displayTime, homeIana, use24h])

  const nudge = useCallback((delta: number) => setOffsetMinutes((prev) => prev + delta), [])

  const reset = useCallback(() => {
    setOffsetMinutes(0)
    setTimeInput('')
  }, [])

  const submitTimeInput = useCallback((value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setOffsetMinutes(0)
      setTimeInput('')
      return
    }

    const { parsed } = parse(trimmed)
    if (!parsed) return

    const realNow = DateTime.now().setZone(homeIana)
    let targetDt = realNow

    if (parsed.time.type === 'absolute') {
      targetDt = realNow.set({
        hour: parsed.time.hour,
        minute: parsed.time.minute,
        second: 0,
        millisecond: 0,
      })
    } else if (parsed.time.type === 'relative') {
      targetDt = realNow.plus({ minutes: parsed.time.minutes })
    }

    if (parsed.dateModifier === 'tomorrow') {
      targetDt = targetDt.plus({ days: 1 })
    } else if (parsed.dateModifier === 'yesterday') {
      targetDt = targetDt.minus({ days: 1 })
    }

    setOffsetMinutes(Math.round(targetDt.diff(realNow, 'minutes').minutes))
    setTimeInput(trimmed)
  }, [homeIana])

  return {
    offsetMinutes,
    isOffset: offsetMinutes !== 0,
    timeInput,
    setTimeInput,
    submitTimeInput,
    nudge,
    reset,
    displayTime,
    clockLabel,
  }
}

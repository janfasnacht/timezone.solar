import { useState, useEffect, useMemo, useCallback } from 'react'

export type SegmentType = 'primary' | 'secondary'

export interface PlaceholderSegment {
  type: SegmentType
  text: string
}

// Compact notation: [primary] bare=secondary
// Both locations and times are [primary], connectors are bare secondary
const EXAMPLES = [
  '[Boston] [6pm] [in] [LA]',
  '[noon] [Tokyo] to [London]',
  '[9am] [NYC] [in] [SF]',
  '[Zurich] [4pm] to [Chicago]',
  '[6pm] [in] [Tokyo]',
  '[tomorrow 3pm] [London] [in] [EST]',
  'in [30 minutes] [in] [Berlin]',
  '[midnight] [Seoul] to [Paris]',
  '[Singapore] [8am] [in] [Sydney]',
  '[Denver] [noon] to [Mumbai]',
  '[10pm] [Hawaii] [in] [New York]',
  '[Dubai] [3pm] to [Toronto]',
  '[Bangkok] [7am] [in] [Amsterdam]',
  '[Mexico City] [5pm] [in] [Madrid]',
  '[Lagos] [noon] to [Nairobi]',
  '[11am] [Portland] [in] [Rome]',
  '[Istanbul] [9pm] to [São Paulo]',
  '[Osaka] [6am] [in] [Vancouver]',
  '[8pm] [Cairo] to [Melbourne]',
  '[Austin] [2pm] [in] [Shanghai]',
  '[Buenos Aires] [4pm] to [Helsinki]',
  '[Lima] [1pm] [in] [Bangkok]',
  '[Prague] [10am] to [Taipei]',
  '[Stockholm] [7pm] [in] [Honolulu]',
  '[Montreal] [3pm] to [Johannesburg]',
  '[Tokyo]',
  '[London]',
  '[New York] to [Berlin]',
  '[Zurich] to [Chicago]',
  'in [2 hours] [in] [Tokyo]',
  'in [45 minutes] [in] [London]',
  '[yesterday noon] [NYC] to [LA]',
  '[tomorrow 8am] [Paris] [in] [EST]',
  '[5:30pm] [Mumbai] to [SF]',
  '[7:15am] [Seoul] [in] [PST]',
  '[noon] [Reykjavik] to [Kathmandu]',
  '[3am] [Anchorage] [in] [Dubai]',
  '[Saturday 2pm] [Berlin] to [Tokyo]',
  '[Cape Town] [11am] to [Auckland]',
  '[Lisbon] [4pm] [in] [Taipei]',
]

const FEELING_WORDS = [
  'adventurous',
  'jetlagged',
  'curious',
  'global',
  'spontaneous',
  'nomadic',
  'restless',
  'worldly',
]

function parseSegments(notation: string): PlaceholderSegment[] {
  const segments: PlaceholderSegment[] = []
  let i = 0
  let secondary = ''

  while (i < notation.length) {
    const ch = notation[i]

    if (ch === '[') {
      if (secondary.trim()) {
        segments.push({ type: 'secondary', text: secondary.trim() })
        secondary = ''
      }
      const end = notation.indexOf(']', i)
      segments.push({ type: 'primary', text: notation.slice(i + 1, end) })
      i = end + 1
    } else {
      secondary += ch
      i++
    }
  }

  if (secondary.trim()) {
    segments.push({ type: 'secondary', text: secondary.trim() })
  }

  return segments
}

function stripBrackets(notation: string): string {
  return notation.replace(/\[|\]/g, '')
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

interface RotatingPlaceholder {
  segments: PlaceholderSegment[]
  feelingWord: string
  /** Returns the plain-text query currently displayed in the placeholder */
  getCurrentExample: () => string
}

export function useRotatingPlaceholder(hasUserInput: boolean): RotatingPlaceholder {
  const [pool] = useState(() => shuffle(EXAMPLES))
  const [index, setIndex] = useState(0)
  const [wordIndex, setWordIndex] = useState(() => Math.floor(Math.random() * FEELING_WORDS.length))
  const parsed = useMemo(() => pool.map(parseSegments), [pool])

  useEffect(() => {
    if (hasUserInput) return

    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % pool.length)
      setWordIndex((i) => (i + 1) % FEELING_WORDS.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [hasUserInput, pool])

  const getCurrentExample = useCallback(() => {
    return stripBrackets(pool[index])
  }, [pool, index])

  return {
    segments: parsed[index],
    feelingWord: FEELING_WORDS[wordIndex],
    getCurrentExample,
  }
}

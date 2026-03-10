import { useEffect } from 'react'
import type { ConversionResult } from '@/engine/types'

const DEFAULT_TITLE = 'timezone.solar — Timezone Converter'

export function useDocumentTitle(
  result: ConversionResult | null,
  query: string,
) {
  useEffect(() => {
    if (result) {
      document.title = `${result.source.city} to ${result.target.city} — timezone.solar`
    } else if (query) {
      document.title = `${query} — timezone.solar`
    } else {
      document.title = DEFAULT_TITLE
    }
    return () => {
      document.title = DEFAULT_TITLE
    }
  }, [result, query])
}

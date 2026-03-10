import { useEffect } from 'react'
import type { ConversionResult } from '@/engine/types'
import { buildCanonicalUrl } from '@/lib/canonicalUrl'

const DEFAULT_TITLE = 'timezone.solar — Timezone Converter'
const DEFAULT_CANONICAL = 'https://timezone.solar/'

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

  // Dynamic <link rel="canonical">
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'canonical'
      document.head.appendChild(link)
    }

    if (result) {
      link.href = buildCanonicalUrl(result, query)
    } else {
      link.href = DEFAULT_CANONICAL
    }

    return () => {
      link.href = DEFAULT_CANONICAL
    }
  }, [result, query])
}

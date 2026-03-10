import { useState, useEffect, useCallback } from 'react'
import { parseCanonicalParams, type CanonicalQuery } from '@/lib/canonicalUrl'

export type ViewMode = 'card' | 'map'

function getQueryFromUrl(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('q') ?? ''
}

function getCanonicalFromUrl(): CanonicalQuery | null {
  return parseCanonicalParams(new URLSearchParams(window.location.search))
}

function getViewFromUrl(): ViewMode {
  const params = new URLSearchParams(window.location.search)
  return params.get('view') === 'map' ? 'map' : 'card'
}

function updateUrl(query: string, view: ViewMode, replace: boolean) {
  const url = new URL(window.location.href)
  // Clear canonical params when setting q
  url.searchParams.delete('from')
  url.searchParams.delete('to')
  url.searchParams.delete('t')
  url.searchParams.delete('d')
  if (query) {
    url.searchParams.set('q', query)
  } else {
    url.searchParams.delete('q')
  }
  if (view === 'map') {
    url.searchParams.set('view', 'map')
  } else {
    url.searchParams.delete('view')
  }
  if (replace) {
    history.replaceState(null, '', url.toString())
  } else {
    history.pushState(null, '', url.toString())
  }
}

export function useUrlState() {
  const [query, setQueryState] = useState(getQueryFromUrl)
  const [canonicalQuery, setCanonicalQueryState] = useState<CanonicalQuery | null>(getCanonicalFromUrl)
  const [view, setViewState] = useState<ViewMode>(getViewFromUrl)

  useEffect(() => {
    function handlePopState() {
      setQueryState(getQueryFromUrl())
      // Only update canonical state if the params actually changed
      const newCanonical = getCanonicalFromUrl()
      setCanonicalQueryState(prev => {
        if (!prev && !newCanonical) return prev
        if (!prev || !newCanonical) return newCanonical
        if (prev.fromIana === newCanonical.fromIana && prev.toIana === newCanonical.toIana &&
            prev.hour === newCanonical.hour && prev.minute === newCanonical.minute) return prev
        return newCanonical
      })
      setViewState(getViewFromUrl())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const setQuery = useCallback((q: string) => {
    setQueryState(q)
    setCanonicalQueryState(null)
    updateUrl(q, getViewFromUrl(), false)
  }, [])

  const replaceQuery = useCallback((q: string) => {
    setQueryState(q)
    setCanonicalQueryState(null)
    updateUrl(q, getViewFromUrl(), true)
  }, [])

  const replaceWithCanonical = useCallback((params: URLSearchParams) => {
    const url = new URL(window.location.href)
    // Clear q param
    url.searchParams.delete('q')
    // Clear old canonical params
    url.searchParams.delete('from')
    url.searchParams.delete('to')
    url.searchParams.delete('t')
    url.searchParams.delete('d')
    // Set new canonical params
    params.forEach((v, k) => url.searchParams.set(k, v))
    // Preserve view
    const currentView = getViewFromUrl()
    if (currentView === 'map') {
      url.searchParams.set('view', 'map')
    } else {
      url.searchParams.delete('view')
    }
    history.replaceState(null, '', url.toString())
    setQueryState('')
    // Don't update canonicalQueryState here — this is called after a conversion
    // already produced a result. Updating it would re-trigger the canonical load effect.
  }, [])

  const setView = useCallback((v: ViewMode) => {
    setViewState(v)
    const url = new URL(window.location.href)
    if (v === 'map') {
      url.searchParams.set('view', 'map')
    } else {
      url.searchParams.delete('view')
    }
    history.replaceState(null, '', url.toString())
  }, [])

  return { query, canonicalQuery, setQuery, replaceQuery, replaceWithCanonical, view, setView }
}

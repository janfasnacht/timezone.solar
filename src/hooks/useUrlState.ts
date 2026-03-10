import { useState, useEffect, useCallback } from 'react'

export type ViewMode = 'card' | 'map'

function getQueryFromUrl(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('q') ?? ''
}

function getViewFromUrl(): ViewMode {
  const params = new URLSearchParams(window.location.search)
  return params.get('view') === 'map' ? 'map' : 'card'
}

function updateUrl(query: string, view: ViewMode, replace: boolean) {
  const url = new URL(window.location.href)
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
  const [view, setViewState] = useState<ViewMode>(getViewFromUrl)

  useEffect(() => {
    function handlePopState() {
      setQueryState(getQueryFromUrl())
      setViewState(getViewFromUrl())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const setQuery = useCallback((q: string) => {
    setQueryState(q)
    updateUrl(q, getViewFromUrl(), false)
  }, [])

  const replaceQuery = useCallback((q: string) => {
    setQueryState(q)
    updateUrl(q, getViewFromUrl(), true)
  }, [])

  const setView = useCallback((v: ViewMode) => {
    setViewState(v)
    updateUrl(getQueryFromUrl(), v, true)
  }, [])

  return { query, setQuery, replaceQuery, view, setView }
}

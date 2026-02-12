import { useState, useEffect, useCallback } from 'react'

function getQueryFromUrl(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('q') ?? ''
}

function updateUrl(query: string, replace: boolean) {
  const url = new URL(window.location.href)
  if (query) {
    url.searchParams.set('q', query)
  } else {
    url.searchParams.delete('q')
  }
  if (replace) {
    history.replaceState(null, '', url.toString())
  } else {
    history.pushState(null, '', url.toString())
  }
}

export function useUrlState() {
  const [query, setQueryState] = useState(getQueryFromUrl)

  useEffect(() => {
    function handlePopState() {
      setQueryState(getQueryFromUrl())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const setQuery = useCallback((q: string) => {
    setQueryState(q)
    updateUrl(q, false)
  }, [])

  const replaceQuery = useCallback((q: string) => {
    setQueryState(q)
    updateUrl(q, true)
  }, [])

  return { query, setQuery, replaceQuery }
}

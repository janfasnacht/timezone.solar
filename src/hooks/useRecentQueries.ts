import { useState, useCallback } from 'react'

const STORAGE_KEY = 'tz-recent-queries'
const MAX_QUERIES = 10

function loadQueries(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function useRecentQueries() {
  const [queries, setQueries] = useState<string[]>(loadQueries)

  const addQuery = useCallback((query: string) => {
    setQueries((prev) => {
      const filtered = prev.filter((q) => q.toLowerCase() !== query.toLowerCase())
      const updated = [query, ...filtered].slice(0, MAX_QUERIES)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const removeQuery = useCallback((query: string) => {
    setQueries((prev) => {
      const updated = prev.filter((q) => q.toLowerCase() !== query.toLowerCase())
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const clearQueries = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setQueries([])
  }, [])

  return { queries, addQuery, removeQuery, clearQueries }
}

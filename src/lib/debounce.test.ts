import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDebouncedCallback } from './debounce'

describe('createDebouncedCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('fires callback after delay', () => {
    const cb = vi.fn()
    const debounced = createDebouncedCallback(cb, 300)
    debounced.call()
    expect(cb).not.toHaveBeenCalled()
    vi.advanceTimersByTime(300)
    expect(cb).toHaveBeenCalledOnce()
  })

  it('resets timer on subsequent calls', () => {
    const cb = vi.fn()
    const debounced = createDebouncedCallback(cb, 300)
    debounced.call()
    vi.advanceTimersByTime(200)
    debounced.call()
    vi.advanceTimersByTime(200)
    expect(cb).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(cb).toHaveBeenCalledOnce()
  })

  it('cancel prevents callback from firing', () => {
    const cb = vi.fn()
    const debounced = createDebouncedCallback(cb, 300)
    debounced.call()
    debounced.cancel()
    vi.advanceTimersByTime(500)
    expect(cb).not.toHaveBeenCalled()
  })

  it('isPending tracks state correctly', () => {
    const cb = vi.fn()
    const debounced = createDebouncedCallback(cb, 300)
    expect(debounced.isPending()).toBe(false)
    debounced.call()
    expect(debounced.isPending()).toBe(true)
    vi.advanceTimersByTime(300)
    expect(debounced.isPending()).toBe(false)
  })

  it('isPending returns false after cancel', () => {
    const cb = vi.fn()
    const debounced = createDebouncedCallback(cb, 300)
    debounced.call()
    expect(debounced.isPending()).toBe(true)
    debounced.cancel()
    expect(debounced.isPending()).toBe(false)
  })

  it('passes arguments to callback', () => {
    const cb = vi.fn()
    const debounced = createDebouncedCallback(cb, 300)
    debounced.call('hello', 42)
    vi.advanceTimersByTime(300)
    expect(cb).toHaveBeenCalledWith('hello', 42)
  })
})

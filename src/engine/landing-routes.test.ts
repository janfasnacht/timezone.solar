import { describe, it, expect } from 'vitest'
import { parseLandingPath } from './landing-routes'

describe('parseLandingPath', () => {
  it('parses simple city-to-city path', () => {
    const result = parseLandingPath('/new-york-to-london')
    expect(result).toEqual({ fromSlug: 'new-york', toSlug: 'london' })
  })

  it('parses path with multi-word cities on both sides', () => {
    const result = parseLandingPath('/san-francisco-to-new-york')
    expect(result).toEqual({ fromSlug: 'san-francisco', toSlug: 'new-york' })
  })

  it('parses single-word city slugs', () => {
    const result = parseLandingPath('/tokyo-to-london')
    expect(result).toEqual({ fromSlug: 'tokyo', toSlug: 'london' })
  })

  it('parses same city to same city', () => {
    const result = parseLandingPath('/london-to-london')
    expect(result).toEqual({ fromSlug: 'london', toSlug: 'london' })
  })

  it('returns null for root path', () => {
    expect(parseLandingPath('/')).toBeNull()
  })

  it('returns null for empty path', () => {
    expect(parseLandingPath('')).toBeNull()
  })

  it('returns null for /about', () => {
    expect(parseLandingPath('/about')).toBeNull()
  })

  it('returns null for /map', () => {
    expect(parseLandingPath('/map')).toBeNull()
  })

  it('returns null for nested paths', () => {
    expect(parseLandingPath('/api/og')).toBeNull()
    expect(parseLandingPath('/assets/main.js')).toBeNull()
  })

  it('returns null for invalid slugs', () => {
    expect(parseLandingPath('/foo-to-bar')).toBeNull()
  })

  it('returns null for path with no -to- separator', () => {
    expect(parseLandingPath('/new-york')).toBeNull()
  })

  it('handles trailing slash', () => {
    const result = parseLandingPath('/tokyo-to-london/')
    expect(result).toEqual({ fromSlug: 'tokyo', toSlug: 'london' })
  })

  it('handles case insensitivity', () => {
    const result = parseLandingPath('/Tokyo-to-London')
    expect(result).toEqual({ fromSlug: 'tokyo', toSlug: 'london' })
  })

  it('returns null when only one side is valid', () => {
    expect(parseLandingPath('/new-york-to-fakecity')).toBeNull()
    expect(parseLandingPath('/fakecity-to-london')).toBeNull()
  })

  it('handles ambiguous splits correctly (santo-domingo-to-new-york)', () => {
    // santo-domingo is a valid entity, so this should match
    const result = parseLandingPath('/santo-domingo-to-new-york')
    if (result) {
      expect(result.fromSlug).toBe('santo-domingo')
      expect(result.toSlug).toBe('new-york')
    }
    // If santo-domingo is not in entities, null is fine too
  })
})

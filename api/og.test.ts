import { describe, it, expect, vi, beforeAll } from 'vitest'

// Mock fetch (fonts loaded at module scope) and @vercel/og before importing the module
vi.stubGlobal('fetch', vi.fn(() =>
  Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }),
))

vi.mock('@vercel/og', () => ({
  ImageResponse: class MockImageResponse {
    element: unknown
    options: unknown
    constructor(element: unknown, options: unknown) {
      this.element = element
      this.options = options
    }
  },
}))

let runConversion: typeof import('./og')['runConversion']

beforeAll(async () => {
  const mod = await import('./og')
  runConversion = mod.runConversion
})

describe('runConversion', () => {
  describe('basic queries', () => {
    it('converts "3pm NYC to London" successfully', () => {
      const result = runConversion('3pm NYC to London')
      expect(result).not.toBeNull()
      expect(result!.source.city).toMatch(/New York/i)
      expect(result!.target.city).toMatch(/London/i)
    })

    it('returns null for unparseable query', () => {
      expect(runConversion('asdfghjkl')).toBeNull()
    })

    it('returns null for unresolvable target', () => {
      expect(runConversion('3pm NYC to Xyzzyplugh')).toBeNull()
    })
  })

  describe('source fallback chain', () => {
    it('uses explicit source from query (ignores srcIana)', () => {
      const result = runConversion('3pm NYC to London', 'America/Chicago')
      expect(result).not.toBeNull()
      expect(result!.source.iana).toBe('America/New_York')
    })

    it('uses srcIana when query has no explicit source', () => {
      const result = runConversion('3pm in London', 'America/Chicago')
      expect(result).not.toBeNull()
      expect(result!.source.iana).toBe('America/Chicago')
    })

    it('resolves city from IANA like America/Los_Angeles', () => {
      const result = runConversion('3pm in London', 'America/Los_Angeles')
      expect(result).not.toBeNull()
      expect(result!.source.iana).toBe('America/Los_Angeles')
    })

    it('creates synthetic source for Etc/GMT zones', () => {
      const result = runConversion('3pm in London', 'Etc/GMT+5')
      expect(result).not.toBeNull()
      expect(result!.source.iana).toBe('Etc/GMT+5')
    })

    it('falls back to UTC when no source and no srcIana', () => {
      const result = runConversion('3pm in London')
      expect(result).not.toBeNull()
      expect(result!.source.iana).toBe('UTC')
    })
  })

  describe('passthrough', () => {
    it('handles date modifiers', () => {
      const result = runConversion('tomorrow 3pm NYC to London')
      expect(result).not.toBeNull()
    })

    it('handles relative time queries', () => {
      const result = runConversion('in 2 hours in London')
      expect(result).not.toBeNull()
    })
  })
})

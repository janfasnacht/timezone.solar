import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { lookupEntity, getEntityBySlug, getAllEntities } from './city-entities'

describe('city-entities', () => {
  describe('lookupEntity', () => {
    it('finds by display name', () => {
      const entity = lookupEntity('New York')
      expect(entity?.slug).toBe('new-york')
      expect(entity?.iana).toBe('America/New_York')
    })

    it('finds by display name case-insensitive', () => {
      const entity = lookupEntity('london')
      expect(entity?.slug).toBe('london')
    })

    it('finds by alias', () => {
      const entity = lookupEntity('nyc')
      expect(entity?.slug).toBe('new-york')
    })

    it('finds by country alias', () => {
      const entity = lookupEntity('japan')
      expect(entity?.slug).toBe('tokyo')
    })

    it('finds by multi-word alias', () => {
      const entity = lookupEntity('south korea')
      expect(entity?.slug).toBe('seoul')
    })

    it('finds São Paulo via normalized input', () => {
      const entity = lookupEntity('sao paulo')
      expect(entity?.slug).toBe('sao-paulo')
    })

    it('finds Washington DC via alias', () => {
      const entity = lookupEntity('dc')
      expect(entity?.slug).toBe('washington-dc')
    })

    it('returns null for non-entity city', () => {
      const entity = lookupEntity('Vladivostok')
      expect(entity).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(lookupEntity('')).toBeNull()
    })
  })

  describe('getEntityBySlug', () => {
    it('finds entity by slug', () => {
      const entity = getEntityBySlug('tokyo')
      expect(entity?.displayName).toBe('Tokyo')
      expect(entity?.iana).toBe('Asia/Tokyo')
    })

    it('returns null for unknown slug', () => {
      expect(getEntityBySlug('nonexistent')).toBeNull()
    })
  })

  describe('getAllEntities', () => {
    it('returns at least 300 entities', () => {
      const entities = getAllEntities()
      expect(entities.length).toBeGreaterThanOrEqual(300)
    })
  })

  describe('data integrity', () => {
    it('has no duplicate slugs', () => {
      const entities = getAllEntities()
      const slugs = entities.map((e) => e.slug)
      expect(new Set(slugs).size).toBe(slugs.length)
    })

    it('has no duplicate aliases', () => {
      const entities = getAllEntities()
      const allAliases: string[] = []
      for (const e of entities) {
        for (const a of e.aliases) {
          allAliases.push(a.toLowerCase())
        }
      }
      expect(new Set(allAliases).size).toBe(allAliases.length)
    })

    it('every entity has valid IANA timezone', () => {
      const entities = getAllEntities()
      for (const e of entities) {
        expect(e.iana).toMatch(/^[A-Z]/)
      }
    })

    it('every entity has 2-letter country code', () => {
      const entities = getAllEntities()
      for (const e of entities) {
        expect(e.countryCode).toMatch(/^[A-Z]{2}$/)
      }
    })

    it('every entity has exactly 3 vibes or null', () => {
      const entities = getAllEntities()
      for (const e of entities) {
        if (e.vibes !== null) {
          expect(e.vibes).toHaveLength(3)
        }
      }
    })

    it('no duplicate display names within same country', () => {
      const entities = getAllEntities()
      const seen = new Set<string>()
      for (const e of entities) {
        const key = `${e.displayName}|${e.country}`
        expect(seen.has(key), `Duplicate: ${key}`).toBe(false)
        seen.add(key)
      }
    })

    it('every svgCitiesSlug matches expected pattern', () => {
      const entities = getAllEntities()
      for (const e of entities) {
        if (e.svgCitiesSlug !== null) {
          expect(
            e.svgCitiesSlug,
            `Bad slug format: ${e.svgCitiesSlug}`,
          ).toMatch(/^[a-z]{2}-[a-z0-9-]+$/)
        }
      }
    })

    it('every svgCitiesSlug has a corresponding SVG file', () => {
      const entities = getAllEntities()
      const iconsDir = join(import.meta.dirname, '../../public/icons')
      for (const e of entities) {
        if (e.svgCitiesSlug !== null) {
          const filePath = join(iconsDir, `${e.svgCitiesSlug}.svg`)
          expect(
            existsSync(filePath),
            `Missing icon: ${e.svgCitiesSlug}.svg for ${e.slug}`,
          ).toBe(true)
        }
      }
    })

    it('original entities preserved unchanged', () => {
      const ny = getEntityBySlug('new-york')
      expect(ny?.vibes).toEqual(['electric', 'hustling', 'bold'])
      expect(ny?.aliases).toEqual(['nyc', 'ny'])
      expect(ny?.svgCitiesSlug).toBe('us-new-york')

      const tokyo = getEntityBySlug('tokyo')
      expect(tokyo?.vibes).toEqual(['zen', 'precise', 'futuristic'])
      expect(tokyo?.aliases).toEqual(['japan'])
      expect(tokyo?.svgCitiesSlug).toBe('jp-tokyo')

      const london = getEntityBySlug('london')
      expect(london?.vibes).toEqual(['posh', 'cozy', 'literary'])
      expect(london?.aliases).toEqual(['uk', 'england'])
    })
  })
})

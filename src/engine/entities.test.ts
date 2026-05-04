import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { lookupEntity, getEntityBySlug, getAllEntities, formatEntityLabel } from './entities'
import { TZ_ABBREVIATIONS } from './constants'
import { resolveLocation } from './resolver'

describe('entities', () => {
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

    it('every entity kind is recognized', () => {
      const entities = getAllEntities()
      for (const e of entities) {
        expect(['city', 'airport', 'landmark', 'region']).toContain(e.kind)
      }
    })

    it('every city has exactly 3 vibes or null', () => {
      const entities = getAllEntities()
      for (const e of entities) {
        if (e.kind !== 'city') continue
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

    it('every iconSlug matches expected pattern', () => {
      const entities = getAllEntities()
      for (const e of entities) {
        if (e.kind !== 'city') continue
        if (e.iconSlug !== null) {
          expect(
            e.iconSlug,
            `Bad slug format: ${e.iconSlug}`,
          ).toMatch(/^[a-z]{2}-[a-z0-9-]+$/)
        }
      }
    })

    it('every iconSlug has a corresponding SVG file', () => {
      const entities = getAllEntities()
      const iconsDir = join(import.meta.dirname, '../../public/icons')
      for (const e of entities) {
        if (e.kind !== 'city') continue
        if (e.iconSlug !== null) {
          const filePath = join(iconsDir, `${e.iconSlug}.svg`)
          expect(
            existsSync(filePath),
            `Missing icon: ${e.iconSlug}.svg for ${e.slug}`,
          ).toBe(true)
        }
      }
    })

    it('original entities preserved unchanged', () => {
      const ny = getEntityBySlug('new-york')
      expect(ny?.kind).toBe('city')
      if (ny?.kind !== 'city') throw new Error('expected city')
      expect(ny.vibes).toEqual(['electric', 'hustling', 'bold'])
      expect(ny.aliases).toEqual(['nyc', 'ny'])
      expect(ny.iconSlug).toBe('us-new-york')

      const tokyo = getEntityBySlug('tokyo')
      if (tokyo?.kind !== 'city') throw new Error('expected city')
      expect(tokyo.vibes).toEqual(['zen', 'precise', 'futuristic'])
      expect(tokyo.aliases).toEqual(['japan'])
      expect(tokyo.iconSlug).toBe('jp-tokyo')

      const london = getEntityBySlug('london')
      if (london?.kind !== 'city') throw new Error('expected city')
      expect(london.vibes).toEqual(['posh', 'cozy', 'literary'])
      expect(london.aliases).toEqual(['uk', 'england'])
    })
  })

  describe('airports', () => {
    it('JFK / LHR / NRT / HND resolve to airport entities', () => {
      for (const code of ['JFK', 'LHR', 'NRT', 'HND']) {
        const entity = lookupEntity(code)
        expect(entity?.kind, `${code} should be airport`).toBe('airport')
      }
    })

    it('IATA lookup is case-insensitive', () => {
      const upper = lookupEntity('JFK')
      const lower = lookupEntity('jfk')
      const mixed = lookupEntity('Jfk')
      expect(upper?.slug).toBe('jfk')
      expect(lower?.slug).toBe('jfk')
      expect(mixed?.slug).toBe('jfk')
    })

    it("IST stays as India Standard Time, not Istanbul Airport", () => {
      // Regression guard: 'ist' must NOT short-circuit through the entity
      // catalog into IST airport — the resolver's TZ-abbreviation layer owns it.
      expect(lookupEntity('ist')).toBeNull()
      expect(lookupEntity('IST')).toBeNull()
      const result = resolveLocation('IST')
      expect(result?.primary.iana).toBe('Asia/Kolkata')
      expect(result?.primary.resolveMethod).toBe('abbreviation')
    })

    it("Istanbul Airport entry exists in catalog (reachable by display name 'Istanbul Airport')", () => {
      // Generated catalog uses the bare IATA slug 'ist'. The 'ist' alias is
      // omitted (TZ collision) so the only Layer-0 hit is via the display
      // name lookup, which normalizes "Istanbul Airport" to match the
      // airportName-derived display string. Either way the airport is in
      // the catalog and findable by entity slug.
      const entity = getEntityBySlug('ist')
      expect(entity?.kind).toBe('airport')
      expect(entity?.iana).toBe('Europe/Istanbul')
      if (entity?.kind === 'airport') {
        expect(entity.parentCitySlug).toBe('istanbul')
      }
    })

    it('IATA codes that collide with city aliases yield the city', () => {
      // 'bos', 'atl', 'mia', 'sea', 'den', 'dfw', 'bkk' are city aliases.
      // The colliding airports stay in the catalog but skip the IATA alias.
      expect(lookupEntity('bos')?.slug).toBe('boston')
      expect(lookupEntity('atl')?.slug).toBe('atlanta')
      expect(lookupEntity('mia')?.slug).toBe('miami')
      expect(lookupEntity('sea')?.slug).toBe('seattle')
      expect(lookupEntity('bkk')?.slug).toBe('bangkok')
    })

    it('BSL / EuroAirport edge case: France country, parent links cross-border to Freiburg', () => {
      // BSL is physically in France (LFSB) but serves Switzerland and Germany.
      // OpenFlights gives it Europe/Paris (correct for its physical location);
      // CET means same offset as Zurich/Berlin in any case. The nearest
      // curated city is Freiburg (≈55km, Germany) — the script links it as
      // parent because it's within the cross-border 100km threshold.
      const bsl = lookupEntity('BSL')
      expect(bsl?.kind).toBe('airport')
      expect(bsl?.country).toBe('France')
      expect(bsl?.iana).toBe('Europe/Paris')
      if (bsl?.kind === 'airport') {
        expect(bsl.parentCitySlug).toBe('freiburg')
      }
    })

    it('every airport has a 3-letter uppercase IATA', () => {
      const airports = getAllEntities().filter((e) => e.kind === 'airport')
      expect(airports.length).toBeGreaterThan(0)
      for (const a of airports) {
        if (a.kind !== 'airport') continue
        expect(a.iata, a.slug).toMatch(/^[A-Z]{3}$/)
      }
    })

    it('every airport parentCitySlug points to a real city or is null', () => {
      const airports = getAllEntities().filter((e) => e.kind === 'airport')
      for (const a of airports) {
        if (a.kind !== 'airport') continue
        if (a.parentCitySlug === null) continue
        const parent = getEntityBySlug(a.parentCitySlug)
        expect(parent, `${a.slug} → missing parent ${a.parentCitySlug}`).not.toBeNull()
        expect(parent?.kind, `${a.slug} parent must be a city`).toBe('city')
      }
    })

    it('no airport alias collides with a TZ abbreviation', () => {
      const airports = getAllEntities().filter((e) => e.kind === 'airport')
      for (const a of airports) {
        for (const alias of a.aliases) {
          expect(
            TZ_ABBREVIATIONS[alias.toLowerCase()],
            `airport ${a.slug} alias '${alias}' collides with TZ_ABBREVIATIONS`,
          ).toBeUndefined()
        }
      }
    })

    it('formatEntityLabel composes "IATA · Parent City" for airports', () => {
      const jfk = getEntityBySlug('jfk')
      expect(jfk?.kind).toBe('airport')
      expect(formatEntityLabel(jfk!.slug, 'fallback')).toBe('JFK · New York')
    })

    it('formatEntityLabel returns bare display name for cities', () => {
      const tokyo = getEntityBySlug('tokyo')
      expect(formatEntityLabel(tokyo!.slug, 'fallback')).toBe('Tokyo')
    })

    it('formatEntityLabel uses fallback when slug is undefined or unknown', () => {
      expect(formatEntityLabel(undefined, 'fb')).toBe('fb')
      expect(formatEntityLabel('does-not-exist', 'fb')).toBe('fb')
    })
  })
})

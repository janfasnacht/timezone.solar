import { describe, it, expect } from 'vitest'
import { resolveLocation, getSuggestion } from './resolver'
import { convert } from './converter'

describe('resolver', () => {
  // --- Aliases ---

  describe('aliases', () => {
    it('resolves nyc → New York', () => {
      const result = resolveLocation('nyc')
      expect(result?.primary.displayName).toBe('New York')
      expect(result?.primary.resolveMethod).toBe('entity')
      expect(result?.primary.iana).toBe('America/New_York')
    })

    it('resolves la → Los Angeles', () => {
      const result = resolveLocation('la')
      expect(result?.primary.displayName).toBe('Los Angeles')
      expect(result?.primary.resolveMethod).toBe('entity')
    })

    it('resolves sf → San Francisco', () => {
      const result = resolveLocation('sf')
      expect(result?.primary.displayName).toBe('San Francisco')
      expect(result?.primary.resolveMethod).toBe('entity')
    })

    it('resolves uk → London', () => {
      const result = resolveLocation('uk')
      expect(result?.primary.displayName).toBe('London')
      expect(result?.primary.resolveMethod).toBe('entity')
    })

    it('resolves japan → Tokyo', () => {
      const result = resolveLocation('japan')
      expect(result?.primary.displayName).toBe('Tokyo')
      expect(result?.primary.resolveMethod).toBe('entity')
    })

    it('resolves hk → Hong Kong', () => {
      const result = resolveLocation('hk')
      expect(result?.primary.displayName).toBe('Hong Kong')
      expect(result?.primary.resolveMethod).toBe('entity')
    })

    it('resolves nz → Auckland', () => {
      const result = resolveLocation('nz')
      expect(result?.primary.displayName).toBe('Auckland')
      expect(result?.primary.resolveMethod).toBe('entity')
    })
  })

  // --- US States ---

  describe('US states', () => {
    it('resolves california', () => {
      const result = resolveLocation('california')
      expect(result?.primary.iana).toBe('America/Los_Angeles')
      expect(result?.primary.resolveMethod).toBe('state')
      expect(result?.primary.kind).toBe('region')
    })

    it('resolves texas', () => {
      const result = resolveLocation('texas')
      expect(result?.primary.iana).toBe('America/Chicago')
      expect(result?.primary.resolveMethod).toBe('state')
      expect(result?.primary.kind).toBe('region')
    })

    it('resolves hawaii', () => {
      const result = resolveLocation('hawaii')
      expect(result?.primary.iana).toBe('Pacific/Honolulu')
      expect(result?.primary.resolveMethod).toBe('state')
    })

    it('resolves arizona (no DST)', () => {
      const result = resolveLocation('arizona')
      expect(result?.primary.iana).toBe('America/Phoenix')
      expect(result?.primary.resolveMethod).toBe('state')
    })

    it('resolves east coast', () => {
      const result = resolveLocation('east coast')
      expect(result?.primary.iana).toBe('America/New_York')
      expect(result?.primary.resolveMethod).toBe('state')
    })

    it('resolves west coast', () => {
      const result = resolveLocation('west coast')
      expect(result?.primary.iana).toBe('America/Los_Angeles')
      expect(result?.primary.resolveMethod).toBe('state')
    })
  })

  // --- TZ abbreviations ---

  describe('timezone abbreviations', () => {
    it('resolves est', () => {
      const result = resolveLocation('est')
      expect(result?.primary.iana).toBe('America/New_York')
      expect(result?.primary.resolveMethod).toBe('abbreviation')
      expect(result?.primary.interpretedAs).toBe('US Eastern Time')
      expect(result?.primary.kind).toBe('timezone')
    })

    it('resolves pst', () => {
      const result = resolveLocation('pst')
      expect(result?.primary.iana).toBe('America/Los_Angeles')
      expect(result?.primary.resolveMethod).toBe('abbreviation')
    })

    it('resolves gmt', () => {
      const result = resolveLocation('gmt')
      expect(result?.primary.iana).toBe('Europe/London')
      expect(result?.primary.resolveMethod).toBe('abbreviation')
      expect(result?.primary.interpretedAs).toBe('Greenwich Mean Time')
    })

    it('resolves utc', () => {
      const result = resolveLocation('utc')
      expect(result?.primary.iana).toBe('UTC')
      expect(result?.primary.resolveMethod).toBe('abbreviation')
    })

    it('resolves jst', () => {
      const result = resolveLocation('jst')
      expect(result?.primary.iana).toBe('Asia/Tokyo')
      expect(result?.primary.resolveMethod).toBe('abbreviation')
    })

    it('resolves ist', () => {
      const result = resolveLocation('ist')
      expect(result?.primary.iana).toBe('Asia/Kolkata')
      expect(result?.primary.resolveMethod).toBe('abbreviation')
    })

    it('resolves aest', () => {
      const result = resolveLocation('aest')
      expect(result?.primary.iana).toBe('Australia/Sydney')
      expect(result?.primary.resolveMethod).toBe('abbreviation')
    })
  })

  // --- UTC offsets ---

  describe('UTC offsets', () => {
    it('resolves utc-2 to the zone itself', () => {
      const result = resolveLocation('utc-2')
      expect(result?.primary.iana).toBe('UTC-2')
      expect(result?.primary.displayName).toBe('UTC-2')
      expect(result?.primary.kind).toBe('timezone')
      expect(result?.primary.resolveMethod).toBe('utc-offset')
    })

    it('keeps the minutes of a half-hour offset', () => {
      expect(resolveLocation('UTC+5:30')?.primary.iana).toBe('UTC+5:30')
      expect(resolveLocation('utc+0530')?.primary.iana).toBe('UTC+5:30')
      expect(resolveLocation('utc+2:45')?.primary.iana).toBe('UTC+2:45')
    })

    it('reads gmt as a synonym for utc', () => {
      expect(resolveLocation('gmt+3')?.primary.iana).toBe('UTC+3')
      expect(resolveLocation('GMT-0530')?.primary.iana).toBe('UTC-5:30')
    })

    it('tolerates a space before the sign', () => {
      expect(resolveLocation('utc +2')?.primary.iana).toBe('UTC+2')
    })

    it('tells the two signs apart', () => {
      // `normalize` drops both the sign and the colon, so these would share a
      // cache key if the offset layer ran behind it.
      expect(resolveLocation('utc+5:30')?.primary.iana).toBe('UTC+5:30')
      expect(resolveLocation('utc-5:30')?.primary.iana).toBe('UTC-5:30')
    })

    it('leaves bare utc and gmt to the abbreviation layer', () => {
      expect(resolveLocation('utc')?.primary.resolveMethod).toBe('abbreviation')
      expect(resolveLocation('gmt')?.primary.iana).toBe('Europe/London')
    })

    it('rejects offsets no zone has', () => {
      expect(resolveLocation('utc+15')).toBeNull()
      expect(resolveLocation('utc-13')).toBeNull()
      expect(resolveLocation('utc+5:99')).toBeNull()
    })

    it('converts through a fixed offset', () => {
      const source = resolveLocation('utc-2')!.primary
      const target = resolveLocation('utc+5:30')!.primary
      const result = convert({
        source,
        target,
        time: { type: 'absolute', hour: 15, minute: 0 },
        dateModifier: null,
      })
      expect(result.target.formattedTime24).toBe('22:30')
      expect(result.offsetDifference).toBe('+7h 30m')
    })
  })

  // --- City database ---

  describe('city database', () => {
    it('resolves London', () => {
      const result = resolveLocation('London')
      expect(result?.primary.iana).toBe('Europe/London')
      expect(result?.primary.resolveMethod).toBe('entity')
    })

    it('resolves Tokyo', () => {
      const result = resolveLocation('Tokyo')
      expect(result?.primary.iana).toBe('Asia/Tokyo')
      expect(result?.primary.resolveMethod).toBe('entity')
    })

    it('resolves New York', () => {
      const result = resolveLocation('New York')
      expect(result?.primary.iana).toBe('America/New_York')
      expect(result?.primary.resolveMethod).toBe('entity')
    })

    it('resolves São Paulo with diacritics', () => {
      const result = resolveLocation('São Paulo')
      expect(result?.primary.iana).toBe('America/Sao_Paulo')
      expect(result?.primary.resolveMethod).toBe('entity')
    })

    it('resolves sao paulo without diacritics', () => {
      const result = resolveLocation('sao paulo')
      expect(result?.primary.iana).toBe('America/Sao_Paulo')
      expect(result?.primary.resolveMethod).toBe('entity')
    })
  })

  // --- Fuzzy matching ---

  describe('fuzzy matching', () => {
    it('matches "Londno" (typo) to London', () => {
      const result = resolveLocation('Londno')
      expect(result?.primary.displayName).toBe('London')
      expect(result?.primary.resolveMethod).toBe('fuzzy')
    })

    it('matches "Tokio" (typo) to Tokyo', () => {
      const result = resolveLocation('Tokio')
      expect(result?.primary.displayName).toBe('Tokyo')
      expect(result?.primary.resolveMethod).toBe('fuzzy')
    })

    it('matches "Sydnee" (typo) to Sydney', () => {
      const result = resolveLocation('Sydnee')
      expect(result?.primary.displayName).toBe('Sydney')
      expect(result?.primary.resolveMethod).toBe('fuzzy')
    })
  })

  // --- Fuzzy gating ---

  describe('fuzzy matching only corrects typos', () => {
    it('still fixes a misspelling', () => {
      expect(resolveLocation('Tokoy')?.primary.iana).toBe('Asia/Tokyo')
      expect(resolveLocation('nyw york')?.primary.iana).toBe('America/New_York')
      expect(resolveLocation('San Fransisco')?.primary.iana).toBe('America/Los_Angeles')
    })

    it('refuses a match too far from what was typed', () => {
      // Kemerovo scores better under Fuse than New York does for `nyw york`.
      expect(resolveLocation('Meroe')).toBeNull()
      expect(resolveLocation('Iceland')).toBeNull()
      expect(resolveLocation('asdf')).toBeNull()
    })

    it('offers the near miss as a suggestion instead', () => {
      expect(getSuggestion('Meroe')).toBe('Kemerovo')
    })
  })

  // --- Both spellings of a row ---

  describe('city database', () => {
    it('finds a city under its own name, not only its transliteration', () => {
      // 115 rows disagree with their `city_ascii`; on that key alone the other
      // spelling was reachable only by a fuzzy guess, and often a wrong one.
      expect(resolveLocation('Kashgar')?.primary.iana).toBe('Asia/Kashgar')
      expect(resolveLocation('Bensonville')?.primary.iana).toBe('Africa/Monrovia')
      expect(resolveLocation('Tromsø')?.primary.iana).toBe('Europe/Oslo')
    })
  })

  // --- Disambiguation ---

  describe('disambiguation', () => {
    it('resolves Portland with primary (OR) and alternatives', () => {
      const result = resolveLocation('Portland')
      expect(result?.primary.displayName).toBe('Portland')
      expect(result?.primary.iana).toBe('America/Los_Angeles')
      expect(result!.alternatives.length).toBeGreaterThan(0)
    })

    it('resolves Cambridge with alternatives', () => {
      const result = resolveLocation('Cambridge')
      expect(result).not.toBeNull()
      expect(result?.primary.displayName).toBe('Cambridge')
    })

    it('resolves Geneva with alternatives', () => {
      const result = resolveLocation('Geneva')
      expect(result).not.toBeNull()
      expect(result?.primary.displayName).toBe('Geneva')
    })
  })

  // --- Edge cases ---

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(resolveLocation('')).toBeNull()
    })

    it('returns null for whitespace only', () => {
      expect(resolveLocation('   ')).toBeNull()
    })

    it('returns null for garbage input', () => {
      expect(resolveLocation('xyzzy123abc')).toBeNull()
    })

    it('abbreviation displayName is uppercase', () => {
      const result = resolveLocation('est')
      expect(result?.primary.displayName).toBe('EST')
    })

    it('handles leading/trailing whitespace', () => {
      const result = resolveLocation('  London  ')
      expect(result?.primary.iana).toBe('Europe/London')
    })
  })

  // --- getSuggestion ---

  describe('getSuggestion', () => {
    it('suggests a correction for a typo', () => {
      const suggestion = getSuggestion('Londno')
      expect(suggestion).toBe('London')
    })

    it('returns null for total garbage', () => {
      const suggestion = getSuggestion('xyzzy123abc')
      expect(suggestion).toBeNull()
    })

    it('suggests for partial match', () => {
      const suggestion = getSuggestion('Toky')
      expect(suggestion).toBe('Tokyo')
    })
  })

  // --- Cache ---

  describe('cache', () => {
    it('returns identical result for same input', () => {
      const result1 = resolveLocation('London')
      const result2 = resolveLocation('London')
      expect(result1).toBe(result2) // same reference (cached)
    })
  })
})

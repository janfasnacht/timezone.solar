import type { TokenType } from './types'
import { CONNECTORS, NAMED_TIMES, DATE_MODIFIERS } from './constants'
import { parseTimeToken } from './parser-utils'

export type TokenTypeExtended = TokenType | 'NOISE'

export const NOISE_WORDS = new Set([
  // Question/filler words
  'what', 'whats', 'is', 'the', 'it', 'can', 'you', 'tell', 'me',
  'please', 'show', 'check', 'find', 'get', 'time', 'clock', 'current',
  'right', 'how', 'when', 'where', 'would', 'could', 'will', 'do',
  'does', 'difference',
  // Pronouns/articles
  'i', 'a', 'an', 'my', 'your', 'its', 'their',
  // Verbs
  'need', 'know', 'want', 'convert', 'schedule', 'have',
  // Nouns (non-location context)
  'meeting', 'call', 'colleague', 'zone',
  // Interjections / voice assistant prefixes
  'ok', 'okay', 'hey', 'hi', 'hello', 'google', 'siri', 'alexa',
  // Conjunctions
  'if', 'so', 'then', 'that',
  // Politeness
  'pls', 'plz', 'thanks', 'thx', 'thank', 'sorry',
  // The app's own vocabulary
  'timezone', 'timezones', 'converter', 'conversion', 'search', 'query',
  'help', 'random', 'test',
  // Deixis and quantity
  'there', 'here', 'about', 'many', 'much', 'hours', 'hour', 'ahead',
  'behind', 'oclock',
  // Vague times — no hour to extract, so noise rather than TIME
  'morning', 'afternoon', 'evening', 'night', 'tonight',
  // Business-hours phrasing; the range itself is not parsed
  'working', 'work', 'business', 'office', 'overlap',
])

/** A bare letter, or a token with no letters. No place name takes that shape. */
export function isUnpronounceable(raw: string): boolean {
  const letters = raw.replace(/[^\p{L}]/gu, '')
  if (letters.length === 0) return true
  return letters.length < 2 && raw.length < 3
}

export const CONNECTORS_EXTENDED = new Set([
  ...CONNECTORS,
  'and', 'between', 'vs', 'versus', 'for',
])

export function classifyToken(raw: string): TokenTypeExtended {
  const lower = raw.toLowerCase()
  if (CONNECTORS_EXTENDED.has(lower)) return 'CONNECTOR'
  if (NAMED_TIMES[lower]) return 'TIME'
  if (parseTimeToken(raw) !== null) return 'TIME'
  if (DATE_MODIFIERS[lower]) return 'DATE_MODIFIER'
  if (NOISE_WORDS.has(lower)) return 'NOISE'
  if (isUnpronounceable(raw)) return 'NOISE'
  return 'LOCATION'
}

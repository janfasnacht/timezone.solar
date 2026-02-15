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
])

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
  return 'LOCATION'
}

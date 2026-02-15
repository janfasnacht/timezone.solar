import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ParserAdapter, ParserResult } from '@/engine/eval'

const __dirname = dirname(fileURLToPath(import.meta.url))
import { parse } from './parser'
import {
  parseConfidence,
  combinedConfidence,
  assignTier,
} from './confidence'
import { resolveWithConfidence } from './resolver-wrapper'

export const parserAdapter: ParserAdapter = {
  name: 'v2-noise-tolerant',
  parse(input: string): ParserResult {
    const { parsed, matchType, noiseCount } = parse(input)

    if (!parsed) {
      return { parsed: null, tier: 3, confidence: 0 }
    }

    const parseConf = parseConfidence({ matchType, noiseCount })

    // Compute resolve confidence for tier/confidence scoring
    let minResolveConf = 1.0
    let anyAlternatives = false

    if (parsed.targetLocation) {
      const targetResolved = resolveWithConfidence(parsed.targetLocation)
      if (targetResolved) {
        minResolveConf = Math.min(minResolveConf, targetResolved.confidence)
        if (targetResolved.result.alternatives.length > 0) anyAlternatives = true
      } else {
        minResolveConf = 0
      }
    }

    if (parsed.sourceLocation) {
      const sourceResolved = resolveWithConfidence(parsed.sourceLocation)
      if (sourceResolved) {
        minResolveConf = Math.min(minResolveConf, sourceResolved.confidence)
        if (sourceResolved.result.alternatives.length > 0) anyAlternatives = true
      } else {
        minResolveConf = 0
      }
    }

    const combined = combinedConfidence(parseConf, minResolveConf)
    const tier = assignTier(combined, anyAlternatives)

    return { parsed, tier, confidence: combined }
  },
  sourceFiles: [
    resolve(__dirname, 'parser.ts'),
    resolve(__dirname, 'noise-words.ts'),
    resolve(__dirname, 'confidence.ts'),
    resolve(__dirname, 'resolver-wrapper.ts'),
  ],
}

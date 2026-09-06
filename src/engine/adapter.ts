import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ParserAdapter, ParserResult } from '@/engine/eval'
import { parse } from './parser'
import { parseConfidence, combinedConfidence, assignTier } from './confidence'
import { resolveLocation } from './resolver'
import { resolveWithConfidence } from './resolver-wrapper'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Resolve the way the product does. `useConversion` calls bare
 * `resolveLocation`; the wrapper adds gating no user reaches, so it is consulted
 * below only for its confidence figure.
 */
function resolveAsProduct(name: string | null): { iana: string | null; ambiguous: boolean } {
  if (!name) return { iana: null, ambiguous: false }
  const result = resolveLocation(name)
  if (!result) return { iana: null, ambiguous: false }
  const distinct = new Set(result.alternatives.map((a) => a.iana))
  distinct.delete(result.primary.iana)
  return { iana: result.primary.iana, ambiguous: distinct.size > 0 }
}

export const parserAdapter: ParserAdapter = {
  name: 'v2-noise-tolerant',
  parse(input: string): ParserResult {
    const { parsed, matchType, noiseCount } = parse(input)

    if (!parsed) {
      return { parsed: null, tier: 3, confidence: 0 }
    }

    const parseConf = parseConfidence({ matchType, noiseCount })

    let minResolveConf = 1.0
    let anyAlternatives = false

    for (const name of [parsed.targetLocation, parsed.sourceLocation]) {
      if (!name) continue
      const resolved = resolveWithConfidence(name)
      if (resolved) {
        minResolveConf = Math.min(minResolveConf, resolved.confidence)
        if (resolved.result.alternatives.length > 0) anyAlternatives = true
      } else {
        minResolveConf = 0
      }
    }

    const combined = combinedConfidence(parseConf, minResolveConf)
    const tier = assignTier(combined, anyAlternatives)

    const source = resolveAsProduct(parsed.sourceLocation)
    const target = resolveAsProduct(parsed.targetLocation)

    return {
      parsed,
      tier,
      confidence: combined,
      resolution: {
        sourceIana: source.iana,
        targetIana: target.iana,
        ambiguous: source.ambiguous || target.ambiguous,
      },
    }
  },
  // Rules, not records: `entities.ts` and the generated airport data are data.
  sourceFiles: [
    resolve(__dirname, 'parser.ts'),
    resolve(__dirname, 'parser-utils.ts'),
    resolve(__dirname, 'noise-words.ts'),
    resolve(__dirname, 'confidence.ts'),
    resolve(__dirname, 'resolver.ts'),
    resolve(__dirname, 'resolver-wrapper.ts'),
  ],
}

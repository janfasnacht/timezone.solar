import { readFileSync } from 'node:fs'
import type { EvalScorecard, CalibrationBucket } from './types'

// --- Composite score ---

const WEIGHTS = {
  accuracy: 0.40,
  tierSafety: 0.20,
  tierAccuracy: 0.15,
  latency: 0.10,
  complexity: 0.05,
  calibration: 0.10,
}

export function computeComposite(scorecard: Omit<EvalScorecard, 'composite'>): number {
  const available: { weight: number; value: number }[] = []

  available.push({ weight: WEIGHTS.accuracy, value: scorecard.accuracy.overall })
  available.push({ weight: WEIGHTS.tierSafety, value: scorecard.tierSafety })

  if (scorecard.tierAccuracy !== null) {
    available.push({ weight: WEIGHTS.tierAccuracy, value: scorecard.tierAccuracy })
  }

  available.push({ weight: WEIGHTS.latency, value: latencyScore(scorecard.latency.p95) })

  if (scorecard.complexity !== null) {
    // Lower LOC + fewer regexes = better. Normalize: 1.0 at <=200 LOC, linear decay to 0 at 1000 LOC.
    const locScore = Math.max(0, Math.min(1, 1 - (scorecard.complexity.loc - 200) / 800))
    available.push({ weight: WEIGHTS.complexity, value: locScore })
  }

  if (scorecard.calibration !== null) {
    available.push({ weight: WEIGHTS.calibration, value: calibrationScore(scorecard.calibration) })
  }

  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0)
  const weightedSum = available.reduce((sum, c) => sum + c.weight * c.value, 0)

  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

// --- Latency scoring ---

export function latencyScore(p95ms: number): number {
  if (p95ms <= 300) return 1.0
  if (p95ms >= 1000) return 0.0
  return 1.0 - (p95ms - 300) / 700
}

// --- Calibration ---

const BUCKET_EDGES = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]

export function calibrationCurve(
  results: Array<{ confidence: number; correct: boolean }>
): CalibrationBucket[] | null {
  if (results.length === 0) return null

  const buckets: CalibrationBucket[] = []
  for (let i = 0; i < BUCKET_EDGES.length - 1; i++) {
    const lo = BUCKET_EDGES[i]
    const hi = BUCKET_EDGES[i + 1]
    const inBucket = results.filter((r) => r.confidence >= lo && r.confidence < (i === BUCKET_EDGES.length - 2 ? hi + 0.001 : hi))
    if (inBucket.length === 0) continue
    const avgConf = inBucket.reduce((s, r) => s + r.confidence, 0) / inBucket.length
    const acc = inBucket.filter((r) => r.correct).length / inBucket.length
    buckets.push({ range: [lo, hi], predictedConfidence: avgConf, actualAccuracy: acc, count: inBucket.length })
  }
  return buckets.length > 0 ? buckets : null
}

function calibrationScore(buckets: CalibrationBucket[]): number {
  // Mean absolute error between predicted confidence and actual accuracy, inverted to 0-1 score
  let totalError = 0
  let totalCount = 0
  for (const b of buckets) {
    totalError += Math.abs(b.predictedConfidence - b.actualAccuracy) * b.count
    totalCount += b.count
  }
  if (totalCount === 0) return 1.0
  const mae = totalError / totalCount
  return Math.max(0, 1 - mae)
}

// --- Complexity ---

export function complexityMetric(sourceFiles: string[]): { loc: number; regexCount: number } | null {
  if (sourceFiles.length === 0) return null

  let totalLoc = 0
  let totalRegex = 0

  for (const file of sourceFiles) {
    try {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      totalLoc += lines.filter((l) => l.trim().length > 0).length
      // Count regex literals: /pattern/flags
      const regexMatches = content.match(/\/(?![/*])(?:[^/\\]|\\.)+\/[gimsuy]*/g)
      if (regexMatches) totalRegex += regexMatches.length
    } catch {
      // File not found — skip
    }
  }

  return { loc: totalLoc, regexCount: totalRegex }
}

// --- Percentile helper ---

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

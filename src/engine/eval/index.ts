export type {
  TestCase,
  ParserResult,
  ParserAdapter,
  ParseAssertionResult,
  CalibrationBucket,
  EvalScorecard,
} from './types'

export { loadFixture, filterBySet, filterBySplit, groupByTag } from './fixture'

export {
  computeComposite,
  latencyScore,
  calibrationCurve,
  complexityMetric,
  percentile,
} from './metrics'

export {
  assertParseResult,
  runEvaluation,
  printScorecard,
  printComparisonTable,
  printFailures,
} from './scorecard'

export type { EvalBaseline, BaselineMetric } from './baseline'
export { hashExpectations, toMetricMap, buildBaseline } from './baseline'

export type { BaselineDiff, BaselineComparison, DiffKind } from './compare'
export { compareToBaseline, formatComparison } from './compare'

export { pinEvalEnvironment, EVAL_NOW_ISO, EVAL_DAY_FIRST } from './determinism'

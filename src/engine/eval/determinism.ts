/**
 * Pin what the engine reads from its environment, so a CI runner and a laptop
 * agree: `resolvesDayFirst()` reads the ambient locale, and Luxon reads the
 * clock. Called by both the eval run and the baseline generator.
 */

import { Settings } from 'luxon'
import { setDayFirstForTests } from '../parser-utils'


export const EVAL_NOW_ISO = '2026-09-15T12:00:00Z'

/** US reading of `05/06`. */
export const EVAL_DAY_FIRST = false

export function pinEvalEnvironment(): void {
  setDayFirstForTests(EVAL_DAY_FIRST)
  const fixed = Date.parse(EVAL_NOW_ISO)
  Settings.now = () => fixed
}

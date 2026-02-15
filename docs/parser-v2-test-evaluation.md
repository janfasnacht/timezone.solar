# Parser v2: Test Suite & Evaluation Framework

*The test set is the spec. Every downstream decision is evaluated against it.*

**Part of [Parser v2 Overview](./parser-v2-overview.md)**

> **Note:** The canonical data model for conversion identity — `LocationRef`, `TimeRef`, `ConversionIntent` — is now implemented in `src/engine/types.ts` (see [#2](https://github.com/janfasnacht/timezone.solar/issues/2)). The test schema below aligns with these types.

---

## Why This Comes First

Without a test suite, every parser change is anecdotal. "I fixed the noise word bug" means nothing if it broke 5 other inputs you didn't check. The test suite provides:

- A **baseline** for the current parser (what % of realistic inputs does it handle today?)
- A **decision function** for architecture choice (which approach scores highest?)
- A **regression gate** for CI (does this change break anything?)
- A **calibration target** for the confidence system (are our tiers accurate?)

## Three Distinct Test Sets

### Set 1: Distribution-Realistic (Primary Metric)

Mirrors actual user behavior. This is the main accuracy number. Biasing this set toward edge cases would optimize for rare inputs at the expense of common ones.

**Composition targets:**

| Category | % | What it covers |
|----------|---|----------------|
| Clean, simple queries | 60-70% | Single city, city + time, two cities with time/connector, aliases (NYC, SF), relative time ("in 2 hours"), date modifiers ("tomorrow"), named times (noon, midnight), multi-word cities, single-location queries — structurally unambiguous, common phrasing |
| Minor noise / structural variation | 15-20% | Filler words, slight rewording, unusual ordering |
| Ambiguous or challenging | 10-15% | Ambiguous city names, mixed formats, creative phrasing |
| Garbage / out-of-scope | 5% | Random strings, conversational inputs, non-timezone queries |

**City distribution:**

| Tier | % | Source |
|------|---|--------|
| Top-20 global cities | 50% | London, Tokyo, New York, Berlin, Sydney, Paris, etc. |
| Top-100 cities | 30% | Dubai, Bangkok, Mumbai, Toronto, etc. |
| Long tail | 20% | Montevideo, Accra, Almaty, Reykjavik, etc. |

**Format variation:** The same city should appear in multiple formats across the set — "New York", "NYC", "new york", "NY", "newyork". This tests both the parser (does it extract the token?) and the resolver (does it recognize the variant?).

**How to generate (three-step process):**

**Step A — LLM-generated realistic inputs.** Prompt a model with diverse personas to generate 50-100 queries each:
- Business traveler scheduling calls across time zones
- Remote worker coordinating with a distributed team
- Someone calling family abroad
- Tourist planning a trip
- Someone who barely knows what a timezone is

The prompt should ask for natural phrasing, not "timezone converter queries." Frame it as "what would you type into a search box to figure out what time it is somewhere?"

**Step B — Post-hoc audit.** Review the generated set for:
- Over-representation of any city (London shouldn't be 30% of cases)
- Over-representation of any pattern (not all queries should be `time + city + to + city`)
- Under-representation of the garbage/out-of-scope category
- Whether the difficulty distribution matches the targets above

Downsample or add cases to correct imbalances. Then **freeze** this set. Never tune against it. Split 70% dev / 30% eval before any optimization begins.

**Step C — Ground truth authoring.** For each test case, fill in the expected parse result: `expectedSource`, `expectedTarget`, `expectedTime` (as `TimeRef`), `expectedDateModifier`, and `expectedTier`. See the TestCase schema below. Ambiguous cases where two labelers disagree should be tagged as genuinely ambiguous (Tier 2).

### Set 2: Edge Cases (Stress Test)

Deliberately constructed to probe specific failure modes. Evaluated and reported **separately** from Set 1 so it doesn't distort the main accuracy number.

Organized by difficulty dimension:

| Dimension | What It Tests | Examples |
|-----------|--------------|---------|
| **Structural ambiguity** | Multiple valid parses exist for the same location string | "Portland", "Georgia", "Birmingham", "Victoria" |
| **Token ambiguity** | A single token has multiple valid classifications | "Jan" (month/name/city), "March" (month/verb), "noon" in "Noon Australia" |
| **Noise tolerance** | Filler words mixed with valid query tokens | "3pm meeting time Berlin London", "what time is it in Tokyo", "can you tell me 3pm NYC to London" |
| **Completeness** | Partial, minimal, or empty input; also business-hour ranges | "Tokyo" (valid), "6pm" (no city), "hi", "", "asdf", "9-5 London to NYC" |
| **Typos** | Misspelled but recoverable city names | "Londno", "Zuric", "Tokyp", "Sydeny", "Berln" |
| **Format mixing** | TZ abbreviations, full timezone names, and informal regions combined with city names | "3pm EST to London", "Eastern Time to Pacific Time", "east coast to London", "CET to JST" |
| **Multi-word cities** | Cities whose names look like multiple tokens | "New York", "San Francisco", "Buenos Aires", "Ho Chi Minh City", "Salt Lake City" |
| **Short inputs** | Inputs where length alone creates ambiguity | "LA", "SF", "UK", "NZ", "DC" |
| **Date modifier** | Date anchoring keywords in various positions | "tomorrow 3pm NYC to London", "yesterday 5pm London", "tmrw 8am SF to Chicago" |
| **Relative time** | Relative time expressions with various phrasings | "in 2 hours NYC to London", "in half an hour London", "in 1h30m Tokyo to SF" |
| **UTC offset** | Numeric UTC/GMT offsets as location references | "3pm UTC+8 to London", "GMT-5 to Tokyo", "UTC+5:30" |
| **Day-of-week** | Day names with optional "next"/"this"/"last" prefix | "next Tuesday 3pm NYC to London", "Monday 9am Berlin to Tokyo", "Thu 2pm Chicago" |
| **Non-Latin** | CJK, Cyrillic, Arabic scripts, and Latin diacritics | "東京 to London", "Москва to NYC", "München to London" |

Each edge case should be **tagged** with which dimensions make it hard. When an architecture fails on a dimension, this tagging reveals the class of difficulty, not just a list of broken inputs.

### Set 3: Regression (Grows Over Time)

Starts empty. Every bug report, user complaint, or unexpected failure becomes a test case with its ground truth and expected tier. This set is **append-only** — never pruned, never down-sampled. It prevents fixes from breaking previously-working inputs. Real user inputs from analytics or feedback are the primary source for this set.

Add to this set:
- Any input from a real user that produced a wrong or surprising result
- Any input that changes behavior during a refactor (whether or not the new behavior is "correct")
- Specifically crafted inputs that test the boundary conditions of a fix

## Ground Truth Schema

Each test case records what the parser should extract from the raw input. These fields align with the codebase types in `src/engine/types.ts`.

```typescript
interface TestCase {
  input: string                          // Raw user input exactly as typed
  expectedSource: string | null          // Source location string as parser extracts it, null = implicit local
  expectedTarget: string | null          // Target location string as parser extracts it, null = not specified
  expectedTime: TimeRef                  // Expected time: { type: 'now' }, { type: 'absolute', hour, minute }, or { type: 'relative', minutes }
  expectedDateModifier: DateModifier     // 'tomorrow' | 'yesterday' | 'today' | null
  expectedTier: 1 | 2 | 3               // Which presentation tier
  expectedSourceKind?: LocationKind      // Optional: 'city' | 'country' | 'region' | 'timezone' — for testing entity classification
  expectedTargetKind?: LocationKind      // Optional: same as above for target
  difficultyTags: string[]               // Which difficulty dimensions apply
  notes: string                          // Why this case is tricky or what it tests
  set: 'realistic' | 'edge' | 'regression'
}
```

`expectedSource` and `expectedTarget` are raw location strings as the parser extracts them — not resolved `LocationRef`s. Resolution is tested separately. The optional `expectedSourceKind` and `expectedTargetKind` fields allow testing entity classification (e.g., verifying that "EST" is classified as `'timezone'` and "Japan" as `'country'`) without requiring full resolution.

The fully resolved form of a test case's ground truth is a `ConversionIntent` (source `LocationRef` + target `LocationRef` + `TimeRef` + `DateModifier`). The test harness can construct this by running parsed locations through the resolver and comparing the resulting intent against the expected values.

**Important:** `expectedTier` is about the confidence classification, not the parse correctness. A correctly parsed ambiguous input should still be Tier 2. A garbage input should be Tier 3 regardless of whether the parser happens to match something.

## Evaluation Metrics

### Primary Axes

| Axis | Metric | How Measured |
|------|--------|-------------|
| **Parse accuracy** | % where extracted (source, target, time, date) matches ground truth | Automated comparison |
| **Tier accuracy** | % where assigned tier matches expected tier | Automated comparison |
| **Tier safety** | % of Tier-1 assignments that are actually correct | Among all Tier-1 outputs, what fraction is right? |
| **Latency** | p50 and p95 from input to parsed result | Benchmark 1000 runs |
| **Complexity** | Lines of code + number of heuristic rules | Manual audit |

### The Critical Metric: Tier Safety

**Tier safety = 1 - (incorrect Tier-1 assignments / total Tier-1 assignments)**

Target: **>98%**

This is the single most important metric. A system that is 85% accurate but 99% tier-safe (it almost never shows wrong results as Tier 1) provides a better UX than one that is 95% accurate but 90% tier-safe. Users forgive "I'm not sure" much more than confidently wrong answers.

### Composite Score (For Architecture Comparison)

**Status: provisional.** These weights are placeholders. Revisit once baseline evaluation data exists to understand which axes actually differentiate architectures.

| Component | Weight | Rationale |
|-----------|--------|-----------|
| Tier safety | 0.30 | Wrong confident result is the worst outcome |
| Parse accuracy (Set 1) | 0.25 | Getting the right answer on realistic inputs |
| Tier accuracy | 0.20 | Correct presentation of results |
| Latency (p95 < 300ms = 1.0, linear decay) | 0.10 | UX constraint |
| Complexity (inverse of LOC + rule count) | 0.10 | Maintenance cost |
| Cost (zero = 1.0, decay per $/1K queries) | 0.05 | Infrastructure cost |

These weights are proposals. The key insight is that **tier safety and parse accuracy dominate** while cost and latency are secondary constraints (since the recommended architecture is client-side, cost = 0 and latency is sub-millisecond).

## Evaluation Protocol

1. **Hold-out principle.** Split Set 1 into dev (70%) and eval (30%) once. Tune against dev. Report final numbers on eval. Never tune on eval.

2. **Per-dimension analysis on Set 2.** Report accuracy broken down by difficulty tag. This reveals which class of difficulty an architecture struggles with.

3. **Calibration curves.** For any system that produces a continuous confidence score, plot reliability diagrams: bucket by confidence, plot actual accuracy per bucket. Flat diagonal = perfect calibration.

4. **Baseline first.** Run the current parser against all sets before making any changes. This baseline is the bar that every improvement must beat, and it answers the question "how bad is it actually?" — which might be less bad than anecdotal evidence suggests.

## Harness Design

The evaluation harness should be:

- A **vitest test file** (`src/engine/parser-eval.test.ts`) that loads test cases from a JSON fixture
- Runs each case through `parse()` + `resolveLocation()` and compares to ground truth
- Reports per-metric scores at the end
- Tagged cases can be filtered: `npx vitest run --grep "edge:noise"` etc.
- Separate from the unit tests — this is an evaluation suite, not a pass/fail gate

The fixture file should live at `src/engine/__fixtures__/parser-eval.json` with the `TestCase[]` schema above.

## Avoiding Test Set Bias

| Bias | Risk | Mitigation |
|------|------|------------|
| **Researcher bias** | Over-indexing on intellectually interesting edge cases | Enforce composition targets |
| **City bias** | London and Tokyo dominating the set | Audit city distribution, enforce tier targets |
| **Survivorship bias** | Only testing inputs the current parser handles | Include inputs people would naturally type but currently fail |
| **Optimization pressure** | Overfitting to the test set through repeated tuning | Freeze eval split, tune only on dev split |
| **Persona bias** | All generated inputs sound like a developer | Use diverse personas in generation prompts |

## Practical Notes

- **Size target:** ~200-300 cases for Set 1, ~100-150 tagged cases for Set 2. Large enough to be statistically meaningful, small enough to maintain ground truth manually.
- **Ground truth authoring:** Two people should independently label each case. Disagreements are discussed and resolved. If they can't agree, the case is tagged as genuinely ambiguous (which is useful data — ambiguous inputs should be Tier 2).
- **Updating Set 1:** Never. It's frozen after construction. All new cases go into Set 3 (regression). If the distribution drifts significantly over time (e.g., the app attracts a different user base), construct a new Set 1 from scratch.

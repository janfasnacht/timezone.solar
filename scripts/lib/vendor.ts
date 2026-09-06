/**
 * Whether what is on disk still matches `vendor/manifest.json`. A dataset is
 * verified when its bytes hash to the manifest and its generated artifacts
 * regenerate byte-for-byte from those bytes.
 */

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { generateAirportData, OUTPUT_FILE as AIRPORT_OUTPUT } from './airport-data'
import { generateCityData, OUTPUT_FILE as CITY_OUTPUT } from './city-table'

export const ROOT = join(import.meta.dirname, '..', '..')
export const MANIFEST_PATH = join(ROOT, 'vendor', 'manifest.json')

export type Source =
  | { kind: 'github'; repo: string; path: string; commit: string; commitDate: string }
  | { kind: 'npm'; package: string; version: string }

export interface Dataset {
  id: string
  title: string
  source: Source
  license: Record<string, unknown>
  vendored: { path: string; sha256: string } | null
  generates: string[]
  regenerate: string
}

export interface Manifest {
  policy: string
  datasets: Dataset[]
}

export function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest
}

export function sha256(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex')
}

// --- Offline checks ---

/** Every way the tree is out of step with the manifest. */
export function checkOffline(manifest: Manifest): string[] {
  const problems: string[] = []
  for (const d of manifest.datasets) {
    problems.push(...(d.source.kind === 'npm' ? checkNpmPin(d, d.source) : checkVendored(d)))
  }
  problems.push(...checkGeneratedArtifacts(manifest))
  return problems
}

function checkNpmPin(d: Dataset, source: Source & { kind: 'npm' }): string[] {
  const problems: string[] = []
  const declared = declaredVersion(source.package)
  if (declared === undefined) {
    return [`${d.id}: package.json does not depend on ${source.package}`]
  }
  if (!/^\d+\.\d+\.\d+/.test(declared)) {
    problems.push(`${d.id}: package.json range "${declared}" is not an exact version`)
  }
  if (declared !== source.version) {
    problems.push(`${d.id}: package.json declares "${declared}", manifest pins ${source.version}`)
  }
  const installed = installedVersion(source.package)
  if (installed !== null && installed !== source.version) {
    problems.push(`${d.id}: installed ${installed}, manifest pins ${source.version}`)
  }
  return problems
}

function checkVendored(d: Dataset): string[] {
  const problems: string[] = []
  if (d.vendored) {
    const actual = sha256(readFileSync(join(ROOT, d.vendored.path)))
    if (actual !== d.vendored.sha256) {
      problems.push(
        `${d.id}: ${d.vendored.path} hashes to ${actual.slice(0, 12)}…, manifest records ${d.vendored.sha256.slice(0, 12)}…`,
      )
    }
  }
  return problems
}

/** A manifest entry naming an artifact absent here is itself a failure. */
const GENERATORS: Record<string, { file: string; generate: () => { text: string } }> = {
  'src/engine/airport-data.generated.ts': { file: AIRPORT_OUTPUT, generate: generateAirportData },
  'src/engine/city-data.generated.ts': { file: CITY_OUTPUT, generate: generateCityData },
}

/** A generated artifact must be reproducible from the input it names. */
export function checkGeneratedArtifacts(manifest: Manifest): string[] {
  const problems: string[] = []
  for (const d of manifest.datasets) {
    for (const path of d.generates) {
      const gen = GENERATORS[path]
      if (!gen) {
        problems.push(`${d.id}: ${path} has no generator registered in scripts/lib/vendor.ts`)
        continue
      }
      if (gen.generate().text !== readFileSync(gen.file, 'utf8')) {
        problems.push(`${d.id}: ${path} does not match its input — run ${d.regenerate}`)
      }
    }
  }
  return problems
}

function declaredVersion(name: string): string | undefined {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]
}

function installedVersion(name: string): string | null {
  const p = join(ROOT, 'node_modules', name, 'package.json')
  if (!existsSync(p)) return null
  return (JSON.parse(readFileSync(p, 'utf8')) as { version: string }).version
}

// --- Upstream, over the network ---

async function gh<T>(path: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export async function latestCommit(
  repo: string,
  path: string,
): Promise<{ sha: string; date: string }> {
  const [head] = await gh<{ sha: string; commit: { committer: { date: string } } }[]>(
    `repos/${repo}/commits?path=${encodeURIComponent(path)}&per_page=1`,
  )
  return { sha: head.sha, date: head.commit.committer.date.slice(0, 10) }
}

export async function fetchRaw(repo: string, commit: string, path: string): Promise<string> {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/${commit}/${path}`)
  if (!res.ok) throw new Error(`GET ${path}@${commit} → ${res.status}`)
  return res.text()
}

/** Rewrites the recorded hashes from what is on disk. */
export function writeRecordedHashes(manifest: Manifest): void {
  for (const d of manifest.datasets) {
    if (d.vendored) d.vendored.sha256 = sha256(readFileSync(join(ROOT, d.vendored.path)))
  }
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`)
}

/** `differs` is false when upstream moved but nothing we ship would. */
export async function describeUpstreamChange(
  d: Dataset,
  headSha: string,
): Promise<{ differs: boolean; summary: string }> {
  if (d.source.kind !== 'github') return { differs: false, summary: 'not a git source' }

  if (d.generates.includes('src/engine/airport-data.generated.ts')) {
    const text = await fetchRaw(d.source.repo, headSha, d.source.path)
    const tmp = join(ROOT, 'node_modules', '.vendor-upstream.dat')
    writeFileSync(tmp, text)
    const differs = generateAirportData(tmp).text !== readFileSync(AIRPORT_OUTPUT, 'utf8')
    return {
      differs,
      summary: differs ? 'generated output differs' : 'generated output is unchanged',
    }
  }

  // Unknown shape: reported rather than assumed harmless.
  return { differs: true, summary: 'no content comparison defined' }
}

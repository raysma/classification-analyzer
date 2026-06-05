// Regenerate src/data/uspsa-hhfs.json (and the iOS copy) from USPSA's official
// HHF CSV. Admin-only maintenance tool — not part of the app build.
//
//   pnpm refresh:hhf            # fetch the CSV directly from uspsa.org
//   pnpm refresh:hhf ./hhf.csv  # transform a CSV already on disk (fallback)
//
// The fetch path only works where uspsa.org is reachable (allowlisted) and not
// bot-blocked; on any failure it tells you to download the CSV and pass a path.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildHhfTable, type HhfTable } from './lib/buildHhfTable.ts'

const HHF_CSV_URL = 'https://uspsa.org/api/scoring/hhf/uspsa/csv'
const FETCH_TIMEOUT_MS = 30_000
const MIN_CODES_PER_DIVISION = 50
const EXPECTED_DIVISIONS = 9

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PRIMARY_TARGET = resolve(ROOT, 'src/data/uspsa-hhfs.json')
const IOS_TARGET = resolve(
  ROOT,
  'ios/Packages/USPSARules/Sources/USPSARules/Resources/uspsa-hhfs.json',
)
const TARGETS = [PRIMARY_TARGET, IOS_TARGET]

async function loadCsv(pathArg: string | undefined): Promise<string> {
  if (pathArg) {
    return readFileSync(pathArg, 'utf8')
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(HHF_CSV_URL, {
      signal: controller.signal,
      headers: { Accept: 'text/csv,*/*' },
    })
    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 120)
      throw new Error(`HTTP ${res.status}${body ? ` (${body})` : ''}`)
    }
    return await res.text()
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    fail(
      `couldn't fetch ${HHF_CSV_URL}: ${reason}\n` +
        `download the CSV in your browser and re-run: pnpm refresh:hhf <path-to-csv>`,
    )
  } finally {
    clearTimeout(timer)
  }
}

function fail(message: string): never {
  console.error(`refresh:hhf: ${message}`)
  process.exit(1)
}

function summarize(next: HhfTable, baseline: HhfTable): { changed: number } {
  const divisions = new Set([...Object.keys(next), ...Object.keys(baseline)])
  let changed = 0
  for (const div of [...divisions].sort()) {
    const a: Record<string, number> = baseline[div] ?? {}
    const b: Record<string, number> = next[div] ?? {}
    const added = Object.keys(b).filter((c) => !(c in a))
    const removed = Object.keys(a).filter((c) => !(c in b))
    const moved = Object.keys(b).filter((c) => c in a && a[c] !== b[c])
    changed += added.length + removed.length + moved.length
    const notes: string[] = []
    if (added.length) notes.push(`+${added.length} (${added.join(', ')})`)
    if (removed.length) notes.push(`-${removed.length} (${removed.join(', ')})`)
    if (moved.length) notes.push(`~${moved.length} (${moved.join(', ')})`)
    console.log(
      `  ${div.padEnd(5)} ${Object.keys(b).length} codes${notes.length ? ` | ${notes.join('  ')}` : ''}`,
    )
  }
  return { changed }
}

async function main(): Promise<void> {
  const pathArg = process.argv[2]
  const csv = await loadCsv(pathArg)
  const { table, snapshotDate, warnings } = buildHhfTable(csv)

  console.log(`snapshot: ${snapshotDate}  (source: ${pathArg ?? HHF_CSV_URL})`)
  for (const w of warnings) console.warn(`  warning: ${w}`)

  // Sanity gate: refuse to clobber good data with an implausible parse.
  const divisions = Object.keys(table)
  if (divisions.length !== EXPECTED_DIVISIONS) {
    fail(`parsed ${divisions.length} divisions, expected ${EXPECTED_DIVISIONS} — refusing to write`)
  }
  for (const div of divisions) {
    const n = Object.keys(table[div] ?? {}).length
    if (n < MIN_CODES_PER_DIVISION) {
      fail(`division ${div} has only ${n} codes (< ${MIN_CODES_PER_DIVISION}) — refusing to write`)
    }
  }

  const baseline = JSON.parse(readFileSync(PRIMARY_TARGET, 'utf8')) as HhfTable
  const { changed } = summarize(table, baseline)

  const json = JSON.stringify(table, null, 2) + '\n'
  for (const target of TARGETS) writeFileSync(target, json)

  const codes = Object.values(table).reduce((sum, d) => sum + Object.keys(d).length, 0)
  console.log(
    `wrote ${divisions.length} divisions / ${codes} codes; ${changed} changed cells -> ${TARGETS.length} files`,
  )
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)))

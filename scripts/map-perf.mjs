/**
 * Map interaction cost, measured rather than felt.
 *
 * Drives the production build in Chromium and, for each interaction, reports
 * how long the main thread stayed busy afterwards and every long task it spent
 * the time in. Deferred work counts: the window closes on five consecutive
 * quiet frames, not on the second animation frame, so pushing a re-layout into
 * a later task shows up here rather than hiding from the measurement.
 *
 *   npm i --no-save playwright && npx playwright install chromium
 *   npm run build && npm run perf:map
 *
 * Playwright is deliberately not a dependency — it is a local measuring tool,
 * and CI has no use for it or for the browser it downloads.
 */
import { spawn } from 'node:child_process'

const { chromium } = await import('playwright').catch(() => {
  console.error(
    'playwright is not installed. It is not a dependency of this repo:\n' +
      '  npm i --no-save playwright && npx playwright install chromium'
  )
  process.exit(1)
})

const PORT = process.env.PERF_PORT ?? '4183'
const BASE = process.env.PERF_BASE_URL ?? `http://localhost:${PORT}`
const QUERY = '/?view=map&q=3pm%20new%20york%20to%20london'

/** Runs in the page: long tasks and frame times since the last `mark()`. */
const PROBE = `
window.__perf = { tasks: [], t0: 0 }
new PerformanceObserver((list) => {
  for (const e of list.getEntries()) window.__perf.tasks.push({ start: e.startTime, dur: e.duration })
}).observe({ entryTypes: ['longtask'] })
window.__perfMark = () => { window.__perf.tasks.length = 0; window.__perf.t0 = performance.now() }
window.__perfSettle = () => new Promise((resolve) => {
  const QUIET_FRAMES = 5
  const QUIET_MS = 20
  const DEADLINE = 12000
  const frames = []
  let quiet = 0
  let last = performance.now()
  let firstQuiet = 0
  const step = () => {
    const now = performance.now()
    const frame = now - last
    last = now
    frames.push(frame)
    if (frame < QUIET_MS) {
      if (quiet === 0) firstQuiet = now
      quiet++
    } else {
      quiet = 0
    }
    if (quiet >= QUIET_FRAMES || now - window.__perf.t0 > DEADLINE) {
      const t0 = window.__perf.t0
      const tasks = window.__perf.tasks.filter((t) => t.start + t.dur > t0)
      const during = frames.slice(0, Math.max(0, frames.length - QUIET_FRAMES)).sort((a, b) => b - a)
      resolve({
        settle: Math.round((quiet >= QUIET_FRAMES ? firstQuiet : now) - t0),
        tasks: tasks.map((t) => Math.round(t.dur)).filter((d) => d >= 50),
        busy: Math.round(tasks.reduce((sum, t) => sum + t.dur, 0)),
        worstFrame: Math.round(during[0] ?? 0),
        medianFrame: Math.round(during[Math.floor(during.length / 2)] ?? 0),
        slowFrames: during.filter((f) => f >= QUIET_MS).length,
      })
      return
    }
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
})
`

async function serve() {
  const child = spawn('npx', ['vite', 'preview', '--port', PORT, '--strictPort'], {
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  const deadline = Date.now() + 20000
  for (;;) {
    try {
      const res = await fetch(BASE + '/')
      if (res.ok) return child
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      child.kill()
      throw new Error(`vite preview did not come up on port ${PORT}`)
    }
    await new Promise((r) => setTimeout(r, 250))
  }
}

async function measure(page, name, action) {
  await page.evaluate('window.__perfMark()')
  await action()
  const r = await page.evaluate('window.__perfSettle()')
  results.push({ name, ...r })
  const tasks = r.tasks.length ? r.tasks.join(', ') : '—'
  console.log(
    `${name.padEnd(22)} ${String(r.settle).padStart(6)} ${String(r.busy).padStart(6)} ` +
      `${String(r.worstFrame).padStart(6)} ${String(r.medianFrame).padStart(7)} ${String(r.slowFrames).padStart(6)}  ${tasks}`
  )
}

const results = []

async function openLayers(page) {
  const panel = page.locator('[role="group"][aria-label="Cities"]')
  if (!(await panel.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Map layers' }).click()
    await panel.waitFor()
  }
}

async function setDensity(page, layer, step) {
  await openLayers(page)
  await page.locator(`[role="group"][aria-label="${layer}"]`).getByText(step, { exact: true }).click()
}

async function wheel(page, dy, ticks) {
  for (let i = 0; i < ticks; i++) {
    await page.mouse.wheel(0, dy)
    await page.waitForTimeout(16)
  }
}

async function drag(page) {
  await page.mouse.move(700, 450)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(700 - i * 25, 450 + i * 8)
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
}

async function main() {
  const server = process.env.PERF_BASE_URL ? null : await serve()
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.addInitScript(PROBE)
  await page.goto(BASE + QUERY, { waitUntil: 'networkidle' })
  await page.waitForSelector('svg')
  await page.waitForTimeout(1500)

  console.log(
    `\n${'interaction'.padEnd(22)} ${'settle'.padStart(6)} ${'busy'.padStart(6)} ${'worst'.padStart(6)} ${'median'.padStart(7)} ${'slow'.padStart(6)}  long tasks`
  )
  console.log('-'.repeat(86))

  await page.mouse.move(700, 450)
  await page.waitForTimeout(300)

  // Resting state first: grid, cities and labels on Auto — what a first visit gets.
  await measure(page, 'Wheel zoom, 5 in', () => wheel(page, -120, 5))
  await measure(page, 'Drag pan', () => drag(page))
  await measure(page, 'Wheel zoom, 5 out', () => wheel(page, 120, 5))

  await measure(page, 'Grid off', async () => {
    await openLayers(page)
    await page.getByText('Grid', { exact: true }).click()
  })
  await measure(page, 'Borders on', () => page.getByText('Borders', { exact: true }).click())
  await measure(page, 'Timezones on', () => page.getByText('Timezones', { exact: true }).click())
  await page.keyboard.press('Escape')
  await page.mouse.move(700, 450)
  await page.waitForTimeout(300)
  await measure(page, 'Zoom, timezones', () => wheel(page, -120, 5))
  await wheel(page, 120, 5)
  await page.waitForTimeout(500)

  await measure(page, 'Cities → All', () => setDensity(page, 'Cities', 'All'))
  await measure(page, 'Airports → All', () => setDensity(page, 'Airports', 'All'))
  await page.keyboard.press('Escape')
  await page.mouse.move(700, 450)
  await page.waitForTimeout(300)
  await measure(page, 'Zoom, everything', () => wheel(page, -120, 5))
  await measure(page, 'Pan, everything', () => drag(page))
  await wheel(page, 120, 5)
  await page.waitForTimeout(500)

  await measure(page, 'Cities → Auto', () => setDensity(page, 'Cities', 'Auto'))
  await measure(page, 'Airports → None', () => setDensity(page, 'Airports', 'None'))
  await measure(page, 'Type three chars', async () => {
    await page.keyboard.press('Escape')
    await page.locator('input[type="text"], input:not([type])').first().click()
    await page.keyboard.type('ber', { delay: 30 })
  })

  await browser.close()
  server?.kill()

  if (process.env.PERF_JSON) {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(process.env.PERF_JSON, JSON.stringify(results, null, 2))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

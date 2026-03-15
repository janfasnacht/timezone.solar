import { parseLandingPath } from './src/engine/landing-routes'
import { getEntityBySlug } from './src/engine/city-entities'

const CRAWLERS = /Slackbot|Twitterbot|facebookexternalhit|LinkedInBot|WhatsApp|Discordbot|TelegramBot|Applebot/i

export default function middleware(request: Request) {
  const url = new URL(request.url)
  const ua = request.headers.get('user-agent') ?? ''

  if (!CRAWLERS.test(ua)) return

  // Check for landing page path (e.g. /new-york-to-london)
  const landing = parseLandingPath(url.pathname)
  if (landing) {
    const fromEntity = getEntityBySlug(landing.fromSlug)!
    const toEntity = getEntityBySlug(landing.toSlug)!
    const title = `${fromEntity.displayName} to ${toEntity.displayName} Time — timezone.solar`
    const description = `What time is it in ${toEntity.displayName} when it's 3pm in ${fromEntity.displayName}? Instant conversion with live world map and shareable cards. DST-aware.`
    const ogImageUrl = `${url.origin}/api/og?from=${encodeURIComponent(fromEntity.iana)}&to=${encodeURIComponent(toEntity.iana)}`
    const canonicalUrl = `${url.origin}/${landing.fromSlug}-to-${landing.toSlug}`

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeAttr(description)}" />
  <link rel="canonical" href="${escapeAttr(canonicalUrl)}" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}" />
  <meta property="og:image" content="${escapeAttr(ogImageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="${escapeAttr(description)}" />
  <meta name="twitter:image" content="${escapeAttr(ogImageUrl)}" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "${escapeJson(title)}",
    "description": "${escapeJson(description)}",
    "url": "${escapeJson(canonicalUrl)}"
  }
  </script>
</head>
<body></body>
</html>`

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // Support both canonical params and legacy ?q= form
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const t = url.searchParams.get('t')
  const q = url.searchParams.get('q')

  const isCanonical = from && to && t

  if (!isCanonical && !q) return

  let ogImageUrl: string
  let title: string
  let canonicalUrl: string

  if (isCanonical) {
    const fromCity = from.split('/').pop()?.replace(/_/g, ' ') ?? from
    const toCity = to.split('/').pop()?.replace(/_/g, ' ') ?? to
    title = `${fromCity} to ${toCity} at ${t} — timezone.solar`
    ogImageUrl = `${url.origin}/api/og?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&t=${encodeURIComponent(t)}`
    const d = url.searchParams.get('d')
    if (d) ogImageUrl += `&d=${encodeURIComponent(d)}`
    canonicalUrl = url.href
  } else {
    title = `${q} — timezone.solar`
    ogImageUrl = `${url.origin}/api/og?q=${encodeURIComponent(q!)}`
    canonicalUrl = url.href
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="Natural language timezone converter with live world map and shareable cards." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}" />
  <meta property="og:image" content="${escapeAttr(ogImageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="Natural language timezone converter with live world map and shareable cards." />
  <meta name="twitter:image" content="${escapeAttr(ogImageUrl)}" />
</head>
<body></body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function escapeJson(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
}

export const config = {
  matcher: ['/((?!api|assets|icons|favicon|manifest|robots|sitemap).*)'],
}

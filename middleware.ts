const CRAWLERS = /Slackbot|Twitterbot|facebookexternalhit|LinkedInBot|WhatsApp|Discordbot|TelegramBot|Applebot/i

export default function middleware(request: Request) {
  const url = new URL(request.url)
  const ua = request.headers.get('user-agent') ?? ''

  if (!CRAWLERS.test(ua)) return

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
  <meta property="og:description" content="Convert times between cities instantly." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeAttr(canonicalUrl)}" />
  <meta property="og:image" content="${escapeAttr(ogImageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="Convert times between cities instantly." />
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

export const config = { matcher: ['/'] }

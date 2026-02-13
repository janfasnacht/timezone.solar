const CRAWLERS = /Slackbot|Twitterbot|facebookexternalhit|LinkedInBot|WhatsApp|Discordbot|TelegramBot|Applebot/i

export default function middleware(request: Request) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q')
  const ua = request.headers.get('user-agent') ?? ''

  if (!q || !CRAWLERS.test(ua)) return

  const ogImageUrl = `${url.origin}/api/og?q=${encodeURIComponent(q)}`
  const title = `${q} — timezone.solar`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="Convert times between cities instantly." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeAttr(url.href)}" />
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

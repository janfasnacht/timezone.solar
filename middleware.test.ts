import { describe, it, expect } from 'vitest'
import middleware, { escapeHtml, escapeAttr } from './middleware'

function makeRequest(url: string, ua?: string): Request {
  return new Request(url, {
    headers: ua ? { 'user-agent': ua } : {},
  })
}

describe('middleware — crawler detection', () => {
  const crawlers = [
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'Twitterbot/1.0',
    'facebookexternalhit/1.1',
    'LinkedInBot/1.0',
    'WhatsApp/2.23',
    'Discordbot/2.0',
    'TelegramBot (like TwitterBot)',
    'Applebot/0.1',
  ]

  for (const ua of crawlers) {
    const name = ua.split(/[/\s]/)[0]
    it(`returns OG HTML for ${name}`, () => {
      const res = middleware(makeRequest('https://timezone.solar/?q=3pm+NYC+to+London', ua))
      expect(res).toBeInstanceOf(Response)
      expect(res!.headers.get('content-type')).toBe('text/html; charset=utf-8')
    })
  }

  it('returns undefined for Chrome browser UA', () => {
    const res = middleware(
      makeRequest(
        'https://timezone.solar/?q=3pm+NYC+to+London',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0',
      ),
    )
    expect(res).toBeUndefined()
  })

  it('returns undefined for empty UA', () => {
    const res = middleware(makeRequest('https://timezone.solar/?q=3pm+NYC+to+London'))
    expect(res).toBeUndefined()
  })

  it('returns undefined for crawler without ?q=', () => {
    const res = middleware(makeRequest('https://timezone.solar/', 'Slackbot'))
    expect(res).toBeUndefined()
  })

  it('returns undefined for crawler with empty q=', () => {
    const res = middleware(makeRequest('https://timezone.solar/?q=', 'Slackbot'))
    expect(res).toBeUndefined()
  })
})

describe('middleware — OG meta tags', () => {
  async function getHtml(query: string): Promise<string> {
    const res = middleware(makeRequest(`https://timezone.solar/?q=${encodeURIComponent(query)}`, 'Slackbot'))
    return res!.text()
  }

  it('og:title contains the query', async () => {
    const html = await getHtml('3pm NYC to London')
    expect(html).toContain('og:title')
    expect(html).toContain('3pm NYC to London')
  })

  it('og:image points to /api/og', async () => {
    const html = await getHtml('3pm NYC to London')
    expect(html).toMatch(/og:image.*\/api\/og\?q=/)
  })

  it('twitter:card is summary_large_image', async () => {
    const html = await getHtml('3pm NYC to London')
    expect(html).toContain('summary_large_image')
  })

  it('content-type is text/html', () => {
    const res = middleware(makeRequest('https://timezone.solar/?q=Tokyo', 'Twitterbot'))
    expect(res!.headers.get('content-type')).toBe('text/html; charset=utf-8')
  })
})

describe('middleware — XSS sanitization', () => {
  it('escapes HTML special characters in title', async () => {
    const res = middleware(
      makeRequest('https://timezone.solar/?q=' + encodeURIComponent('<script>"&'), 'Slackbot'),
    )
    const html = await res!.text()
    expect(html).not.toContain('<script>"&')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
  })

  it('escapes quotes in meta attributes', async () => {
    const res = middleware(
      makeRequest('https://timezone.solar/?q=' + encodeURIComponent('test"onload=alert(1)'), 'Slackbot'),
    )
    const html = await res!.text()
    // Attribute values must escape quotes — check og:title content attribute
    expect(html).toMatch(/content="test&quot;onload=alert\(1\)/)
    expect(html).toContain('&quot;')
  })
})

describe('escapeHtml', () => {
  it('escapes &, <, >', () => {
    expect(escapeHtml('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d')
  })

  it('passes through clean strings', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

describe('escapeAttr', () => {
  it('escapes &, ", <, >', () => {
    expect(escapeAttr('a & "b" <c>')).toBe('a &amp; &quot;b&quot; &lt;c&gt;')
  })

  it('passes through clean strings', () => {
    expect(escapeAttr('hello world')).toBe('hello world')
  })
})

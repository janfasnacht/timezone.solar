import { useState, useCallback, useMemo } from 'react'
import { Copy, Link, Download, Share2, Check } from 'lucide-react'
import { getSvgCitiesSlug } from '@/engine/city-entities'
import { compactTime, formatDate } from '@/lib/shareUtils'
import type { ConversionResult } from '@/engine/types'

interface CardBackProps {
  result: ConversionResult
  query: string
  use24h: boolean
}

function CityIcon({ slug, size = '1.2rem' }: { slug: string; size?: string }) {
  return (
    <div
      className="flex-shrink-0"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        maskImage: `url(/icons/${slug}.svg)`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskImage: `url(/icons/${slug}.svg)`,
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        backgroundColor: 'var(--color-city-icon)',
      }}
    />
  )
}

export function CardBack({ result, query, use24h }: CardBackProps) {
  const [timeCopied, setTimeCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const timeKey = use24h ? 'formattedTime24' : 'formattedTime12'
  const { source, target, dayBoundary } = result

  const copyTimeText = `${target[timeKey]} ${target.abbreviation}`
  const shareUrl = `https://timezone.solar?q=${encodeURIComponent(query)}`
  const ogImageUrl = `/api/og?q=${encodeURIComponent(query)}&src=${encodeURIComponent(source.iana)}${use24h ? '&fmt=24h' : ''}`

  const canShare = typeof navigator !== 'undefined'
    && 'share' in navigator
    && 'maxTouchPoints' in navigator
    && navigator.maxTouchPoints > 0

  const filename = useMemo(() => {
    const sTime = compactTime(source[timeKey], use24h)
    const tTime = compactTime(target[timeKey], use24h)
    const needsDate = dayBoundary !== 'same day'
    const sAbbr = source.abbreviation.replace(/:/g, '')
    const tAbbr = target.abbreviation.replace(/:/g, '')
    const s = `${source.city} ${sTime} ${sAbbr}${needsDate ? ' ' + formatDate(result.sourceDateTime) : ''}`
    const t = `${target.city} ${tTime} ${tAbbr}${needsDate ? ' ' + formatDate(result.targetDateTime) : ''}`
    return `${s} to ${t}.png`
  }, [source, target, timeKey, use24h, dayBoundary, result.sourceDateTime, result.targetDateTime])

  const fetchOgImage = useCallback(async (): Promise<Blob | null> => {
    const res = await fetch(ogImageUrl)
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) return null
    return res.blob()
  }, [ogImageUrl])

  const handleCopyTime = useCallback(() => {
    navigator.clipboard.writeText(copyTimeText).then(() => {
      setTimeCopied(true)
      setTimeout(() => setTimeCopied(false), 2000)
    })
  }, [copyTimeText])

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }, [shareUrl])

  const handleDownload = useCallback(async () => {
    if (downloading) return
    setDownloading(true)
    try {
      const blob = await fetchOgImage()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = filename
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }, [fetchOgImage, filename, downloading])

  const handleShare = useCallback(async () => {
    try {
      const blob = await fetchOgImage()
      if (!blob) return
      const file = new File([blob], filename, { type: 'image/png' })
      await navigator.share({ files: [file], title: 'timezone.solar', url: shareUrl })
    } catch {
      // User cancelled or not supported
    }
  }, [fetchOgImage, filename, shareUrl])

  const sourceIconSlug = source.entitySlug ? getSvgCitiesSlug(source.entitySlug) : null
  const targetIconSlug = target.entitySlug ? getSvgCitiesSlug(target.entitySlug) : null

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      {/* Top accent gradient — matches front card */}
      <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-surface via-accent-soft to-surface" />

      <div className="flex flex-1 flex-col justify-center px-[1.5rem]">
        {/* Conversion summary — single compact row */}
        <div className="flex items-center justify-center gap-2">
          {sourceIconSlug && <CityIcon slug={sourceIconSlug} />}
          <span className="font-mono text-[0.75rem] text-foreground">{source.city}</span>
          <span className="font-mono text-[0.65rem] text-muted-foreground">{source[timeKey]}</span>
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-muted-foreground">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
          {targetIconSlug && <CityIcon slug={targetIconSlug} />}
          <span className="font-mono text-[0.75rem] text-foreground">{target.city}</span>
          <span className="font-mono text-[0.65rem] text-muted-foreground">{target[timeKey]}</span>
        </div>

        {/* Divider */}
        <div className="my-[1rem] h-px bg-gradient-to-r from-surface via-border to-surface" />

        {/* Actions */}
        <div className="flex flex-col gap-2">
          {/* Copy Time */}
          <button onClick={handleCopyTime} className="group flex items-center gap-3 text-left transition-colors">
            <span className="flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">
              {timeCopied ? <Check size={14} /> : <Copy size={14} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.65rem] text-muted-foreground">
                {timeCopied ? 'Copied!' : 'Copy time'}
              </span>
              <span className="block truncate font-mono text-[0.75rem] text-foreground">
                {copyTimeText}
              </span>
            </span>
          </button>

          <div className="h-px bg-gradient-to-r from-surface via-border to-surface" />

          {/* Copy Link */}
          <button onClick={handleCopyLink} className="group flex items-center gap-3 text-left transition-colors">
            <span className="flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">
              {linkCopied ? <Check size={14} /> : <Link size={14} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.65rem] text-muted-foreground">
                {linkCopied ? 'Copied!' : 'Copy link'}
              </span>
              <span className="block truncate font-mono text-[0.75rem] text-foreground">
                timezone.solar?q={query}
              </span>
            </span>
          </button>

          <div className="h-px bg-gradient-to-r from-surface via-border to-surface" />

          {/* Share (mobile) or Download (desktop) */}
          {canShare ? (
            <button onClick={handleShare} className="group flex items-center gap-3 text-left transition-colors">
              <span className="flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">
                <Share2 size={14} />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.65rem] text-muted-foreground">Share</span>
                <span className="block truncate font-mono text-[0.75rem] text-foreground">
                  Card image + link
                </span>
              </span>
            </button>
          ) : (
            <button onClick={handleDownload} disabled={downloading} className="group flex items-center gap-3 text-left transition-colors">
              <span className="flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">
                <Download size={14} />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.65rem] text-muted-foreground">
                  {downloading ? 'Saving...' : 'Download'}
                </span>
                <span className="block truncate font-mono text-[0.75rem] text-foreground">
                  Card image (.png)
                </span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState, useCallback, useMemo } from 'react'
import { Copy, Link, Download, Share2, Check } from 'lucide-react'
import { getSvgCitiesSlug, getVibes } from '@/engine/city-entities'
import { compactTime, formatDate } from '@/lib/shareUtils'
import type { ConversionResult } from '@/engine/types'

interface CardBackProps {
  result: ConversionResult
  query: string
  use24h: boolean
  onFlip: () => void
}

export function CardBack({ result, query, use24h, onFlip }: CardBackProps) {
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

  const targetIconSlug = target.entitySlug ? getSvgCitiesSlug(target.entitySlug) : null
  const vibes = target.entitySlug ? getVibes(target.entitySlug) : null

  return (
    <div className="relative h-full overflow-y-auto rounded-2xl border border-border bg-surface">
      {/* Top accent gradient — same as front */}
      <div className="absolute top-0 right-0 left-0 h-px bg-gradient-to-r from-surface via-accent-soft to-surface" />

      <div className="flex h-full flex-col items-center justify-center p-[1.5rem]">
        {/* City icon + vibes header */}
        {(targetIconSlug || vibes) && (
          <div className="mb-3 flex flex-col items-center gap-1.5">
            {targetIconSlug && (
              <div
                className="h-[2.5rem] w-[2.5rem]"
                aria-hidden="true"
                style={{
                  maskImage: `url(/icons/${targetIconSlug}.svg)`,
                  maskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  WebkitMaskImage: `url(/icons/${targetIconSlug}.svg)`,
                  WebkitMaskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  backgroundColor: 'var(--color-city-icon)',
                }}
              />
            )}
            {vibes && (
              <p className="font-mono text-[0.65rem] text-muted-foreground">
                {vibes.join(' · ')}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex w-full flex-col gap-2">
          {/* Copy Time */}
          <button onClick={handleCopyTime} className="group flex items-center gap-3 text-left transition-colors">
            <span className="flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">
              {timeCopied ? <Check size={15} /> : <Copy size={15} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.7rem] text-muted-foreground">
                {timeCopied ? 'Copied!' : `Copy time (${target.city})`}
              </span>
              <span className="block truncate font-mono text-[0.8rem] text-foreground">
                {copyTimeText}
              </span>
            </span>
          </button>

          <div className="h-px bg-gradient-to-r from-surface via-border to-surface" />

          {/* Copy Link */}
          <button onClick={handleCopyLink} className="group flex items-center gap-3 text-left transition-colors">
            <span className="flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">
              {linkCopied ? <Check size={15} /> : <Link size={15} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[0.7rem] text-muted-foreground">
                {linkCopied ? 'Copied!' : 'Copy link'}
              </span>
              <span className="block truncate font-mono text-[0.8rem] text-foreground">
                ?q={query}
              </span>
            </span>
          </button>

          <div className="h-px bg-gradient-to-r from-surface via-border to-surface" />

          {/* Share (mobile) or Download (desktop) */}
          {canShare ? (
            <button onClick={handleShare} className="group flex items-center gap-3 text-left transition-colors">
              <span className="flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">
                <Share2 size={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.7rem] text-muted-foreground">Share</span>
                <span className="block truncate font-mono text-[0.8rem] text-foreground">
                  Card image + link
                </span>
              </span>
            </button>
          ) : (
            <button onClick={handleDownload} disabled={downloading} className="group flex items-center gap-3 text-left transition-colors">
              <span className="flex-shrink-0 text-muted-foreground transition-colors group-hover:text-foreground">
                <Download size={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-[0.7rem] text-muted-foreground">
                  {downloading ? 'Saving...' : 'Download'}
                </span>
                <span className="block truncate font-mono text-[0.8rem] text-foreground">
                  Card image (.png)
                </span>
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Dog-ear flip trigger — back to front */}
      <button
        onClick={onFlip}
        className="absolute right-0 bottom-0 h-6 w-6 cursor-pointer transition-colors [clip-path:polygon(100%_0,100%_100%,0_100%)] bg-border hover:bg-muted-foreground/40"
        aria-label="Back to result"
      />
    </div>
  )
}

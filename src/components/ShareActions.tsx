import { useState, useCallback, useMemo } from 'react'
import { Copy, Link, Download, Share2, Check } from 'lucide-react'
import type { ConversionResult } from '@/engine/types'
import { compactTime, formatDate } from '@/lib/shareUtils'
import { buildCanonicalUrl, buildOgImageUrl } from '@/lib/canonicalUrl'

interface ShareActionsProps {
  result: ConversionResult
  query: string
  use24h: boolean
}

export function ShareActions({ result, query, use24h }: ShareActionsProps) {
  const [timeCopied, setTimeCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const timeKey = use24h ? 'formattedTime24' : 'formattedTime12'
  const { source, target, dayBoundary } = result

  const copyTimeText = `${target[timeKey]} ${target.abbreviation}`

  const shareUrl = buildCanonicalUrl(result, query)
  const ogImageUrl = buildOgImageUrl(result, query, use24h)

  // Only show native share on touch devices (mobile) — desktop share dialogs are awkward
  const canShare = typeof navigator !== 'undefined'
    && 'share' in navigator
    && 'maxTouchPoints' in navigator
    && navigator.maxTouchPoints > 0

  const filename = useMemo(() => {
    const sTime = compactTime(source[timeKey], use24h)
    const tTime = compactTime(target[timeKey], use24h)
    const needsDate = dayBoundary !== 'same day'
    // Sanitize tz abbreviations — colons (GMT+5:30) are invalid in filenames
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

  const buttonClass =
    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground hover:bg-surface'

  return (
    <div className="mt-3 flex items-center justify-center gap-1">
      <button onClick={handleCopyTime} className={buttonClass}>
        {timeCopied ? <Check size={14} /> : <Copy size={14} />}
        {timeCopied ? 'Copied' : 'Copy Time'}
      </button>
      <button onClick={handleCopyLink} className={buttonClass}>
        {linkCopied ? <Check size={14} /> : <Link size={14} />}
        {linkCopied ? 'Copied' : 'Copy Link'}
      </button>
      <button onClick={handleDownload} disabled={downloading} className={buttonClass}>
        <Download size={14} />
        {downloading ? 'Saving...' : 'Download'}
      </button>
      {canShare && (
        <button onClick={handleShare} className={buttonClass}>
          <Share2 size={14} />
          Share
        </button>
      )}
    </div>
  )
}

import { useState, useCallback, useMemo } from 'react'
import { Copy, Link, Share2, Check, CalendarPlus, CalendarDays } from 'lucide-react'
import { Popover } from '@/components/ui/Popover'
import { MenuAction, MenuDivider } from '@/components/ui/MenuControls'
import { conversionText } from '@/lib/shareUtils'
import { buildCanonicalUrl, formatCanonicalDisplay } from '@/lib/canonicalUrl'
import { buildIcs, buildGoogleCalendarUrl, calendarFilename } from '@/lib/calendar'
import type { ConversionResult } from '@/engine/types'

interface ShareMenuProps {
  result: ConversionResult
  query: string
  use24h: boolean
}

/**
 * Ordered by what people do with a converted time: paste it, then send the link.
 * Calendar sits below the divider as a destination rather than sharing.
 */
export function ShareMenu({ result, query, use24h }: ShareMenuProps) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const [timeCopied, setTimeCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const copyText = conversionText(result, use24h)
  const shareUrl = buildCanonicalUrl(result, query)
  const linkDisplay = formatCanonicalDisplay(result, query)

  const handleCopyText = useCallback(() => {
    navigator.clipboard.writeText(copyText).then(() => {
      setTimeCopied(true)
      setTimeout(() => setTimeCopied(false), 2000)
    })
  }, [copyText])

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    })
  }, [shareUrl])

  const googleCalendarUrl = useMemo(
    () => buildGoogleCalendarUrl(result, use24h, shareUrl),
    [result, use24h, shareUrl],
  )

  const handleDownloadIcs = useCallback(() => {
    const ics = buildIcs(result, use24h, shareUrl)
    if (!ics) return
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `${calendarFilename(result).replace(/[/\\]/g, '-')}.ics`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }, [result, use24h, shareUrl])

  // Two lines, source above target, as the result card reads. One line truncates.
  const [copySource, copyTarget] = copyText.split(' \u2192 ')

  return (
    <Popover
      open={open}
      onClose={close}
      anchor="bottom-right"
      trigger={
        <button
          onClick={() => setOpen((v) => !v)}
          className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border bg-surface/60 backdrop-blur-sm transition-colors ${
            open ? 'border-accent/40 text-accent' : 'border-border text-muted-foreground hover:text-foreground'
          }`}
          aria-label="Share"
          aria-expanded={open}
        >
          <Share2 className="h-4 w-4" />
        </button>
      }
    >
      <div className="flex flex-col">
        <MenuAction
          icon={timeCopied ? <Check size={14} /> : <Copy size={14} />}
          label={
            <span className="block leading-snug">
              <span className="block truncate font-mono">{copySource}</span>
              <span className="block truncate font-mono">{copyTarget}</span>
            </span>
          }
          hint={timeCopied ? 'Copied' : undefined}
          title={copyText}
          onClick={handleCopyText}
        />
        <MenuAction
          icon={linkCopied ? <Check size={14} /> : <Link size={14} />}
          label={<span className="font-mono">{linkDisplay}</span>}
          hint={linkCopied ? 'Copied' : undefined}
          title={shareUrl}
          onClick={handleCopyLink}
        />

        <MenuDivider />

        <MenuAction
          icon={<CalendarPlus size={14} />}
          label="Add to calendar"
          hint=".ics"
          onClick={handleDownloadIcs}
        />
        {googleCalendarUrl && (
          <MenuAction
            icon={<CalendarDays size={14} />}
            label="Google Calendar"
            hint="↗"
            href={googleCalendarUrl}
          />
        )}
      </div>
    </Popover>
  )
}

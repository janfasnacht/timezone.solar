/** @jsxImportSource react */
import { ImageResponse } from '@vercel/og'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from '../src/engine/parser'
import { resolveLocation } from '../src/engine/resolver'
import { convert } from '../src/engine/converter'
import type { ConversionResult, ConversionIntent } from '../src/engine/types'

export const config = { runtime: 'nodejs', maxDuration: 10 }

const fraunces = readFileSync(join(process.cwd(), 'api/fonts/Fraunces-SemiBold.woff'))
const instrumentSans = readFileSync(join(process.cwd(), 'api/fonts/InstrumentSans-Regular.woff'))
const instrumentSansSB = readFileSync(join(process.cwd(), 'api/fonts/InstrumentSans-SemiBold.woff'))

export function runConversion(q: string, srcIana?: string): ConversionResult | null {
  const parsed = parse(q)
  if (!parsed) return null

  const target = resolveLocation(parsed.targetLocation)
  if (!target) return null

  let source = parsed.sourceLocation ? resolveLocation(parsed.sourceLocation) : null
  // Fallback: use provided source IANA (from client), or UTC
  if (!source && srcIana) {
    // Try to resolve city info from the IANA timezone
    const city = srcIana.split('/').pop()?.replace(/_/g, ' ') ?? srcIana
    const resolved = resolveLocation(city)
    if (resolved && resolved.primary.iana === srcIana) {
      source = resolved
    } else {
      source = { primary: { iana: srcIana, displayName: city, kind: 'city', resolveMethod: 'alias' as const }, alternatives: [] }
    }
  }
  if (!source) {
    source = { primary: { iana: 'UTC', displayName: 'UTC', kind: 'timezone', resolveMethod: 'abbreviation' as const }, alternatives: [] }
  }

  const intent: ConversionIntent = {
    source: source.primary,
    target: target.primary,
    time: parsed.time,
    dateModifier: parsed.dateModifier,
  }
  return convert(intent)
}

function BrandedCard() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: '#110f0c',
        padding: '60px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: '#f4a636',
          }}
        />
        <span
          style={{
            fontFamily: 'Fraunces',
            fontSize: '48px',
            color: '#f4a636',
          }}
        >
          timezone.solar
        </span>
      </div>
      <span
        style={{
          fontFamily: 'Instrument Sans',
          fontSize: '28px',
          color: '#8a7f6f',
        }}
      >
        Convert times between cities instantly
      </span>
    </div>
  )
}

function ResultCard({ result, use24h }: { result: ConversionResult; use24h: boolean }) {
  const { source, target, offsetDifference, dayBoundary } = result
  const timeKey = use24h ? 'formattedTime24' : 'formattedTime12'
  const isNotSameDay = dayBoundary !== 'same day'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        backgroundColor: '#110f0c',
        padding: '60px',
      }}
    >
      {/* Source row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span
          style={{
            fontFamily: 'Instrument Sans',
            fontSize: '26px',
            color: '#8a7f6f',
          }}
        >
          {source.city}{source.country ? `, ${source.country}` : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'Instrument Sans SB',
              fontSize: '36px',
              color: '#e8e0d4',
            }}
          >
            {source[timeKey]}
          </span>
          <span
            style={{
              fontFamily: 'Instrument Sans',
              fontSize: '18px',
              color: '#8a7f6f',
            }}
          >
            {source.abbreviation}
          </span>
        </div>
      </div>

      {/* Gradient divider */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '1px',
          background: 'linear-gradient(to right, transparent, #3a342a, transparent)',
          margin: '10px 0',
        }}
      />

      {/* Target section */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            fontFamily: 'Instrument Sans',
            fontSize: '26px',
            color: '#8a7f6f',
            marginBottom: '8px',
          }}
        >
          {target.city}{target.country ? `, ${target.country}` : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <span
            style={{
              fontFamily: 'Fraunces',
              fontSize: '120px',
              color: '#f4a636',
              lineHeight: '1',
              letterSpacing: '-0.03em',
            }}
          >
            {target[timeKey]}
          </span>
        </div>
        <span
          style={{
            fontFamily: 'Instrument Sans',
            fontSize: '20px',
            color: '#8a7f6f',
            marginTop: '8px',
          }}
        >
          {target.abbreviation} · UTC{target.offsetFromUTC}
        </span>

        {/* Chips */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <span
            style={{
              fontFamily: 'Instrument Sans',
              fontSize: '18px',
              color: '#f4a636',
              border: '1px solid rgba(244, 166, 54, 0.3)',
              backgroundColor: 'rgba(244, 166, 54, 0.08)',
              borderRadius: '6px',
              padding: '6px 14px',
            }}
          >
            {offsetDifference}
          </span>
          {isNotSameDay && (
            <span
              style={{
                fontFamily: 'Instrument Sans',
                fontSize: '18px',
                color: '#f4a636',
                border: '1px solid rgba(244, 166, 54, 0.3)',
                backgroundColor: 'rgba(244, 166, 54, 0.08)',
                borderRadius: '6px',
                padding: '6px 14px',
              }}
            >
              {dayBoundary}
            </span>
          )}
        </div>
      </div>

      {/* Branding */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#f4a636',
          }}
        />
        <span
          style={{
            fontFamily: 'Instrument Sans',
            fontSize: '20px',
            color: '#8a7f6f',
          }}
        >
          timezone.solar
        </span>
      </div>
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  const q = (req.query?.q as string) ?? ''
  const src = (req.query?.src as string) ?? undefined
  const use24h = req.query?.fmt === '24h'
  const result = q ? runConversion(q, src) : null

  const element = result ? <ResultCard result={result} use24h={use24h} /> : <BrandedCard />

  const imageResponse = new ImageResponse(element, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Fraunces', data: fraunces, style: 'normal' as const, weight: 600 as const },
      { name: 'Instrument Sans', data: instrumentSans, style: 'normal' as const, weight: 400 as const },
      { name: 'Instrument Sans SB', data: instrumentSansSB, style: 'normal' as const, weight: 600 as const },
    ],
  })

  const buffer = Buffer.from(await imageResponse.arrayBuffer())
  res.setHeader('Content-Type', 'image/png')
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800')
  res.end(buffer)
}

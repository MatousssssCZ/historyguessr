import React from 'react'
import { useTranslation } from 'react-i18next'
import { formatYear } from '@/lib/scoring'
import { C, F, SHADOW_CTA } from './RoundResult'

// Mezikrok po odehrání kola: nejdřív „co to bylo" (popis události + hodnocení),
// teprve pak skóre. Záměrně BEZ mapy — vzdálenost by prozradila skóre a zabila
// druhý takt (odhalení bodů). Sólo + denní výzva.
export default function RoundReveal({ heroUrl, eventTitle, eventYear, description, rating, onReveal, enableSpaceKey }: {
  heroUrl?: string | null
  eventTitle: string
  eventYear: number
  description: string
  rating?: React.ReactNode
  onReveal: () => void
  enableSpaceKey?: boolean
}) {
  const { t } = useTranslation()

  React.useEffect(() => {
    if (!enableSpaceKey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault(); onReveal()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enableSpaceKey, onReveal])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: C.bg, overflow: 'hidden' }}>
      <div style={{ width: '100%', maxWidth: 620, margin: '0 auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Hero — ilustrace události + název ve spodním pruhu */}
        <div style={{ position: 'relative', flex: 'none', height: '42dvh', minHeight: 220, overflow: 'hidden', background: 'linear-gradient(155deg,#8a6f50,#2a1f17)' }}>
          {heroUrl && <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: `url(${heroUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}/>}
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(20,16,10,.25) 0%, rgba(20,16,10,0) 40%, rgba(20,16,10,.85) 100%)' }}/>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 22px 18px' }}>
            <div style={{ font: `600 10px ${F.mono}`, letterSpacing: '.16em', textTransform: 'uppercase', color: '#E8C88A', marginBottom: 6 }}>{t('round.correctAnswer')}</div>
            <h2 style={{ margin: 0, font: `400 27px/1.15 ${F.display}`, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,.5)' }}>
              {eventTitle} <span style={{ color: 'rgba(255,255,255,.75)' }}>· {formatYear(eventYear)}</span>
            </h2>
          </div>
        </div>

        {/* Popis + hodnocení (scroll) */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {description
            ? <p style={{ margin: 0, font: `400 15px/1.65 ${F.ui}`, color: C.ink2 }}>{description}</p>
            : <p style={{ margin: 0, font: `400 14px ${F.ui}`, color: C.muted }}>{t('game.histEvent')}</p>}
          {rating && <div style={{ paddingTop: 14, borderTop: `1px solid ${C.line}` }}>{rating}</div>}
        </div>

        {/* CTA na skóre */}
        <div style={{ flex: 'none', padding: '12px 22px calc(env(safe-area-inset-bottom,0px) + 18px)' }}>
          <button type="button" onClick={onReveal} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 15, border: 0, borderRadius: 15, background: C.accent, color: '#fff', font: `700 15px ${F.ui}`, boxShadow: SHADOW_CTA, cursor: 'pointer' }}>
            {t('round.revealScore')} <span style={{ fontSize: 16 }}>→</span>
          </button>
        </div>
      </div>
    </div>
  )
}

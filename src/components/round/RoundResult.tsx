import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLocale } from '@/i18n'
import { formatDistance, formatYear } from '@/lib/scoring'
import ResultSwitcher from './ResultSwitcher'

// Redesign výsledku kola (handoff 17e). Mapa je hrdina (62 %), výsledek je
// jedna spodní karta. Prezentační komponenta — data i mapa přijdou přes props.
// Používá se pro denní výzvu (s detailem) i sólo hru (bez detailu).

export type DetailTab = 'panorama' | 'story' | 'leaderboard'
export const DETAIL_TABS: DetailTab[] = ['panorama', 'story', 'leaderboard']

// Layout dle handoffu 17e, ale barvy sjednocené s appkou (CSS proměnné →
// funguje i tmavý režim). Fixní zůstává jen zlatá (1. místo) a streak tečka.
export const C = {
  bg: 'var(--paper-200)', surface: 'var(--surface)', ink: 'var(--ink)', ink2: 'var(--ink-2)',
  muted: 'var(--ink-3)', muted2: 'var(--ink-3)', muted3: 'var(--ink-3)',
  accent: 'var(--accent)', good: 'var(--success)', gold: '#C89A3C', streak: '#E8C88A',
  line: 'var(--line)', lineStrong: 'var(--line-strong)', bar: 'var(--line-strong)',
  accentSoft: 'rgba(217,119,87,.10)', accentBorder: 'rgba(217,119,87,.32)',
}
export const SHADOW_CTA = '0 10px 22px -10px rgba(217,119,87,.6)'
export const F = {
  display: 'var(--font-serif)', ui: 'var(--font-sans)', mono: 'var(--font-mono)',
}

interface Props {
  map: React.ReactNode
  roundLabel?: string | null      // „KOLO 3 / 5" — u denní výzvy null
  dots?: boolean[] | null         // tečky kol — u denní výzvy null
  eventTitle: string
  eventYear: number
  scoreTotal: number
  scoreMax: number
  distanceKm: number
  placePoints: number
  placeMax: number
  yearOff: number                 // roky vedle
  yearPoints: number
  yearMax: number
  guessYear?: number | null       // tvůj tipnutý rok (do závorky)
  showDetail?: boolean            // vstupy do detailu
  detailTabs?: DetailTab[]        // které taby ukázat (default všechny 3)
  onOpenDetail?: (tab: DetailTab) => void
  panorama?: React.ReactNode      // 360° panorama (otevře se z pilulky na mapě)
  onChallenge?: () => void        // „Vyzvi kamaráda" v přepínači
  onLearnMore?: () => void        // „Dozvědět se více o události" (příběh)
  storyTeaser?: string | null     // titulek příběhu jako lákadlo pod CTA
  ctaLabel: string
  onCta: () => void
  secondaryActions?: React.ReactNode   // sdílení/makeup (jen denní výzva)
  rating?: React.ReactNode             // hodnocení události (kompaktní)
  praise?: string | null               // chytrá pochvala dle skóre (jen denní výzva)
}

// Vektorové ikony (line, currentColor) — panorama / „i" v kroužku / pohár
export function DetailIcon({ tab, size = 19 }: { tab: DetailTab; size?: number }) {
  const s = { width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' }
  if (tab === 'panorama') return (
    <svg {...s}><rect x="3" y="5" width="18" height="14" rx="2.2"/><circle cx="8.5" cy="10" r="1.4"/><path d="M4 17l4.6-5 3 3.2L15 11l5 6"/></svg>
  )
  if (tab === 'story') return (
    <svg {...s}><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6h.01"/></svg>
  )
  return (
    <svg {...s}><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4.4C3.6 6 3 6.7 3 7.6 3 9.6 4.8 11 7 11"/><path d="M17 6h2.6c.8 0 1.4.7 1.4 1.6C21 9.6 19.2 11 17 11"/><path d="M12 14v2.4"/><path d="M9.5 20h5"/><path d="M10 20l.4-3.6h3.2L14 20"/></svg>
  )
}

export default function RoundResult(p: Props) {
  const { t } = useTranslation()
  const loc = currentLocale()
  const [panoOpen, setPanoOpen] = useState(false)
  // Prostřední tlačítko přepínače: Žebříček (je-li) jinak O události
  const tabs = p.detailTabs ?? DETAIL_TABS
  const midTab: DetailTab | null = tabs.includes('leaderboard') ? 'leaderboard' : (tabs.includes('story') ? 'story' : null)
  const hasPano = !!p.panorama
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100dvh', background: C.bg, overflow: 'hidden' }}>
      {/* Mapa (hrdina) */}
      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: '62%', zIndex: 0 }}>
        <div style={{ position: 'absolute', inset: 0 }}>{p.map}</div>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(38,33,28,.42) 0%, rgba(38,33,28,0) 24%, rgba(38,33,28,0) 60%, rgba(242,236,226,.5) 92%, ' + C.bg + ' 100%)' }}/>
      </div>

      {/* 360° pilulka (otevře panorama) */}
      {hasPano && (
        <button type="button" onClick={() => setPanoOpen(true)} style={{ position: 'absolute', zIndex: 2, right: 16, top: 'calc(env(safe-area-inset-top,0px) + 10px)', display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', border: 0, borderRadius: 999, background: 'rgba(28,24,18,.62)', backdropFilter: 'blur(8px)', color: C.surface, font: `600 12px ${F.ui}`, cursor: 'pointer' }}>
          <DetailIcon tab="panorama" size={15}/> 360°
        </button>
      )}

      {/* Čip kola (jen sólo) */}
      {p.roundLabel && (
        <div style={{ position: 'absolute', zIndex: 2, left: 16, top: 'calc(env(safe-area-inset-top,0px) + 10px)', display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999, background: 'rgba(28,24,18,.5)', backdropFilter: 'blur(8px)', color: C.surface, font: `600 9.5px ${F.mono}`, letterSpacing: '.12em' }}>
          <span>{p.roundLabel}</span>
          {p.dots && <span style={{ display: 'flex', gap: 3 }}>{p.dots.map((on, i) => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: on ? C.streak : 'rgba(251,247,240,.35)' }}/>)}</span>}
        </div>
      )}

      {/* Spodní karta */}
      <div style={{ position: 'absolute', zIndex: 1, left: 0, right: 0, bottom: 0, padding: '16px 18px calc(env(safe-area-inset-bottom,0px) + 20px)', background: C.surface, borderTop: `1px solid ${C.line}`, borderRadius: '26px 26px 0 0', boxShadow: '0 -18px 40px -20px rgba(60,45,30,.35)', maxWidth: 480, marginInline: 'auto' }}>
        <div style={{ marginBottom: 5, font: `500 9.5px ${F.mono}`, letterSpacing: '.14em', color: C.accent }}>{t('round.correctAnswer')}</div>

        <h2 style={{ margin: '0 0 4px', font: `400 22px/1.22 ${F.display}`, color: C.ink, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {p.eventTitle} <span style={{ color: C.muted2 }}>· {formatYear(p.eventYear)}</span>
        </h2>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: p.praise ? 4 : 13 }}>
          <span style={{ font: `400 34px ${F.display}`, letterSpacing: '-.02em', color: C.accent }}>{p.scoreTotal.toLocaleString(loc)}</span>
          <span style={{ font: `500 12px ${F.ui}`, color: C.muted2 }}>/ {p.scoreMax.toLocaleString(loc)}</span>
        </div>
        {p.praise && <div style={{ font: `700 14px ${F.ui}`, color: C.ink, marginBottom: 13 }}>{p.praise}</div>}

        <div style={{ display: 'flex', gap: 9, marginBottom: 13 }}>
          <Metric label={t('round.kmOff', { d: formatDistance(p.distanceKm) })} points={p.placePoints} pct={p.placePoints / p.placeMax} color={C.accent}/>
          <Metric label={`${t('round.yearsOff', { n: p.yearOff })}${p.guessYear != null ? ` (${formatYear(p.guessYear)})` : ''}`} points={p.yearPoints} pct={p.yearPoints / p.yearMax} color={C.good}/>
        </div>

        {p.onLearnMore && (
          <button type="button" onClick={p.onLearnMore} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', marginBottom: 13, padding: '11px 13px', borderRadius: 14, border: `1px solid ${C.accentBorder}`, background: C.accentSoft, cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ flex: 'none', width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.accent, color: '#fff' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/></svg>
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', font: `700 13.5px ${F.ui}`, color: C.ink }}>{t('round.learnMore')}</span>
              {p.storyTeaser && <span style={{ display: 'block', font: `500 11.5px ${F.ui}`, color: C.muted2, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.storyTeaser}</span>}
            </span>
            <span style={{ flex: 'none', color: C.accent, fontSize: 16 }}>›</span>
          </button>
        )}

        {p.rating && <div style={{ padding: '2px 2px 12px' }}>{p.rating}</div>}

        {p.showDetail && p.onOpenDetail && midTab && (
          <ResultSwitcher
            active="score"
            onScore={() => {}}
            scoreLabel={t('round.tabMyScore')}
            mid={{ label: midTab === 'leaderboard' ? t('round.tabLeaderboard') : t('round.tabStory'), icon: midTab === 'leaderboard' ? 'trophy' : 'info', onClick: () => p.onOpenDetail!(midTab) }}
            onChallenge={p.onChallenge}
            challengeLabel={t('challenge.friendBtn')}
          />
        )}

        <button type="button" onClick={p.onCta} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 14, border: 0, borderRadius: 15, background: C.accent, color: '#fff', font: `700 14.5px ${F.ui}`, boxShadow: SHADOW_CTA, cursor: 'pointer' }}>
          {p.ctaLabel} <span style={{ fontSize: 15 }}>→</span>
        </button>
        {p.secondaryActions && <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>{p.secondaryActions}</div>}
      </div>

      {panoOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000' }}>
          <div style={{ position: 'absolute', inset: 0 }}>{p.panorama}</div>
          <button type="button" onClick={() => setPanoOpen(false)} aria-label={t('common.close')} style={{ position: 'absolute', zIndex: 2, top: 'calc(env(safe-area-inset-top,0px) + 16px)', right: 16, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: '50%', background: 'rgba(28,24,18,.7)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </div>
  )
}

function Metric({ label, points, pct, color }: { label: string; points: number; pct: number; color: string }) {
  return (
    <div style={{ flex: 1, padding: '9px 11px', borderRadius: 13, background: C.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ font: `600 10px ${F.ui}`, color: C.muted }}>{label}</span>
        <span style={{ font: `600 10px ${F.mono}`, color: C.ink }}>{points}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: C.lineStrong, overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(Math.min(1, Math.max(0, pct)) * 100)}%`, height: '100%', borderRadius: 2, background: color }}/>
      </div>
    </div>
  )
}

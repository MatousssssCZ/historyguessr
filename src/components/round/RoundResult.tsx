import React from 'react'
import { useTranslation } from 'react-i18next'
import { currentLocale } from '@/i18n'
import { formatDistance, formatYear } from '@/lib/scoring'

// Redesign výsledku kola (handoff 17e). Mapa je hrdina (62 %), výsledek je
// jedna spodní karta. Prezentační komponenta — data i mapa přijdou přes props.
// Používá se pro denní výzvu (s detailem) i sólo hru (bez detailu).

export type DetailTab = 'panorama' | 'distribution' | 'leaderboard'
export const DETAIL_TABS: DetailTab[] = ['panorama', 'distribution', 'leaderboard']

// Design tokeny (handoff)
export const C = {
  bg: '#F2ECE2', surface: '#FBF7F0', ink: '#26211C', ink2: '#3A332B',
  muted: '#6B6357', muted2: '#8C8175', muted3: '#A79C8C',
  accent: '#BE6240', good: '#4E7A50', gold: '#C89A3C', streak: '#E8C88A',
  line: 'rgba(40,30,20,.09)', lineStrong: 'rgba(40,30,20,.12)', bar: 'rgba(40,30,20,.13)',
  accentSoft: 'rgba(190,98,64,.10)', accentBorder: 'rgba(190,98,64,.32)',
}
export const F = {
  display: "'Fraunces', Georgia, serif", ui: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
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
  showDetail?: boolean            // 3 vstupy do detailu (jen denní)
  onOpenDetail?: (tab: DetailTab) => void
  ctaLabel: string
  onCta: () => void
  secondaryActions?: React.ReactNode   // sdílení/makeup (jen denní výzva)
}

const DETAIL_ICON: Record<DetailTab, string> = { panorama: '🖼', distribution: '📊', leaderboard: '🏆' }

export default function RoundResult(p: Props) {
  const { t } = useTranslation()
  const loc = currentLocale()
  const detailLabel: Record<DetailTab, string> = {
    panorama: t('round.tabPanorama'), distribution: t('round.tabDistribution'), leaderboard: t('round.tabLeaderboard'),
  }
  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100dvh', background: C.bg, overflow: 'hidden' }}>
      {/* Mapa (hrdina) */}
      <div style={{ position: 'absolute', left: 0, top: 0, right: 0, height: '62%' }}>
        <div style={{ position: 'absolute', inset: 0 }}>{p.map}</div>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(38,33,28,.42) 0%, rgba(38,33,28,0) 24%, rgba(38,33,28,0) 60%, rgba(242,236,226,.5) 92%, ' + C.bg + ' 100%)' }}/>
      </div>

      {/* Čip kola (jen sólo) */}
      {p.roundLabel && (
        <div style={{ position: 'absolute', left: 16, top: 'calc(env(safe-area-inset-top,0px) + 10px)', display: 'flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999, background: 'rgba(28,24,18,.5)', backdropFilter: 'blur(8px)', color: C.surface, font: `600 9.5px ${F.mono}`, letterSpacing: '.12em' }}>
          <span>{p.roundLabel}</span>
          {p.dots && <span style={{ display: 'flex', gap: 3 }}>{p.dots.map((on, i) => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: on ? C.streak : 'rgba(251,247,240,.35)' }}/>)}</span>}
        </div>
      )}

      {/* Spodní karta */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '16px 18px calc(env(safe-area-inset-bottom,0px) + 20px)', background: C.surface, borderTop: `1px solid ${C.line}`, borderRadius: '26px 26px 0 0', boxShadow: '0 -18px 40px -20px rgba(60,45,30,.35)', maxWidth: 480, marginInline: 'auto' }}>
        <div style={{ marginBottom: 5, font: `500 9.5px ${F.mono}`, letterSpacing: '.14em', color: C.accent }}>{t('round.correctAnswer')}</div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 13 }}>
          <h2 style={{ margin: 0, maxWidth: '62%', font: `400 18px/1.2 ${F.display}`, color: C.ink }}>
            {p.eventTitle} <span style={{ color: C.muted2 }}>· {formatYear(p.eventYear)}</span>
          </h2>
          <div style={{ flex: 'none', textAlign: 'right' }}>
            <span style={{ font: `400 36px ${F.display}`, letterSpacing: '-.02em', color: C.accent }}>{p.scoreTotal.toLocaleString(loc)}</span>
            <span style={{ font: `500 11px ${F.ui}`, color: C.muted2 }}> / {p.scoreMax.toLocaleString(loc)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 9, marginBottom: 13 }}>
          <Metric label={t('round.kmOff', { d: formatDistance(p.distanceKm) })} points={p.placePoints} pct={p.placePoints / p.placeMax} color={C.accent}/>
          <Metric label={t('round.yearsOff', { n: p.yearOff })} points={p.yearPoints} pct={p.yearPoints / p.yearMax} color={C.good}/>
        </div>

        {p.showDetail && p.onOpenDetail && (
          <div style={{ display: 'flex', gap: 7, marginBottom: 13 }}>
            {DETAIL_TABS.map(tab => (
              <button key={tab} type="button" onClick={() => p.onOpenDetail!(tab)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '9px 4px', minHeight: 56, border: `1px solid ${C.lineStrong}`, borderRadius: 12, background: C.surface, color: C.ink2, font: `600 9.5px ${F.ui}`, cursor: 'pointer' }}>
                <span style={{ fontSize: 17 }}>{DETAIL_ICON[tab]}</span>
                <span>{detailLabel[tab]}</span>
              </button>
            ))}
          </div>
        )}

        <button type="button" onClick={p.onCta} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 14, border: 0, borderRadius: 15, background: C.accent, color: '#fff', font: `700 14.5px ${F.ui}`, boxShadow: '0 10px 22px -10px rgba(190,98,64,.65)', cursor: 'pointer' }}>
          {p.ctaLabel} <span style={{ fontSize: 15 }}>→</span>
        </button>
        {p.secondaryActions && <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>{p.secondaryActions}</div>}
      </div>
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

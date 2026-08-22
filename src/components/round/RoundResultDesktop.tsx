import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLocale } from '@/i18n'
import { formatDistance, formatYear } from '@/lib/scoring'
import { C, F, SHADOW_CTA, DetailIcon } from './RoundResult'
import Icon, { type IconName } from '@/components/Icon'
import { LeaderRow, DistributionCard, type LeaderEntry, type Distribution } from './RoundDetail'

// Desktop výsledek kola (handoff 17f) — dvousloupcový layout:
// vlevo mapa-hrdina (tlačítko panoramatu → fullscreen), vpravo panel
// s výsledkem a přepínačem „Moje skóre / Žebříček" (žebříček jen když je).

interface Props {
  map: React.ReactNode
  panorama: React.ReactNode
  roundLabel?: string | null
  dots?: boolean[] | null
  eventTitle: string
  eventYear: number
  metaLine?: string | null
  story: React.ReactNode
  scoreTotal: number
  scoreMax: number
  distanceKm: number
  placePoints: number
  placeMax: number
  yearOff: number
  yearPoints: number
  yearMax: number
  leaderboard?: LeaderEntry[] | null   // null → sólo (bez přepínače)
  playersToday?: number
  distribution?: Distribution | null
  xpSection?: React.ReactNode
  onShare?: (() => void) | null
  ctaLabel: string
  onCta: () => void
  ctaHint?: string | null              // „MEZERNÍK · DALŠÍ KOLO"
  enableSpaceKey?: boolean
  rating?: React.ReactNode             // hodnocení události
  secondaryActions?: React.ReactNode   // pod CTA (např. Vyzvi kamaráda)
  praise?: string | null               // chytrá pochvala dle skóre (jen denní výzva)
}

type View = 'score' | 'leaderboard'

export default function RoundResultDesktop(p: Props) {
  const { t } = useTranslation()
  const loc = currentLocale()
  const hasLeaderboard = !!p.leaderboard && p.leaderboard.length > 0
  const [view, setView] = useState<View>('score')
  const [panoOpen, setPanoOpen] = useState(false)

  // Mezerník → další kolo (jen když je povoleno a není otevřené panorama)
  useEffect(() => {
    if (!p.enableSpaceKey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !panoOpen) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault(); p.onCta()
      }
      if (e.code === 'Escape' && panoOpen) setPanoOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [p.enableSpaceKey, panoOpen, p.onCta])

  return (
    <div style={{ display: 'flex', height: '100dvh', background: C.bg, overflow: 'hidden' }}>
      {/* ── Levý sloupec: mapa ── */}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>{p.map}</div>

        {p.roundLabel && (
          <div style={{ position: 'absolute', zIndex: 2, left: 20, top: 20, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 13px', borderRadius: 999, background: 'rgba(28,24,18,.55)', backdropFilter: 'blur(8px)', color: '#fff', font: `600 10.5px ${F.mono}`, letterSpacing: '.12em' }}>
            <span>{p.roundLabel}</span>
            {p.dots && <span style={{ display: 'flex', gap: 3.5 }}>{p.dots.map((on, i) => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: on ? C.streak : 'rgba(251,247,240,.35)' }}/>)}</span>}
          </div>
        )}

        {/* Tlačítko panoramatu (vlevo dole) */}
        <button type="button" onClick={() => setPanoOpen(true)} style={{ position: 'absolute', zIndex: 2, left: 20, bottom: 20, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', border: 0, borderRadius: 14, background: 'rgba(28,24,18,.72)', backdropFilter: 'blur(10px)', color: '#fff', font: `600 12.5px ${F.ui}`, cursor: 'pointer', boxShadow: '0 8px 20px -8px rgba(0,0,0,.5)' }}>
          <span style={{ display: 'flex', color: '#fff' }}><DetailIcon tab="panorama" size={17}/></span>
          {t('round.tabPanorama')}
        </button>
      </div>

      {/* ── Pravý sloupec: panel ── */}
      <aside style={{ flex: 'none', width: 400, maxWidth: '42%', display: 'flex', flexDirection: 'column', background: C.surface, borderLeft: `1px solid ${C.line}`, boxShadow: '-18px 0 40px -30px rgba(60,45,30,.5)' }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '26px 26px 8px' }}>
          {/* Kicker + sdílet */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
            <span style={{ font: `600 10.5px ${F.mono}`, letterSpacing: '.16em', color: C.accent }}>{t('round.correctAnswer')}</span>
            {p.onShare && (
              <button type="button" onClick={p.onShare} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999, border: `1px solid ${C.lineStrong}`, background: C.surface, color: C.ink2, font: `600 11px ${F.ui}`, cursor: 'pointer' }}><Icon name="share" size={13}/> {t('daily.share')}</button>
            )}
          </div>

          {/* Název + meta */}
          <h2 style={{ margin: '0 0 8px', font: `400 26px/1.18 ${F.display}`, color: C.ink }}>{p.eventTitle}</h2>
          <div style={{ marginBottom: 18, font: `500 12px ${F.ui}`, color: C.muted2 }}>{p.metaLine || formatYear(p.eventYear)}</div>

          {view === 'score' ? (
            <>
              {/* Popis události */}
              <div style={{ marginBottom: 20 }}>{p.story}</div>

              {/* Skóre */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: p.praise ? 6 : 16 }}>
                <span style={{ font: `400 52px ${F.display}`, letterSpacing: '-.02em', color: C.accent, lineHeight: 1 }}>{p.scoreTotal.toLocaleString(loc)}</span>
                <span style={{ font: `500 13px ${F.ui}`, color: C.muted2 }}>/ {p.scoreMax.toLocaleString(loc)} {t('common.pts')}</span>
              </div>
              {p.praise && <div style={{ font: `700 16px ${F.ui}`, color: C.ink, marginBottom: 16 }}>{p.praise}</div>}

              {/* Dlaždice km / rok */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                <MetricRow icon="pin" label={t('round.kmOff', { d: formatDistance(p.distanceKm) })} points={p.placePoints} max={p.placeMax} color={C.accent}/>
                <MetricRow icon="calendar" label={t('round.yearsOffLong', { count: p.yearOff })} points={p.yearPoints} max={p.yearMax} color={C.good}/>
              </div>

              {p.xpSection && <div style={{ marginBottom: 6 }}>{p.xpSection}</div>}
              {p.rating && <div style={{ marginTop: 6, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>{p.rating}</div>}
            </>
          ) : (
            <>
              {/* Žebříček */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: `600 10px ${F.mono}`, letterSpacing: '.12em', color: C.muted2 }}><Icon name="friends" size={14}/> {t('round.playedToday')}</span>
                <span style={{ font: `700 12px ${F.ui}`, color: C.ink }}>{(p.playersToday ?? p.leaderboard!.length).toLocaleString(loc)} {t('round.players')}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                {p.leaderboard!.map((e, i) => <LeaderRow key={e.id} e={e} rank={i + 1} youLabel={t('round.you')}/>)}
              </div>
              {p.distribution && <DistributionCard dist={p.distribution} big t={t}/>}
            </>
          )}
        </div>

        {/* Přepínač Moje skóre / Žebříček (jen když je žebříček) */}
        {hasLeaderboard && (
          <div style={{ flex: 'none', padding: '4px 26px 0' }}>
            <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 13, background: C.bg }}>
              <Toggle on={view === 'score'} label={t('round.tabMyScore')} onClick={() => setView('score')}/>
              <Toggle on={view === 'leaderboard'} label={t('round.tabLeaderboard')} onClick={() => setView('leaderboard')}/>
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ flex: 'none', padding: '14px 26px calc(env(safe-area-inset-bottom,0px) + 20px)' }}>
          <button type="button" onClick={p.onCta} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 15, border: 0, borderRadius: 15, background: C.accent, color: '#fff', font: `700 15px ${F.ui}`, boxShadow: SHADOW_CTA, cursor: 'pointer' }}>
            {p.ctaLabel} <span style={{ fontSize: 16 }}>→</span>
          </button>
          {p.ctaHint && <div style={{ marginTop: 9, textAlign: 'center', font: `500 9.5px ${F.mono}`, letterSpacing: '.12em', color: C.muted3 }}>{p.ctaHint}</div>}
          {p.secondaryActions && <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>{p.secondaryActions}</div>}
        </div>
      </aside>

      {/* Fullscreen panorama */}
      {panoOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000' }}>
          <div style={{ position: 'absolute', inset: 0 }}>{p.panorama}</div>
          <button type="button" onClick={() => setPanoOpen(false)} aria-label={t('common.close')} style={{ position: 'absolute', zIndex: 2, top: 'calc(env(safe-area-inset-top,0px) + 16px)', right: 16, width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: '50%', background: 'rgba(28,24,18,.7)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </div>
  )
}

function MetricRow({ icon, label, points, max, color }: { icon: IconName; label: string; points: number; max: number; color: string }) {
  return (
    <div style={{ padding: '11px 14px', borderRadius: 13, background: C.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, font: `600 12px ${F.ui}`, color: C.ink }}><span style={{ display: 'flex', color }}><Icon name={icon} size={15}/></span>{label}</span>
        <span style={{ font: `600 12px ${F.mono}`, color: C.ink }}>{points} <span style={{ color: C.muted2 }}>/ {max}</span></span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: C.lineStrong, overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(Math.min(1, Math.max(0, points / max)) * 100)}%`, height: '100%', borderRadius: 3, background: color }}/>
      </div>
    </div>
  )
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 0, cursor: 'pointer', background: on ? C.surface : 'transparent', color: on ? C.ink : C.muted2, font: `${on ? 700 : 600} 12.5px ${F.ui}`, boxShadow: on ? '0 2px 8px -4px rgba(60,45,30,.4)' : 'none' }}>{label}</button>
  )
}

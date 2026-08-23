import React from 'react'
import { useTranslation } from 'react-i18next'
import { currentLocale } from '@/i18n'
import { formatDistance } from '@/lib/scoring'
import { C, F, SHADOW_CTA, type DetailTab } from './RoundResult'
import ResultSwitcher from './ResultSwitcher'

export interface LeaderEntry {
  id: string
  name: string
  score: number
  distanceKm: number
  yearOff: number
  isMe: boolean
}
export interface Distribution { bins: number[]; myBinIndex: number; percentileBetterThan: number }

interface Props {
  initialTab: DetailTab          // 'leaderboard' (žebříček) nebo 'story' (o události)
  title: string           // „Kolo 3 · IBM PC" nebo název události
  subtitle: string        // „826 B. · 1981 · BOCA RATON"
  leaderboard: LeaderEntry[]
  playersToday: number
  distribution: Distribution
  story: React.ReactNode        // „O události" — popis/příběh
  xpSection?: React.ReactNode   // XP bar přes celou šířku
  onBack: () => void            // zpět na „Moje skóre"
  onChallenge?: () => void      // „Vyzvi kamaráda" v přepínači
  onShare?: () => void          // „Sdílet výsledek" (v žebříčku)
  ctaLabel: string
  onCta: () => void
}

export default function RoundDetail(p: Props) {
  const { t } = useTranslation()
  const isBoard = p.initialTab === 'leaderboard'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: C.bg, overflow: 'hidden', maxWidth: 480, marginInline: 'auto' }}>
      {/* Topbar */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 11, padding: 'calc(env(safe-area-inset-top,0px) + 8px) 18px 12px' }}>
        <button type="button" onClick={p.onBack} aria-label={t('common.back')} style={{ flex: 'none', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid rgba(40,30,20,.10)`, borderRadius: '50%', background: C.surface, color: C.ink2, cursor: 'pointer', fontSize: 15 }}>←</button>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: `400 16px ${F.display}`, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
          <div style={{ marginTop: 1, font: `500 9px ${F.mono}`, color: C.muted2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.subtitle}</div>
        </div>
      </div>

      {/* Počet hráčů (jen žebříček) */}
      {isBoard && (
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px 9px' }}>
          <span style={{ font: `500 9.5px ${F.mono}`, letterSpacing: '.10em', color: C.muted2 }}>{t('round.playedToday')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: `600 11px ${F.ui}`, color: C.ink }}>
            {p.playersToday.toLocaleString(currentLocale())} {t('round.players')}
          </span>
        </div>
      )}

      {/* Obsah */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {isBoard ? (
          <>
            {p.leaderboard.map((e, i) => <LeaderRow key={e.id} e={e} rank={i + 1} youLabel={t('round.you')}/>)}
            {p.onShare && (
              <button type="button" onClick={p.onShare} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', marginTop: 4, padding: 11, border: `1px solid ${C.lineStrong}`, borderRadius: 12, background: 'transparent', color: C.ink2, font: `600 12.5px ${F.ui}`, cursor: 'pointer' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v13"/><path d="M8 7l4-4 4 4"/></svg>
                {t('daily.share')}
              </button>
            )}
            {p.xpSection && <div style={{ marginTop: 5 }}>{p.xpSection}</div>}
            <DistributionCard dist={p.distribution} t={t}/>
          </>
        ) : (
          <div style={{ padding: '4px 0 10px' }}>{p.story}</div>
        )}
      </div>

      {/* Přepínač + CTA */}
      <div style={{ flex: 'none', padding: '8px 18px calc(env(safe-area-inset-bottom,0px) + 18px)' }}>
        <ResultSwitcher
          active="mid"
          onScore={p.onBack}
          scoreLabel={t('round.tabMyScore')}
          mid={{ label: isBoard ? t('round.tabLeaderboard') : t('round.tabStory'), icon: isBoard ? 'trophy' : 'info', onClick: () => {} }}
          onChallenge={p.onChallenge}
          challengeLabel={t('challenge.friendBtn')}
        />
        <button type="button" onClick={p.onCta} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 13, border: 0, borderRadius: 15, background: C.accent, color: '#fff', font: `700 14.5px ${F.ui}`, boxShadow: SHADOW_CTA, cursor: 'pointer' }}>{p.ctaLabel} <span style={{ fontSize: 15 }}>→</span></button>
      </div>
    </div>
  )
}

export function LeaderRow({ e, rank, youLabel }: { e: LeaderEntry; rank: number; youLabel: string }) {
  const loc = currentLocale()
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, background: e.isMe ? C.accentSoft : C.surface, border: e.isMe ? `1px solid ${C.accentBorder}` : 'none' }}>
      <span style={{ width: 16, font: `${e.isMe || rank === 1 ? 700 : 600} 10px ${F.mono}`, color: rank === 1 ? C.gold : e.isMe ? C.accent : C.muted2 }}>{rank}</span>
      <div style={{ flex: 'none', width: 26, height: 26, borderRadius: '50%', background: e.isMe ? 'linear-gradient(150deg,#d97757,#b85a3e)' : 'linear-gradient(150deg,#e8dfd0,#cdbfa9)' }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: `${e.isMe ? 700 : 600} 12px ${F.ui}`, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.isMe ? youLabel : e.name}</div>
        <div style={{ font: `500 9px ${F.mono}`, color: e.isMe ? C.accent : C.muted3 }}>{formatDistance(e.distanceKm).toUpperCase()} · {e.yearOff} {t('round.yearsShort', { n: e.yearOff })}</div>
      </div>
      <span style={{ font: `${e.isMe ? 700 : 600} 12px ${F.mono}`, color: e.isMe ? C.accent : C.ink }}>{e.score.toLocaleString(loc)}</span>
    </div>
  )
}

export function DistributionCard({ dist, big, t }: { dist: Distribution; big?: boolean; t: (k: string, o?: Record<string, unknown>) => string }) {
  const max = Math.max(...dist.bins, 1)
  return (
    <div style={{ marginTop: 5, padding: '11px 14px', borderRadius: 14, background: C.surface }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
        <span style={{ font: `600 11.5px ${F.ui}`, color: C.ink }}>{t('round.scoreDistribution')}</span>
        <span style={{ font: `500 9px ${F.mono}`, color: C.muted2 }}>{t('round.betterThan', { pct: dist.percentileBetterThan })}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: big ? 96 : 38 }}>
        {dist.bins.map((v, i) => (
          <div key={i} style={{ flex: 1, borderRadius: '3px 3px 0 0', background: i === dist.myBinIndex ? C.accent : C.bar, height: `${Math.max(6, (v / max) * 100)}%` }}/>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, font: `500 8.5px ${F.mono}`, color: C.muted3 }}>
        <span>0</span><span>500</span><span>1000</span>
      </div>
    </div>
  )
}

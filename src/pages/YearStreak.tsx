import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { currentLocale } from '@/i18n'
import { useAuth } from '@/hooks/useAuth'
import { useIsMobile } from '@/hooks/useIsMobile'
import { getUserDailyResults, localDateISO } from '@/lib/supabase'
import MobileNav from '@/components/MobileNav'
import AppHeader from '@/components/AppHeader'
import CompassLoader from '@/components/CompassLoader'

const GREEN = '#4E6E4C'
const MISSED = 'rgba(190,98,64,.2)'
const OFF = 'rgba(31,27,22,.07)'
const TARGET = 100

type DayState = 'played' | 'missed' | 'off'

/** Roční série denní výzvy (handoff 32e) — 12 měsíců, den = čtvereček. */
export default function YearStreakPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [days, setDays] = useState<Set<string> | null>(null)

  useEffect(() => {
    if (!user) return
    getUserDailyResults(user.id).then(rows => setDays(new Set(rows.map(r => r.date))))
  }, [user])

  const { streak, longest, playedThisYear } = useMemo(() => {
    if (!days) return { streak: 0, longest: 0, playedThisYear: 0 }
    const yr = new Date().getFullYear()
    let played = 0
    for (const d of days) if (d.startsWith(String(yr))) played++
    // Aktuální série (končící dnes/včera)
    const d = new Date()
    if (!days.has(localDateISO(d))) d.setDate(d.getDate() - 1)
    let cur = 0
    while (days.has(localDateISO(d))) { cur++; d.setDate(d.getDate() - 1) }
    return { streak: cur, longest: cur, playedThisYear: played }
  }, [days])

  if (!days) return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-200)' }}><CompassLoader size={60} light/></div>

  const year = new Date().getFullYear()
  const todayISO = localDateISO()
  const monthNames = Array.from({ length: 12 }, (_, m) => new Date(year, m, 1).toLocaleDateString(currentLocale(), { month: 'short' }))

  function stateOf(iso: string): DayState {
    if (days!.has(iso)) return 'played'
    if (iso > todayISO) return 'off'
    return 'missed'
  }
  const remaining = Math.max(0, TARGET - streak)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)' }}>
      {!isMobile && <AppHeader/>}
      <div style={{ paddingTop: isMobile ? 'var(--safe-top)' : 0, paddingBottom: isMobile ? 'var(--nav-space)' : 40, maxWidth: 980, margin: '0 auto' }}>
        {/* Hero */}
        <div style={{ background: 'var(--ink-dark, #1A1611)', padding: isMobile ? '20px 18px' : '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <button onClick={() => navigate(-1)} style={{ width: 36, height: 36, flex: 'none', borderRadius: 11, background: 'rgba(251,247,240,0.1)', border: '1px solid rgba(251,247,240,0.16)', color: '#FBF7F0', cursor: 'pointer', fontSize: 15 }}>←</button>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', color: '#E9A183' }}>{t('streak.eyebrow', { year })}</div>
              <h1 style={{ margin: '8px 0 0', fontFamily: 'var(--font-serif)', fontSize: isMobile ? 24 : 30, color: '#FBF7F0', letterSpacing: '-0.025em' }}>{t('streak.days', { n: streak })}</h1>
            </div>
          </div>
          <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px', borderRadius: 16, background: 'rgba(251,247,240,0.06)', border: '1px solid rgba(251,247,240,0.14)' }}>
            <div style={{ position: 'relative', width: 56, height: 56, borderRadius: '50%', background: `conic-gradient(var(--accent) 0 ${Math.round(Math.min(1, streak / TARGET) * 360)}deg, rgba(251,247,240,0.14) 0)` }}>
              <div style={{ position: 'absolute', inset: 7, borderRadius: '50%', background: 'var(--ink-dark, #1A1611)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🔥</div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.15em', color: 'rgba(251,247,240,0.6)' }}>{t('streak.toBadge', { n: TARGET })}</div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 17, color: '#FBF7F0', marginTop: 4 }}>{t('streak.remaining', { n: remaining })}</div>
            </div>
          </div>
        </div>

        {/* Měsíce */}
        <div style={{ padding: isMobile ? '18px 15px 24px' : '22px 28px 28px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit,minmax(210px,1fr))', gap: isMobile ? 14 : 16 }}>
          {monthNames.map((name, m) => {
            const dim = new Date(year, m + 1, 0).getDate()
            return (
              <div key={m} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '13px 14px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 9 }}>{name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                  {Array.from({ length: dim }, (_, i) => {
                    const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
                    const st = stateOf(iso)
                    return <div key={i} title={iso} style={{ aspectRatio: '1', borderRadius: 3, background: st === 'played' ? GREEN : st === 'missed' ? MISSED : OFF, boxShadow: iso === todayISO ? '0 0 0 2px var(--ink)' : undefined }}/>
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legenda + shrnutí */}
        <div style={{ padding: isMobile ? '0 15px 20px' : '0 28px 20px', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', fontSize: 12, color: 'var(--ink-2)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: GREEN }}/>{t('streak.legPlayed')}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: MISSED }}/>{t('streak.legMissed')}</span>
          <span style={{ marginLeft: 'auto', color: 'var(--ink-3)' }}>{t('streak.summary', { played: playedThisYear, longest })}</span>
        </div>
      </div>
      {isMobile && <MobileNav active="badges"/>}
    </div>
  )
}

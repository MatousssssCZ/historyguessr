import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { currentLocale } from '@/i18n'
import { getRandomEvents } from '@/lib/supabase'
import { eventTitle } from '@/lib/eventLocale'
import { haversineKm, roundScore, yearDiff, formatYear, formatDistance } from '@/lib/scoring'
import { ResultMap } from '@/components/GameMap'
import { PanoramaViewer, GuessPanel, InfoContent } from '@/pages/Game'
import type { Event } from '@/types/database'

type Phase = 'loading' | 'intro' | 'playing' | 'result'
type Result = { distKm: number; locScore: number; yrScore: number; total: number; yrDiff: number }

export default function TryGamePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('loading')
  const [event, setEvent] = useState<Event | null>(null)
  const [guessLat, setGuessLat] = useState<number | null>(null)
  const [guessLng, setGuessLng] = useState<number | null>(null)
  const [guessYear, setGuessYear] = useState(1900)
  const [yearSet, setYearSet] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [tab, setTab] = useState<'score' | 'info'>('score')

  async function loadEvent() {
    setPhase('loading')
    setGuessLat(null); setGuessLng(null); setGuessYear(1900); setYearSet(false); setResult(null); setTab('score')
    const evs = await getRandomEvents(1).catch(() => [])
    const ev = evs.find(e => e.panorama_url && e.panorama_url !== 'pending') ?? evs[0] ?? null
    setEvent(ev)
    setPhase('intro')
  }
  useEffect(() => { loadEvent() }, [])

  function submit() {
    if (!event || guessLat === null || !yearSet) return
    const yf = event.year_from ?? event.year, yt = event.year_to ?? event.year
    const dist = haversineKm(guessLat, guessLng!, event.lat, event.lng)
    const { location_score: loc, year_score: yr, round_score: total } = roundScore(dist, guessYear, yf, yt, event.location_radius_km ?? 0)
    setResult({ distKm: dist, locScore: loc, yrScore: yr, total, yrDiff: yearDiff(guessYear, yf, yt) })
    setPhase('result')
  }

  if (phase === 'loading' || !event) {
    return <div style={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-200)' }}><span className="spinner" style={{ width: 28, height: 28 }}/></div>
  }

  // ── Intro (#9a) ──
  if (phase === 'intro') {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 22px', paddingTop: 'var(--safe-top)', paddingBottom: 'max(24px, var(--safe-bottom))' }}>
        <div style={{ maxWidth: 420, margin: '0 auto', width: '100%', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: 'linear-gradient(150deg,#d97757,#b85a3e)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', boxShadow: '0 12px 26px -8px rgba(217,119,87,0.5)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5 L10.7 10.7 L8.5 15.5 L13.3 13.3 Z" fill="#fff"/></svg>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent-deep)', marginBottom: 10 }}>{t('menu.trialEyebrow')}</div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', lineHeight: 1.2, margin: '0 0 14px' }}>{t('menu.trialTitle')}</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-3)', margin: '0 0 30px' }}>{t('menu.trialDesc')}</p>
          <button onClick={() => setPhase('playing')} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14, padding: 15, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 12px 26px -8px rgba(217,119,87,0.5)', marginBottom: 14 }}>
            {t('menu.trialEnter')} →
          </button>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('menu.trialHaveAccount')} <button onClick={() => navigate('/auth')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 700, fontSize: 12 }}>{t('menu.trialLogin')}</button></div>
        </div>
      </div>
    )
  }

  // ── Playing ──
  if (phase === 'playing') {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0d0906', position: 'relative', overflow: 'hidden' }}>
        {/* HUD — zkušební kolo + domů */}
        <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top,0px) + 12px)', left: 0, right: 0, zIndex: 25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', pointerEvents: 'none' }}>
          <button onClick={() => navigate('/auth')} aria-label={t('menu.trialLogin')} style={{ pointerEvents: 'auto', width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', background: 'rgba(246,240,230,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.5)', color: '#26211C', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <div style={{ pointerEvents: 'auto', borderRadius: 16, padding: '7px 16px', background: 'rgba(246,240,230,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-deep)' }}>{t('menu.trialRoundLabel')}</div>
          <div style={{ width: 38 }}/>
        </div>

        {/* Název události */}
        <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top,0px) + 62px)', left: 16, zIndex: 45, maxWidth: 'min(400px, 58vw)', pointerEvents: 'none' }}>
          <div style={{ background: 'rgba(13,9,6,0.6)', backdropFilter: 'blur(14px)', border: '1px solid rgba(245,241,232,0.12)', borderRadius: 12, padding: '10px 16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 5 }}>{t('game.histEvent')}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(15px, 2.2vw, 22px)', color: 'var(--on-dark)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>{eventTitle(event)}</div>
          </div>
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <PanoramaViewer url={event.panorama_url} preview={event.preview_url}/>
          <GuessPanel
            guessLat={guessLat} guessLng={guessLng} guessYear={guessYear} guessYearSet={yearSet}
            canSubmit={guessLat !== null && yearSet}
            onLocationChange={(lat, lng) => { setGuessLat(lat); setGuessLng(lng) }}
            onYearChange={y => { setGuessYear(y); setYearSet(true) }}
            onSubmit={submit}
          />
        </div>
      </div>
    )
  }

  // ── Result (#9b) ──
  const r = result!
  const locPct = Math.round(r.locScore / 5)
  const yrPct = Math.round(r.yrScore / 5)
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-50)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, maxWidth: 480, width: '100%', margin: '0 auto', padding: '14px 16px 8px', paddingTop: 'calc(14px + var(--safe-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.14em', color: 'var(--accent-deep)', textTransform: 'uppercase' }}>{t('menu.trialRoundLabel')}</span>
          <button onClick={() => navigate('/auth')} aria-label={t('menu.trialLogin')} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink-2)', cursor: 'pointer', fontSize: 13 }}>⌂</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', lineHeight: 1.05, flex: 1 }}>{eventTitle(event)}</div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--accent)', lineHeight: 0.9 }}>{r.total.toLocaleString(currentLocale())}</span>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--accent)' }}> {t('common.pts')}</span>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--ink-3)', marginTop: 2 }}>{t('game.outOf1000')}</div>
          </div>
        </div>

        {/* Záložky */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(['score', 'info'] as const).map(k => {
            const on = tab === k
            return <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: '9px 0', borderRadius: 10, cursor: 'pointer', border: on ? '1px solid var(--accent)' : '1px solid var(--line)', background: on ? 'rgba(217,119,87,0.08)' : 'transparent', color: on ? 'var(--accent-deep)' : 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: on ? 500 : 400 }}>{k === 'score' ? `🏆 ${t('game.tabScore')}` : `📖 ${t('game.tabInfo')}`}</button>
          })}
        </div>

        {tab === 'score' ? (
          <>
            <div style={{ height: 160, borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
              <ResultMap guessLat={guessLat ?? 0} guessLng={guessLng ?? 0} truthLat={event.lat} truthLng={event.lng} radiusKm={event.location_radius_km ?? 0}/>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 9 }}>
              <ScoreCard label={t('game.location')} value={r.locScore} pct={locPct} sub={formatDistance(r.distKm)}/>
              <ScoreCard label={t('game.year')} value={r.yrScore} pct={yrPct} sub={r.yrDiff === 0 ? t('daily.exact') : t('game.yearOff', { n: r.yrDiff })}/>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 13, padding: '11px 14px', display: 'flex', justifyContent: 'space-between', marginBottom: 11 }}>
              <div><div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('game.correctYear')}</div><div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{formatYear(event.year)}</div></div>
              <div style={{ textAlign: 'right' }}><div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{t('game.yourGuess')}</div><div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{formatYear(guessYear)}</div></div>
            </div>
            {/* Uzamčený žebříček */}
            <div style={{ position: 'relative', borderRadius: 13, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--line)', padding: '11px 13px' }}>
              <div style={{ filter: 'blur(3px)', opacity: 0.55 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11.5, color: 'var(--ink)', marginBottom: 6 }}><span>1. Historik_89</span><span>968</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11.5, color: 'var(--ink)' }}><span>2. cestovatelka</span><span>910</span></div>
              </div>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11, color: 'var(--ink-2)' }}>🔒 {t('menu.trialLocked')}</div>
            </div>
          </>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}><InfoContent event={event}/></div>
        )}
      </div>

      {/* CTA */}
      <div style={{ flexShrink: 0, maxWidth: 480, width: '100%', margin: '0 auto', padding: '10px 16px', paddingBottom: 'max(16px, var(--safe-bottom))', background: 'linear-gradient(180deg, rgba(250,247,240,0), var(--paper-50) 40%)' }}>
        <button onClick={() => navigate('/auth', { state: { mode: 'register' } })} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14, padding: 15, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 12px 24px -8px rgba(217,119,87,0.5)', marginBottom: 9 }}>
          {t('menu.trialRegisterCta')} →
        </button>
        <button onClick={loadEvent} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12, color: 'var(--ink-3)', padding: 6 }}>{t('menu.trialAnother')}</button>
      </div>
    </div>
  )
}

function ScoreCard({ label, value, pct, sub }: { label: string; value: number; pct: number; sub: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 13, padding: '11px 13px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.1em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', lineHeight: 1 }}>{value}</div>
      <div style={{ height: 4, borderRadius: 4, background: 'var(--paper-300)', overflow: 'hidden', margin: '8px 0 6px' }}><div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: 'var(--accent)' }}/></div>
      <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10.5, color: 'var(--ink-3)' }}>{sub}</div>
    </div>
  )
}

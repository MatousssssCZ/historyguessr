import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getRandomEvents } from '@/lib/supabase'
import type { Event } from '@/types/database'
import { GuessMap } from '@/components/GameMap'
import { PanoramaViewer, YearPicker } from '@/pages/Game'
import { useIsMobile } from '@/hooks/useIsMobile'

const ACCENT_GRAD = 'linear-gradient(150deg,#d97757,#b85a3e)'

type Step = { icon: string; art: React.ReactNode; titleKey: string; descKey: string }

/** Onboarding „Jak hrát" — 4 kroky (#10), první 3 jsou reálně vyzkoušitelné. Fullscreen overlay, volá onClose po dokončení/přeskočení. */
export default function HowToPlay({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [i, setI] = useState(0)
  const [demoEvent, setDemoEvent] = useState<Event | null>(null)
  const [guessLat, setGuessLat] = useState<number | null>(null)
  const [guessLng, setGuessLng] = useState<number | null>(null)
  const [guessYear, setGuessYear] = useState(1900)

  useEffect(() => {
    getRandomEvents(1).then(evs => { if (evs[0]) setDemoEvent(evs[0]) }).catch(() => {})
  }, [])

  const steps: Step[] = [
    { icon: '🖼', titleKey: 'menu.ht1t', descKey: 'menu.ht1d', art: <PanoramaArt event={demoEvent}/> },
    { icon: '📍', titleKey: 'menu.ht2t', descKey: 'menu.ht2d', art: <MapArt lat={guessLat} lng={guessLng} onGuess={(lat, lng) => { setGuessLat(lat); setGuessLng(lng) }}/> },
    { icon: '📅', titleKey: 'menu.ht3t', descKey: 'menu.ht3d', art: <YearArt year={guessYear} onChange={setGuessYear}/> },
    { icon: '🏆', titleKey: 'menu.ht4t', descKey: 'menu.ht4d', art: <ScoreArt/> },
  ]
  const step = steps[i]
  const last = i === steps.length - 1
  const isMobile = useIsMobile()

  const dots = (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
      {steps.map((_, k) => (
        <span key={k} style={{ width: k === i ? 20 : 5, height: 5, borderRadius: 5, background: k === i ? 'var(--accent)' : 'var(--line-strong)', transition: 'width 200ms' }}/>
      ))}
    </div>
  )
  const nextBtn = (
    <button onClick={() => last ? onClose() : setI(i + 1)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14, padding: 15, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 12px 26px -8px rgba(217,119,87,0.5)' }}>
      {last ? t('menu.htStart') : t('menu.htNext')} →
    </button>
  )
  const skipBtn = !last && (
    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink-3)' }}>{t('menu.htSkip')}</button>
  )

  // ── Desktop: dvousloupcová karta (velká ukázka + text) ──
  if (!isMobile) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,15,10,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ width: 'min(980px, 94vw)', height: 'min(640px, 88vh)', background: 'var(--surface)', borderRadius: 26, overflow: 'hidden', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--line)', display: 'grid', gridTemplateColumns: '1.3fr 0.9fr' }}>
          {/* Ukázka */}
          <div style={{ position: 'relative', display: 'flex', background: 'var(--paper-200)' }}>{step.art}</div>
          {/* Text + navigace */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '26px 34px' }}>
            <div style={{ height: 30, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>{skipBtn}</div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 20, boxShadow: '0 12px 24px -8px rgba(217,119,87,0.5)' }}>{step.icon}</div>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--ink)', lineHeight: 1.15, margin: '0 0 12px', letterSpacing: '-0.01em' }}>{t(step.titleKey)}</h2>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>{t(step.descKey)}</p>
            </div>
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {dots}
              {nextBtn}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--paper-200)', display: 'flex', flexDirection: 'column', paddingTop: 'var(--safe-top)', paddingBottom: 'max(20px, var(--safe-bottom))' }}>
      <div style={{ maxWidth: 460, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', padding: '0 26px', minHeight: 0 }}>
        {/* Přeskočit */}
        <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
          {!last && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink-3)' }}>{t('menu.htSkip')}</button>}
        </div>

        {/* Ilustrace / interaktivní ukázka */}
        <div style={{ flex: 1, minHeight: 0, borderRadius: 22, overflow: 'hidden', marginBottom: 20, display: 'flex' }}>{step.art}</div>

        {/* Text */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 16px', boxShadow: '0 12px 24px -8px rgba(217,119,87,0.5)' }}>{step.icon}</div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 23, color: 'var(--ink)', lineHeight: 1.2, margin: '0 0 9px' }}>{t(step.titleKey)}</h2>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink-3)', maxWidth: 250, margin: '0 auto' }}>{t(step.descKey)}</p>
        </div>

        {/* Tečky + tlačítko */}
        <div style={{ flexShrink: 0, paddingTop: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
            {steps.map((_, k) => (
              <span key={k} style={{ width: k === i ? 20 : 5, height: 5, borderRadius: 5, background: k === i ? 'var(--accent)' : 'var(--line-strong)', transition: 'width 200ms' }}/>
            ))}
          </div>
          <button onClick={() => last ? onClose() : setI(i + 1)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14, padding: 15, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, cursor: 'pointer', boxShadow: '0 12px 26px -8px rgba(217,119,87,0.5)' }}>
            {last ? t('menu.htStart') : t('menu.htNext')} →
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Ilustrace (krok 1–3 reálně vyzkoušitelné, krok 4 náhled) ──
function PanoramaArt({ event }: { event: Event | null }) {
  return (
    <div style={{ flex: 1, position: 'relative', background: '#2a2015' }}>
      {event
        ? <PanoramaViewer url={event.panorama_url} preview={event.preview_url}/>
        : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span className="spinner" style={{ width: 24, height: 24 }}/></div>
      }
      <div style={{ position: 'absolute', left: 16, bottom: 16, background: 'rgba(20,17,14,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 20, padding: '8px 13px', color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 11, pointerEvents: 'none' }}>✥ Táhni prstem po obraze</div>
    </div>
  )
}
function MapArt({ lat, lng, onGuess }: { lat: number | null; lng: number | null; onGuess: (lat: number, lng: number) => void }) {
  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <GuessMap onGuess={onGuess} guessLat={lat} guessLng={lng}/>
    </div>
  )
}
function YearArt({ year, onChange }: { year: number; onChange: (y: number) => void }) {
  return (
    <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-3)', marginBottom: 10, textTransform: 'uppercase' }}>Tvůj tip na rok</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 48, color: 'var(--accent)' }}>{year < 0 ? `${-year} př. n. l.` : year}</div>
      </div>
      <div style={{ width: '100%', maxWidth: 280 }}>
        <YearPicker value={year} onChange={onChange}/>
      </div>
    </div>
  )
}
function ScoreArt() {
  return (
    <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}><span style={{ fontFamily: 'var(--font-serif)', fontSize: 52, color: 'var(--ink)' }}>873</span><span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink-3)' }}>/ 1000</span></div>
      <div style={{ display: 'flex', gap: 9 }}>
        {[['429 km', 'Místo'], ['2 roky', 'Rok']].map(([v, l]) => (
          <div key={l} style={{ background: 'var(--paper-200)', border: '1px solid var(--line)', borderRadius: 12, padding: '9px 13px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)' }}>{v}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--ink-3)', marginTop: 2, textTransform: 'uppercase' }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(217,119,87,0.1)', border: '1px solid rgba(217,119,87,0.28)', borderRadius: 20, padding: '7px 14px' }}>
        <span style={{ color: 'var(--accent-deep)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11.5 }}>🏅 +95 XP</span>
      </div>
    </div>
  )
}

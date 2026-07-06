import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const ACCENT_GRAD = 'linear-gradient(150deg,#d97757,#b85a3e)'

type Step = { icon: string; art: React.ReactNode; titleKey: string; descKey: string }

/** Onboarding „Jak hrát" — 4 kroky (#10). Fullscreen overlay, volá onClose po dokončení/přeskočení. */
export default function HowToPlay({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [i, setI] = useState(0)

  const steps: Step[] = [
    { icon: '🖼', titleKey: 'menu.ht1t', descKey: 'menu.ht1d', art: <PanoramaArt/> },
    { icon: '📍', titleKey: 'menu.ht2t', descKey: 'menu.ht2d', art: <MapArt/> },
    { icon: '📅', titleKey: 'menu.ht3t', descKey: 'menu.ht3d', art: <YearArt/> },
    { icon: '🏆', titleKey: 'menu.ht4t', descKey: 'menu.ht4d', art: <ScoreArt/> },
  ]
  const step = steps[i]
  const last = i === steps.length - 1

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--paper-200)', display: 'flex', flexDirection: 'column', paddingTop: 'var(--safe-top)', paddingBottom: 'max(20px, var(--safe-bottom))' }}>
      <div style={{ maxWidth: 460, width: '100%', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', padding: '0 26px', minHeight: 0 }}>
        {/* Přeskočit */}
        <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
          {!last && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink-3)' }}>{t('menu.htSkip')}</button>}
        </div>

        {/* Ilustrace */}
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

// ── Ilustrace (jednoduché, v paletě) ──
function PanoramaArt() {
  return (
    <div style={{ flex: 1, position: 'relative', background: 'linear-gradient(180deg,#CBBAA0 0%,#AD957A 40%,#7A6650 68%,#3a2e1d 100%)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(122deg,rgba(255,255,255,.05) 0 1px,transparent 1px 12px)' }}/>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(120% 75% at 50% 34%, transparent 42%, rgba(0,0,0,0.55))' }}/>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-56px,-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(251,247,240,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4033', fontSize: 19 }}>‹</div>
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(12px,-50%)', width: 44, height: 44, borderRadius: '50%', background: 'rgba(251,247,240,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4033', fontSize: 19 }}>›</div>
      <div style={{ position: 'absolute', left: 16, bottom: 16, background: 'rgba(20,17,14,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 20, padding: '8px 13px', color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 11 }}>✥ Táhni prstem po obraze</div>
    </div>
  )
}
function MapArt() {
  return (
    <div style={{ flex: 1, position: 'relative', background: 'linear-gradient(160deg,#dfe6e2 0%,#cdd8d4 45%,#a9c4cf 100%)' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '70%', background: 'linear-gradient(120deg,#e9e3d4,#dcd7c6)', clipPath: 'polygon(0 0,90% 0,74% 24%,86% 44%,62% 62%,80% 82%,52% 100%,0 100%)', opacity: 0.9 }}/>
      <div style={{ position: 'absolute', left: '50%', top: '46%', transform: 'translate(-50%,-100%)', fontSize: 40, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.35))' }}>📍</div>
    </div>
  )
}
function YearArt() {
  return (
    <div style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-3)', marginBottom: 16, textTransform: 'uppercase' }}>Tvůj tip na rok</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 52, color: 'var(--accent)', marginBottom: 24 }}>1863</div>
      <div style={{ position: 'relative', width: '100%', maxWidth: 240, height: 22 }}>
        <div style={{ position: 'absolute', top: 9, left: 0, right: 0, height: 4, borderRadius: 4, background: 'var(--paper-300)' }}/>
        <div style={{ position: 'absolute', top: 9, left: 0, width: '64%', height: 4, borderRadius: 4, background: 'linear-gradient(90deg,#d97757,#d89a54)' }}/>
        <div style={{ position: 'absolute', top: 0, left: '64%', width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', border: '3px solid var(--accent)', transform: 'translateX(-50%)' }}/>
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

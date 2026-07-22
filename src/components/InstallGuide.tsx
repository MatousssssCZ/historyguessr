import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  detectPlatform, defaultGuide, canPromptInstall, promptInstall, onInstallAvailabilityChange,
  setInstallTileHidden, type GuideKey,
} from '@/lib/pwaInstall'

const ACCENT_GRAD = 'linear-gradient(150deg,#d97757,#b85a3e)'
const GUIDES: GuideKey[] = ['ios', 'android', 'chrome', 'firefox', 'opera']

/** Ikona prohlížeče (inline SVG/emoji — bez externích assetů kvůli CSP). */
const GUIDE_ICON: Record<GuideKey, string> = {
  ios: '', android: '🤖', chrome: '🌐', firefox: '🦊', opera: '🅾️',
}

/**
 * Flow „Přidat na plochu": rozpoznaný prohlížeč → (volitelně ruční výběr) → kroky.
 * `showHideOption` = zobrazit checkbox „Již nezobrazovat na domovské stránce"
 * (jen když se flow spustí z dlaždice na domovské, ne z nastavení).
 */
export default function InstallGuide({ onClose, showHideOption }: {
  onClose: () => void
  showHideOption?: boolean
}) {
  const { t } = useTranslation()
  const [platform] = useState(() => detectPlatform())
  const [step, setStep] = useState<'intro' | 'pick' | 'steps'>('intro')
  const [guide, setGuide] = useState<GuideKey>(() => defaultGuide())
  const [hide, setHide] = useState(false)
  const [native, setNative] = useState(canPromptInstall())

  useEffect(() => onInstallAvailabilityChange(() => setNative(canPromptInstall())), [])

  function close() {
    if (showHideOption && hide) setInstallTileHidden(true)
    onClose()
  }

  const stepsFor: Record<GuideKey, string[]> = {
    ios: [t('common.instIos1'), t('common.instIos2'), t('common.instIos3')],
    android: [t('common.instAnd1'), t('common.instAnd2'), t('common.instAnd3')],
    chrome: [t('common.instCh1'), t('common.instCh2'), t('common.instCh3')],
    firefox: [t('common.instFf1'), t('common.instFf2'), t('common.instFf3')],
    opera: [t('common.instOp1'), t('common.instOp2'), t('common.instOp3')],
  }
  const headingFor: Record<GuideKey, string> = {
    ios: t('common.instHIos'), android: t('common.instHAndroid'), chrome: t('common.instHChrome'),
    firefox: t('common.instHFirefox'), opera: t('common.instHOpera'),
  }
  const labelFor: Record<GuideKey, string> = {
    ios: t('common.instBIos'), android: t('common.instBAndroid'), chrome: t('common.instBChrome'),
    firefox: t('common.instBFirefox'), opera: t('common.instBOpera'),
  }

  return (
    <div onClick={close} style={{
      position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(38,33,28,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--paper-50)', borderRadius: 24, padding: '24px 22px', maxWidth: 400, width: '100%',
        boxShadow: 'var(--shadow-xl)', maxHeight: '88dvh', overflowY: 'auto',
      }}>

        {/* ── Krok 1: rozpoznaný prohlížeč ── */}
        {step === 'intro' && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px', fontSize: 26,
              background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>⬇</div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, margin: '0 0 8px', color: 'var(--ink)', textAlign: 'center', lineHeight: 1.2 }}>
              {t('common.instTitle')}
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 18px', textAlign: 'center', lineHeight: 1.5 }}>
              {platform === 'installed' ? t('common.instInstalled') : t('common.instDetected')}
            </p>

            {platform !== 'installed' && (
              <>
                {/* Chromium umí nativní dialog — nabídni ho rovnou */}
                {native && (
                  <button onClick={async () => { const ok = await promptInstall(); if (ok) close() }} style={{
                    width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14,
                    padding: 14, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                    marginBottom: 12, boxShadow: '0 12px 26px -8px rgba(217,119,87,0.5)',
                  }}>{t('common.instNative')}</button>
                )}

                <button onClick={() => setStep('steps')} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                  background: 'rgba(217,119,87,0.10)', border: '1px solid var(--accent)', borderRadius: 16,
                  padding: '14px 16px', textAlign: 'left',
                }}>
                  <span style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: 'var(--surface)',
                    border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19,
                  }}>{GUIDE_ICON[guide]}</span>
                  <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{labelFor[guide]}</span>
                  <span style={{ color: 'var(--accent)', fontSize: 18 }}>›</span>
                </button>

                <button onClick={() => setStep('pick')} style={{
                  display: 'block', margin: '14px auto 0', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 13, color: 'var(--ink-2)', textDecoration: 'underline', fontFamily: 'var(--font-sans)',
                }}>{t('common.instOther')}</button>
              </>
            )}

            {showHideOption && (
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, paddingTop: 16,
                borderTop: '1px solid var(--line)', cursor: 'pointer', fontSize: 12.5, color: 'var(--ink-2)',
              }}>
                <input type="checkbox" checked={hide} onChange={e => setHide(e.target.checked)} style={{ width: 17, height: 17, flexShrink: 0, cursor: 'pointer' }}/>
                {t('common.instDontShow')}
              </label>
            )}

            <button onClick={close} style={{
              display: 'block', width: '100%', marginTop: showHideOption ? 12 : 18, background: 'none', border: 'none',
              cursor: 'pointer', fontSize: 14, color: 'var(--ink-3)', padding: 8, fontFamily: 'var(--font-sans)',
            }}>{t('common.instClose')}</button>
          </>
        )}

        {/* ── Krok 2: ruční výběr prohlížeče ── */}
        {step === 'pick' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <BackBtn onClick={() => setStep('intro')}/>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0, color: 'var(--ink)' }}>{t('common.instPick')}</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {GUIDES.map(g => (
                <button key={g} onClick={() => { setGuide(g); setStep('steps') }} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left',
                  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '13px 15px',
                }}>
                  <span style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'var(--paper-200)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
                  }}>{GUIDE_ICON[g]}</span>
                  <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{labelFor[g]}</span>
                  <span style={{ color: 'var(--ink-3)', fontSize: 17 }}>›</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Krok 3: konkrétní kroky ── */}
        {step === 'steps' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <BackBtn onClick={() => setStep('intro')}/>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, margin: 0, color: 'var(--ink)', lineHeight: 1.2 }}>
                {headingFor[guide]}
              </h3>
            </div>

            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {stepsFor[guide].map((s, i) => (
                <li key={i}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: 'var(--accent)', color: '#fff',
                      fontFamily: 'var(--font-mono)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--ink)', fontWeight: 500, paddingTop: 2 }}>{s}</span>
                  </div>
                  {/* Názorná ukázka u prvních dvou kroků */}
                  {i < 2 && <StepVisual guide={guide} index={i} label={t('common.instTile')}/>}
                </li>
              ))}
            </ol>

            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 18, padding: '12px 14px',
              background: 'rgba(217,119,87,0.09)', border: '1px solid rgba(217,119,87,0.25)', borderRadius: 12,
            }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>🔔</span>
              <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-2)' }}>{t('common.instNotify')}</span>
            </div>

            <button onClick={close} style={{
              width: '100%', marginTop: 18, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14,
              padding: 14, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            }}>{t('common.instDone')}</button>
          </>
        )}
      </div>
    </div>
  )
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Zpět" style={{
      width: 34, height: 34, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
      background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
    }}>←</button>
  )
}

/** Malý náhled toho, co má uživatel v prohlížeči hledat. */
function StepVisual({ guide, index, label }: { guide: GuideKey; index: number; label: string }) {
  const box: React.CSSProperties = {
    marginTop: 8, marginLeft: 35, background: 'var(--surface)', border: '1px solid var(--line)',
    borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  }
  // 1. krok = kde je tlačítko (Sdílet / ⋮ / ikona instalace)
  if (index === 0) {
    const icon = guide === 'ios' ? '⬆️' : guide === 'chrome' ? '⊕' : '⋮'
    return <div style={box}><span style={{ fontSize: 19, color: 'var(--ink-2)' }}>{icon}</span></div>
  }
  // 2. krok = položka v nabídce
  return (
    <div style={{ ...box, justifyContent: 'flex-start' }}>
      <span style={{
        width: 20, height: 20, borderRadius: 5, flexShrink: 0, border: '1px solid var(--accent)',
        color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
      }}>+</span>
      <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{label}</span>
    </div>
  )
}

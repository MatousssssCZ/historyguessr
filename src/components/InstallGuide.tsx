import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  detectPlatform, defaultGuide, canPromptInstall, promptInstall, onInstallAvailabilityChange,
  setInstallTileHidden, type GuideKey,
} from '@/lib/pwaInstall'
import {
  SafariIcon, ChromeIcon, FirefoxIcon, OperaIcon, AndroidIcon,
  DownloadIcon, ShareIosIcon, DotsIcon, InstallBarIcon, BellIcon, PlusSquareIcon,
} from '@/components/BrowserIcons'

const ACCENT_GRAD = 'linear-gradient(150deg,#d97757,#b85a3e)'
const GUIDES: GuideKey[] = ['ios', 'android', 'chrome', 'firefox', 'opera']

function GuideIcon({ guide, size = 22 }: { guide: GuideKey; size?: number }) {
  switch (guide) {
    case 'ios': return <SafariIcon size={size}/>
    case 'android': return <AndroidIcon size={size}/>
    case 'chrome': return <ChromeIcon size={size}/>
    case 'firefox': return <FirefoxIcon size={size}/>
    case 'opera': return <OperaIcon size={size}/>
  }
}

/**
 * Flow „Přidat na plochu": rozpoznaný prohlížeč → (volitelně ruční výběr) → kroky.
 * `showHideOption` = zobrazit checkbox „Již nezobrazovat na domovské stránce"
 * (jen z dlaždice na domovské, ne z nastavení). Dokončení průvodce („Hotovo")
 * dlaždici skryje vždy — uživatel už aplikaci přidal.
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

  /** Zavření křížkem/Zavřít — respektuje jen zaškrtnutý checkbox. */
  function close() {
    if (showHideOption && hide) setInstallTileHidden(true)
    onClose()
  }
  /** Dokončení průvodce — dlaždici na domovské skryj vždy. */
  function finish() {
    setInstallTileHidden(true)
    onClose()
  }

  const stepsFor: Record<GuideKey, string[]> = {
    ios: [t('common.instIos1'), t('common.instIos2'), t('common.instIos3'), t('common.instIos4')],
    android: [t('common.instAnd1'), t('common.instAnd2'), t('common.instAnd3')],
    chrome: [t('common.instCh1'), t('common.instCh2'), t('common.instCh3')],
    firefox: [t('common.instFf1'), t('common.instFf2'), t('common.instFf3')],
    opera: [t('common.instOp1'), t('common.instOp2'), t('common.instOp3')],
  }
  const noteFor: Partial<Record<GuideKey, string>> = {
    firefox: t('common.instFfNote'),
    opera: t('common.instOpNote'),
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
              width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
              background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><DownloadIcon size={26} color="#fff"/></div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, margin: '0 0 8px', color: 'var(--ink)', textAlign: 'center', lineHeight: 1.2 }}>
              {t('common.instTitle')}
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '0 0 18px', textAlign: 'center', lineHeight: 1.5 }}>
              {platform === 'installed' ? t('common.instInstalled') : t('common.instDetected')}
            </p>

            {platform !== 'installed' && (
              <>
                {native && (
                  <button onClick={async () => { const ok = await promptInstall(); if (ok) finish() }} style={{
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
                    border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><GuideIcon guide={guide}/></span>
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
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><GuideIcon guide={g} size={20}/></span>
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
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <GuideIcon guide={guide} size={20}/>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 18.5, margin: 0, color: 'var(--ink)', lineHeight: 1.2 }}>
                  {headingFor[guide]}
                </h3>
              </span>
            </div>

            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 15 }}>
              {stepsFor[guide].map((s, i) => (
                <li key={i}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: 'var(--accent)', color: '#fff',
                      fontFamily: 'var(--font-mono)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--ink)', fontWeight: 500, paddingTop: 2 }}>{s}</span>
                  </div>
                  <StepVisual guide={guide} index={i} label={t('common.instTile')}/>
                </li>
              ))}
            </ol>

            {noteFor[guide] && (
              <p style={{
                fontSize: 12, lineHeight: 1.5, color: 'var(--ink-2)', margin: '16px 0 0',
                background: 'var(--paper-200)', border: '1px solid var(--line)', borderRadius: 12, padding: '11px 13px',
              }}>{noteFor[guide]}</p>
            )}

            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 14, padding: '12px 14px',
              background: 'rgba(217,119,87,0.09)', border: '1px solid rgba(217,119,87,0.25)', borderRadius: 12,
            }}>
              <span style={{ flexShrink: 0, color: 'var(--accent-deep)', display: 'flex', paddingTop: 1 }}><BellIcon size={15}/></span>
              <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-2)' }}>{t('common.instNotify')}</span>
            </div>

            <button onClick={finish} style={{
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

/** Náhled toho, co má uživatel v prohlížeči hledat (jen u kroků, kde to dává smysl). */
function StepVisual({ guide, index, label }: { guide: GuideKey; index: number; label: string }) {
  const box: React.CSSProperties = {
    marginTop: 8, marginLeft: 35, background: 'var(--surface)', border: '1px solid var(--line)',
    borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8,
  }

  // Krok 1 = kde je ovládací prvek
  if (index === 0) {
    const icon = guide === 'ios' ? <ShareIosIcon size={19}/>
      : guide === 'chrome' ? <InstallBarIcon size={19}/>
      : <DotsIcon size={19}/>
    return <div style={{ ...box, justifyContent: 'center', color: 'var(--ink-2)' }}>{icon}</div>
  }

  // Krok s výběrem položky „Přidat na plochu" v nabídce
  const menuStep = guide === 'ios' ? 2 : 1
  if (index === menuStep) {
    return (
      <div style={box}>
        <span style={{ color: 'var(--accent)', display: 'flex', flexShrink: 0 }}><PlusSquareIcon size={18}/></span>
        <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{label}</span>
      </div>
    )
  }
  return null
}

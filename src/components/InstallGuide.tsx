import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  detectPlatform, canPromptInstall, promptInstall, onInstallAvailabilityChange,
  type InstallPlatform,
} from '@/lib/pwaInstall'

/** Návod „Přidat na plochu" přizpůsobený rozpoznanému prohlížeči. */
export default function InstallGuide({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [platform] = useState<InstallPlatform>(() => detectPlatform())
  const [native, setNative] = useState(canPromptInstall())

  // Nativní dialog může dorazit až po otevření modalu
  useEffect(() => onInstallAvailabilityChange(() => setNative(canPromptInstall())), [])

  // Kroky podle prostředí
  const steps: string[] =
    platform === 'ios-safari' ? [t('common.instIos1'), t('common.instIos2'), t('common.instIos3')]
    : platform === 'android-chromium' || platform === 'android-other' ? [t('common.instAnd1'), t('common.instAnd2'), t('common.instAnd3')]
    : platform === 'desktop-chromium' ? [t('common.instDesk1'), t('common.instDesk2')]
    : []

  const note =
    platform === 'installed' ? t('common.instInstalled')
    : platform === 'ios-other' ? t('common.instIosOther')
    : platform === 'desktop-safari' ? t('common.instSafariMac')
    : platform === 'unsupported' ? t('common.instUnsupported')
    : null

  const icon = platform === 'installed' ? '🎉' : platform === 'ios-safari' || platform === 'ios-other' ? '' : '📱'

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(38,33,28,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--paper-50)', borderRadius: 22, padding: '26px 24px', maxWidth: 420, width: '100%',
        boxShadow: 'var(--shadow-xl)', maxHeight: '86dvh', overflowY: 'auto',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px', fontSize: 26,
          background: 'linear-gradient(150deg,#d97757,#b85a3e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{icon}</div>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, margin: '0 0 6px', color: 'var(--ink)', textAlign: 'center' }}>
          {t('common.instTitle')}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: '0 0 18px', textAlign: 'center', lineHeight: 1.5 }}>
          {t('common.instRowSub')}
        </p>

        {/* Chromium umí nativní dialog — nabídni ho místo kroků */}
        {native && platform !== 'installed' && (
          <button onClick={async () => { const ok = await promptInstall(); if (ok) onClose() }} style={{
            width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14,
            padding: 14, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            marginBottom: steps.length ? 16 : 0, boxShadow: '0 12px 26px -8px rgba(217,119,87,0.5)',
          }}>{t('common.instBtn')}</button>
        )}

        {note && (
          <p style={{
            fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 4px', textAlign: 'center',
            background: 'var(--paper-200)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px',
          }}>{note}</p>
        )}

        {steps.length > 0 && (
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {steps.map((s, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: 'var(--paper-300)',
                  color: 'var(--ink-2)', fontFamily: 'var(--font-mono)', fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{i + 1}</span>
                <span style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-2)', paddingTop: 3 }}>{s}</span>
              </li>
            ))}
          </ol>
        )}

        <button onClick={onClose} style={{
          width: '100%', marginTop: 20, background: 'var(--paper-200)', border: '1px solid var(--line)',
          borderRadius: 12, padding: 12, fontSize: 14, color: 'var(--ink-2)', cursor: 'pointer',
        }}>{t('common.cancel')}</button>
      </div>
    </div>
  )
}

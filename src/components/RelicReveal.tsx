import { useTranslation } from 'react-i18next'
import { currentLocale } from '@/i18n'
import { relicModel, RARITY_META, type RevealedRelic } from '@/lib/relics'
import RelicViewer from '@/components/RelicViewer'

const GOLD_LIGHT = '#E8C88A'

/** Moment objevení relikvie (handoff 32c) — fullscreen po dokončení kampaně na 3★. */
export default function RelicReveal({ reveal, panoramaUrl, onChronicle, onClose }: {
  reveal: RevealedRelic; panoramaUrl?: string | null; onChronicle: () => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const { relic, state: rarity, stars } = reveal
  const model = relicModel(relic, rarity)
  const tone = RARITY_META[rarity].tone
  const legendary = rarity === 'legendary'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#100D0A', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {panoramaUrl && <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: `url(${panoramaUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.5 }}/>}
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 40%,rgba(176,128,64,.34),rgba(16,13,10,.96) 66%)' }}/>

      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '44px 26px', textAlign: 'center', maxWidth: 480, animation: 'scaleIn 320ms var(--ease-spring, ease) both' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: 'rgba(251,247,240,0.62)' }}>{t('kron.revealDone')} · {stars} / 3 ★</div>

        <div style={{ position: 'relative', width: 190, height: 190, margin: '26px 0 4px', borderRadius: '50%', background: 'radial-gradient(circle at 50% 45%,rgba(232,200,138,.36),transparent 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 14, borderRadius: '50%', border: '1px solid rgba(232,200,138,.34)' }}/>
          <div style={{ position: 'absolute', inset: 30, borderRadius: '50%', border: '1px solid rgba(232,200,138,.2)' }}/>
          <div style={{ position: 'relative', width: 150, height: 150 }}>
            <RelicViewer modelUrl={model} glow="gold" fallback="🏺"/>
          </div>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.24em', color: GOLD_LIGHT, marginTop: 22 }}>{t('kron.revealFound')}</div>
        <h3 style={{ margin: '12px 0 0', fontFamily: 'var(--font-serif)', fontSize: 40, lineHeight: 1.05, color: '#FBF7F0', letterSpacing: '-0.03em' }}>{relic.name}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 11 }}>
          <span style={{ padding: '4px 11px', borderRadius: 999, background: tone, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#FBF7F0' }}>{t('kron.rar_' + rarity).toUpperCase()}</span>
          {relic.year_label && <span style={{ fontSize: 13, color: 'rgba(251,247,240,0.72)' }}>{relic.year_label}</span>}
        </div>
        {relic.description && <p style={{ margin: '20px 0 0', maxWidth: 400, fontSize: 13.5, lineHeight: 1.65, color: 'rgba(251,247,240,0.8)' }}>{relic.description}</p>}

        {!legendary && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 16, padding: '9px 14px', borderRadius: 999, background: 'rgba(176,128,64,0.16)', border: '1px solid rgba(176,128,64,0.4)' }}>
            <span style={{ color: GOLD_LIGHT }}>✦</span>
            <span style={{ fontSize: 12, color: 'rgba(251,247,240,0.86)' }}>{t('kron.revealNextHint')}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 26 }}>
          <button onClick={onChronicle} style={{ display: 'flex', alignItems: 'center', gap: 9, height: 48, padding: '0 24px', borderRadius: 14, border: 'none', background: '#FBF7F0', color: '#1F1B16', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{t('kron.revealToChronicle')} →</button>
          <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 9, height: 48, padding: '0 22px', borderRadius: 14, background: 'transparent', border: '1px solid rgba(251,247,240,0.34)', color: '#FBF7F0', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>{t('common.close')}</button>
        </div>
        <span style={{ marginTop: 6, fontSize: 11, color: 'rgba(251,247,240,0.4)' }}>{relic.name} · {reveal.score.toLocaleString(currentLocale())} / {reveal.maxScore.toLocaleString(currentLocale())}</span>
      </div>
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import { eventTitle, eventDescription } from '@/lib/eventLocale'
import { formatYear } from '@/lib/scoring'
import type { Event } from '@/types/database'

/**
 * Co se vlastně stalo — ukáže se hned po odeslání tipu, ještě před skóre.
 * Nejdřív se hráč doví příběh, teprve pak řeší body.
 */
export default function EventStory({ event, onNext }: { event: Event; onNext: () => void }) {
  const { t } = useTranslation()
  const desc = eventDescription(event)
  const img = event.event_image_url

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(20,15,10,0.72)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
      animation: 'fadeIn 220ms ease both',
    }}>
      <div style={{
        background: 'var(--paper-50)', borderRadius: 24, overflow: 'hidden', width: '100%', maxWidth: 460,
        maxHeight: '90dvh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)',
        animation: 'scaleIn 260ms var(--ease-spring) both',
      }}>
        {img && (
          <img src={img} alt="" style={{ width: '100%', height: 190, objectFit: 'cover', display: 'block', flexShrink: 0 }}/>
        )}

        <div style={{ padding: '20px 22px 0', overflowY: 'auto' }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--accent-deep)', marginBottom: 7,
          }}>{t('game.histEvent')}</div>

          <h2 style={{
            fontFamily: 'var(--font-serif)', fontSize: 24, lineHeight: 1.18, letterSpacing: '-0.01em',
            color: 'var(--ink)', margin: '0 0 10px', overflowWrap: 'anywhere',
          }}>{eventTitle(event)}</h2>

          <div style={{
            display: 'inline-block', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-deep)',
            background: 'rgba(217,119,87,0.12)', border: '1px solid rgba(217,119,87,0.25)',
            borderRadius: 999, padding: '4px 12px', marginBottom: 14,
          }}>{formatYear(event.year)}</div>

          {desc && (
            <p style={{ fontSize: 14.5, lineHeight: 1.62, color: 'var(--ink-2)', margin: '0 0 18px' }}>{desc}</p>
          )}
        </div>

        <div style={{ padding: '4px 22px 20px', flexShrink: 0 }}>
          <button onClick={onNext} style={{
            width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14,
            padding: 15, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 12px 26px -8px rgba(217,119,87,0.5)',
          }}>{t('common.next')} →</button>
        </div>
      </div>
    </div>
  )
}

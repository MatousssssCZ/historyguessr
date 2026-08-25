import { useTranslation } from 'react-i18next'
import type { EventStory } from '@/types/database'
import StoryView from './StoryView'

// Čtecí okno „Dozvědět se více o události" — přes celou obrazovku, zavírací křížek.
export default function StoryModal({ eventTitle, story, onClose }: {
  eventTitle: string; story: EventStory | null; onClose: () => void
}) {
  const { t } = useTranslation()
  if (!story) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(env(safe-area-inset-top,0px) + 12px) 18px 12px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent)' }}>{t('round.learnMore')}</div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eventTitle}</div>
        </div>
        <button onClick={onClose} aria-label={t('common.close')} style={{ flex: 'none', width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '20px 18px calc(env(safe-area-inset-bottom,0px) + 28px)', maxWidth: 620, width: '100%', margin: '0 auto' }}>
        <StoryView story={story}/>
      </div>
    </div>
  )
}

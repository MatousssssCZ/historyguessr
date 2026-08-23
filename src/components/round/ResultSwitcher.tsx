import { C, F } from './RoundResult'

// Stálý přepínač výsledku — vždy dole nad CTA, na stejném místě na obou
// obrazovkách (Moje skóre ↔ prostřední = Žebříček/O události) + akce Vyzvi kamaráda.
// active='score' na výsledkové kartě, active='mid' na detailu.

export type SwitcherMid = { label: string; icon: 'trophy' | 'info'; onClick: () => void }

function Ico({ name }: { name: 'medal' | 'trophy' | 'info' | 'send' }) {
  const s = { width: 19, height: 19, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24' }
  if (name === 'medal') return <svg {...s}><path d="M8 4H6l3 6"/><path d="M16 4h2l-3 6"/><circle cx="12" cy="15" r="5"/><path d="M12 13v2l1 1"/></svg>
  if (name === 'trophy') return <svg {...s}><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 6H4.4C3.6 6 3 6.7 3 7.6 3 9.6 4.8 11 7 11"/><path d="M17 6h2.6c.8 0 1.4.7 1.4 1.6C21 9.6 19.2 11 17 11"/><path d="M12 14v2.4"/><path d="M9.5 20h5"/><path d="M10 20l.4-3.6h3.2L14 20"/></svg>
  if (name === 'info') return <svg {...s}><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6h.01"/></svg>
  return <svg {...s}><path d="M4 12l16-7-7 16-2.5-6.5L4 12z"/></svg>
}

export default function ResultSwitcher({ active, onScore, scoreLabel, mid, onChallenge, challengeLabel }: {
  active: 'score' | 'mid'
  onScore: () => void
  scoreLabel: string
  mid?: SwitcherMid
  onChallenge?: () => void
  challengeLabel?: string
}) {
  const cell = (on: boolean, onClick: () => void, icon: 'medal' | 'trophy' | 'info' | 'send', label: string, key: string) => (
    <button key={key} type="button" onClick={onClick} style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '10px 4px', minHeight: 58,
      border: on ? 0 : `1px solid ${C.lineStrong}`, borderRadius: 14, cursor: 'pointer',
      background: on ? C.ink : C.surface, color: on ? C.surface : C.ink2, font: `600 10px ${F.ui}`,
    }}>
      <span style={{ display: 'flex', color: on ? C.surface : C.accent }}><Ico name={icon}/></span>
      <span>{label}</span>
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      {cell(active === 'score', onScore, 'medal', scoreLabel, 'score')}
      {mid && cell(active === 'mid', mid.onClick, mid.icon, mid.label, 'mid')}
      {onChallenge && cell(false, onChallenge, 'send', challengeLabel || '', 'ch')}
    </div>
  )
}

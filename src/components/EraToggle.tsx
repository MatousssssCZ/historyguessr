import { useTranslation } from 'react-i18next'

// Segmentový přepínač éry: „př. n. l." | „n. l." — jasnější než psaní znaménka
// (na mobilní číselné klávesnici není + ani −).
export default function EraToggle({ bc, onSelect }: { bc: boolean; onSelect: (bc: boolean) => void }) {
  const { t } = useTranslation()
  const seg = (active: boolean, color: string, label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} style={{
      flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
      fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, letterSpacing: '0.03em',
      background: active ? color : 'transparent',
      color: active ? '#fff' : 'var(--ink-3)',
      boxShadow: active ? 'var(--shadow-sm)' : 'none', transition: 'all 150ms',
    }}>{label}</button>
  )
  return (
    <div style={{ display: 'flex', gap: 3, background: 'var(--paper-200)', borderRadius: 10, padding: 3 }}>
      {seg(bc, '#5a8fb5', t('game.bcShort'), () => onSelect(true))}
      {seg(!bc, 'var(--accent)', t('game.adShort'), () => onSelect(false))}
    </div>
  )
}

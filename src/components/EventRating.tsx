import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { addEventRating } from '@/lib/supabase'

// Hodnocení události (1–5 hvězd). Klik jen VYBERE; odešle se až při odchodu
// z obrazovky (cleanup efekt), aby šlo výběr měnit. Akcentní barva odlišuje
// od zlatých kampaňových hvězd. Sdílené napříč výsledkovými obrazovkami.
export default function EventRating({ eventId, compact = false, label }: {
  eventId: string; compact?: boolean; label?: string
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(0)
  const [hover, setHover] = useState(0)
  const selectedRef = useRef(0)
  const sentRef = useRef(false)

  useEffect(() => {
    return () => {
      if (!sentRef.current && selectedRef.current > 0) {
        sentRef.current = true
        addEventRating(eventId, selectedRef.current).catch(() => {})
      }
    }
  }, [eventId])

  function pick(i: number) { setSelected(i); selectedRef.current = i }
  const size = compact ? 22 : 28
  const text = label ?? t('round.rateEvent')

  const stars = (
    <div style={{ display: 'flex', gap: compact ? 2 : 4 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => pick(i)} aria-label={`${i}`} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontSize: size, padding: compact ? '1px 2px' : '2px 4px', lineHeight: 1,
          color: i <= (hover || selected) ? 'var(--accent)' : 'var(--paper-300)',
          transition: 'color 100ms, transform 100ms', transform: i <= hover ? 'scale(1.18)' : 'scale(1)',
        }}>★</button>
      ))}
    </div>
  )

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{text}</span>
        {stars}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{text}</div>
      {stars}
    </div>
  )
}

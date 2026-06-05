import type { CSSProperties } from 'react'

interface BackButtonProps {
  onClick: () => void
  label: string
  /** 'dark' = pro tmavé obrazovky (panorama, Daily, hra); jinak světlé/feature pozadí */
  tone?: 'light' | 'dark'
  style?: CSSProperties
}

// Jednotný, výrazný návratový prvek — akcentová barva + rámeček + šipka,
// aby byl vidět „na první dobrou" na světlém i tmavém pozadí.
export default function BackButton({ onClick, label, tone = 'light', style }: BackButtonProps) {
  const dark = tone === 'dark'
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '9px 16px 9px 13px',
        borderRadius: 10,
        fontFamily: 'var(--font-sans)',
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        color: dark ? '#fff' : 'var(--accent-deep)',
        background: dark ? 'var(--accent)' : 'rgba(217,119,87,0.12)',
        border: dark ? '1.5px solid var(--accent)' : '1.5px solid var(--accent)',
        boxShadow: dark ? '0 2px 10px rgba(217,119,87,0.35)' : 'none',
        transition: 'background 140ms, transform 140ms',
        ...style,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = dark ? 'var(--accent-deep)' : 'rgba(217,119,87,0.2)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = dark ? 'var(--accent)' : 'rgba(217,119,87,0.12)'
      }}
    >
      <span style={{ fontSize: 17, lineHeight: 1, marginTop: -1 }} aria-hidden>←</span>
      {label}
    </button>
  )
}

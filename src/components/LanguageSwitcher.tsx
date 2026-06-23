import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, setLanguage } from '@/i18n'

const FLAGS: Record<string, string> = { cs: '🇨🇿', en: '🇬🇧', de: '🇩🇪' }

/** Přepínač jazyka jako dropdown s vlaječkami.
 *  variant="dark"  → na feature ploše (tématické tokeny)
 *  variant="light" → na běžné (flipující) ploše */
export default function LanguageSwitcher({ variant = 'light' }: { variant?: 'dark' | 'light' }) {
  const { i18n } = useTranslation()
  const cur = (i18n.language || 'en').slice(0, 2)
  const onFeature = variant === 'dark'
  const fg = onFeature ? 'var(--feature-fg)' : 'var(--ink)'
  const idle = onFeature ? 'var(--feature-fg2)' : 'var(--ink-3)'
  const border = onFeature ? 'var(--feature-line)' : 'var(--line-strong)'
  const surface = onFeature ? 'var(--feature-bg)' : 'var(--surface)'

  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const current = LANGUAGES.find(l => l.code === cur) ?? LANGUAGES[0]

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={current.label}
        aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 9px', borderRadius: 8, cursor: 'pointer',
          border: `1px solid ${border}`, background: 'transparent',
          fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.04em', color: fg,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>{FLAGS[current.code]}</span>
        <span>{current.short}</span>
        <span style={{ fontSize: 9, color: idle, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 1000,
          minWidth: 132, padding: 4, borderRadius: 10,
          background: surface, border: `1px solid ${border}`,
          boxShadow: '0 8px 24px rgba(42,31,23,0.18)',
        }}>
          {LANGUAGES.map(l => {
            const active = l.code === cur
            return (
              <button
                key={l.code}
                onClick={() => { setLanguage(l.code); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '8px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  textAlign: 'left', fontSize: 13,
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#fff' : fg,
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = onFeature ? 'var(--feature-line)' : 'var(--paper-200)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>{FLAGS[l.code]}</span>
                <span style={{ flex: 1 }}>{l.label}</span>
                {active && <span style={{ fontSize: 12 }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

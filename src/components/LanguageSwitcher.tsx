import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, setLanguage } from '@/i18n'

const FLAGS: Record<string, string> = { cs: '🇨🇿', en: '🇬🇧', de: '🇩🇪' }

/** Přepínač jazyka jako dropdown s vlaječkami.
 *  variant="dark"  → na feature ploše (tématické tokeny)
 *  variant="light" → na běžné (flipující) ploše
 *
 *  Rozbalená nabídka se renderuje přes PORTAL do body (position:fixed), aby ji
 *  nezachytil stacking context rodiče (na mobilu se jinak proklikávala do prvků
 *  pod ní, např. žebříčku). */
export default function LanguageSwitcher({ variant = 'light' }: { variant?: 'dark' | 'light' | 'glass' }) {
  const { i18n } = useTranslation()
  const cur = (i18n.language || 'en').slice(0, 2)
  const glass = variant === 'glass'
  const onFeature = variant === 'dark'
  const fg = glass ? '#f5f1e8' : onFeature ? 'var(--feature-fg)' : 'var(--ink)'
  const idle = glass ? 'rgba(245,241,232,0.65)' : onFeature ? 'var(--feature-fg2)' : 'var(--ink-3)'
  const border = glass ? 'rgba(245,241,232,0.28)' : onFeature ? 'var(--feature-line)' : 'var(--line-strong)'
  const surface = glass ? 'rgba(30,23,15,0.96)' : onFeature ? 'var(--feature-bg)' : 'var(--surface)'

  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) })
  }, [])

  const toggle = () => { if (!open) place(); setOpen(o => !o) }

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const reposition = () => setOpen(false)   // při scrollu/resize radši zavřít
    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open])

  const current = LANGUAGES.find(l => l.code === cur) ?? LANGUAGES[0]

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label={current.label}
        aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: glass ? '8px 13px' : '5px 9px', borderRadius: glass ? 999 : 8, cursor: 'pointer',
          border: `1px solid ${border}`,
          background: glass ? 'rgba(245,241,232,0.14)' : 'transparent',
          backdropFilter: glass ? 'blur(10px)' : undefined,
          WebkitBackdropFilter: glass ? 'blur(10px)' : undefined,
          fontFamily: 'var(--font-mono)', fontSize: glass ? 12 : 11, letterSpacing: '0.04em', color: fg,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>{FLAGS[current.code]}</span>
        <span>{current.short}</span>
        <span style={{ fontSize: 9, color: idle, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>▾</span>
      </button>

      {open && pos && createPortal(
        <div ref={menuRef} style={{
          position: 'fixed', top: pos.top, right: pos.right, zIndex: 4000,
          minWidth: 148, padding: 4, borderRadius: 10,
          background: surface, border: `1px solid ${border}`,
          boxShadow: '0 12px 32px rgba(42,31,23,0.35)',
        }}>
          {LANGUAGES.map(l => {
            const active = l.code === cur
            return (
              <button
                key={l.code}
                onClick={() => { setLanguage(l.code); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '11px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  textAlign: 'left', fontSize: 14,
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
        </div>,
        document.body,
      )}
    </div>
  )
}

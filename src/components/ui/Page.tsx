import React from 'react'
import DesktopSidebar from '@/components/DesktopSidebar'
import { useIsMobile } from '@/hooks/useIsMobile'

// ── Sdílený design-kit „nabídkových" stránek (styl domovské obrazovky) ──
// Dvousloupcový desktop se sidebarem, jednotná hlavička, karty. Responzivní:
// na mobilu se sidebar skryje a padding se zmenší (spodní MobileNav si řeší
// každá stránka sama). Barvy/fonty přes CSS proměnné → funguje i tmavý režim.

const F = { serif: 'var(--font-serif)', sans: 'var(--font-sans)', mono: 'var(--font-mono)' }

export function PageShell({ children, maxWidth = 1180, sidebarStreak }: {
  children: React.ReactNode; maxWidth?: number; sidebarStreak?: number
}) {
  const isMobile = useIsMobile()
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', display: 'flex' }}>
      <DesktopSidebar streak={sidebarStreak}/>
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', paddingTop: isMobile ? 'var(--safe-top)' : 0, paddingBottom: isMobile ? 'var(--nav-space)' : 0 }}>
        <div style={{ maxWidth, margin: '0 auto', padding: isMobile ? '14px 16px 20px' : '30px 40px 48px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

export function PageHeader({ eyebrow, title, actions, onBack }: {
  eyebrow?: string; title: string; actions?: React.ReactNode; onBack?: () => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {onBack && (
          <button onClick={onBack} aria-label="←" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>←</button>
        )}
        <div style={{ minWidth: 0 }}>
          {eyebrow && <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.16em', color: 'var(--accent-deep)', marginBottom: 8, textTransform: 'uppercase' }}>{eyebrow}</div>}
          <h1 style={{ fontFamily: F.serif, fontSize: 30, color: 'var(--ink)', lineHeight: 1.05, margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
        </div>
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}

export function TwoColumn({ children, rail, railWidth = 300 }: {
  children: React.ReactNode; rail?: React.ReactNode; railWidth?: number
}) {
  const isMobile = useIsMobile()
  if (isMobile || !rail) return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}{rail}</div>
  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      <aside style={{ width: railWidth, flex: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>{rail}</aside>
    </div>
  )
}

export function Card({ children, style, onClick }: {
  children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void
}) {
  const base: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '16px 18px' }
  if (onClick) return <button onClick={onClick} style={{ ...base, width: '100%', textAlign: 'left', cursor: 'pointer', ...style }}>{children}</button>
  return <div style={{ ...base, ...style }}>{children}</div>
}

export function CardHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 }}>
      <span style={{ fontFamily: F.serif, fontSize: 16, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{title}</span>
      {action}
    </div>
  )
}

// Malý mono „eyebrow" nadpis sekce uvnitř obsahu.
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontFamily: F.mono, fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-3)', margin: '18px 0 13px', textTransform: 'uppercase', ...style }}>{children}</div>
}

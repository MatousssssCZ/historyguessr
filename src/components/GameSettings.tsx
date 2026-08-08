import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

// Sdílené prvky nastavení hry — používá solo předsálí (PreGameLobby) i
// multiplayer lobby, aby zůstaly konzistentní. Pergamen styl.

export const CATEGORY_IDS = ['war', 'moments', 'places', 'inventions', 'art', 'sports', 'mysteries', 'disasters'] as const

/** Sekce nastavení: karta s (volitelným) popiskem a tenkou linkou. */
export function SettingSection({ label, children, style }: { label?: string; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, padding: '18px 20px', ...style }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>{label}</span>
          <span style={{ flex: 1, height: 1, background: 'rgba(42,31,23,0.08)' }}/>
        </div>
      )}
      {children}
    </div>
  )
}

/** Menší popisek uvnitř karty (např. „Počet kol" nad segmentem). */
export function SubLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 9 }}>
      {children}
    </div>
  )
}

/** Segmentovaný přepínač (počet kol, čas na kolo). */
export function Segmented<T extends string | number>({ value, options, onChange }: {
  value: T; options: readonly { v: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', background: 'var(--paper-200)', borderRadius: 12, padding: 4, gap: 4 }}>
      {options.map(o => {
        const on = value === o.v
        return (
          <button key={String(o.v)} onClick={() => onChange(o.v)} style={{
            flex: 1, border: 'none', padding: '10px 0', borderRadius: 9, cursor: 'pointer',
            fontFamily: 'var(--font-serif)', fontSize: 15,
            background: on ? 'var(--paper-50)' : 'transparent',
            color: on ? 'var(--ink)' : 'var(--ink-2)', fontWeight: on ? 500 : 400,
            boxShadow: on ? '0 1px 4px rgba(42,31,23,0.08)' : 'none',
          }}>{o.label}</button>
        )
      })}
    </div>
  )
}

/** Chipy kategorií (label z i18n už obsahuje ikonu). */
export function CategoryChips({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {CATEGORY_IDS.map(id => {
        const on = selected.includes(id)
        return (
          <button key={id} onClick={() => onToggle(id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 999,
            fontSize: 13, cursor: 'pointer',
            border: `1px solid ${on ? 'var(--accent)' : 'var(--line-strong)'}`,
            background: on ? 'var(--accent)' : 'transparent',
            color: on ? '#fff' : 'var(--ink-2)',
          }}>{t('cat.' + id)}</button>
        )
      })}
    </div>
  )
}

/** Pilulka s počtem odpovídajících událostí (zelená = OK, oranžová = málo).
 *  Text dodá volající (každá stránka má vlastní znění). */
export function EventCountPill({ ok, children, style }: { ok: boolean; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14,
      background: ok ? 'rgba(92,148,104,0.14)' : 'rgba(192,57,43,0.12)',
      color: ok ? 'var(--success-deep, #3f7a4d)' : 'var(--danger)',
      borderRadius: 999, padding: '5px 12px', fontFamily: 'var(--font-mono)', fontSize: 11.5, ...style,
    }}>
      {children}
    </div>
  )
}

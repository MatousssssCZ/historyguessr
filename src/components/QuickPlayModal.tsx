import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCandidateEvents } from '@/lib/supabase'
import { CATEGORY_IDS, CatIcon, catLabel } from '@/components/GameSettings'

// Rychlá hra — výběr kategorií (5 kol). Prázdný výběr = všechny kategorie.
// onStart dostane vybrané kategorie (může být prázdné pole).
export default function QuickPlayModal({ onClose, onStart }: {
  onClose: () => void
  onStart: (categories: string[]) => void
}) {
  const { t } = useTranslation()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    getCandidateEvents({ categories: [] }).then(list => {
      const m: Record<string, number> = {}
      for (const e of list) if (e.category) m[e.category] = (m[e.category] ?? 0) + 1
      setCounts(m); setTotal(list.length)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const pool = selected.length ? selected.reduce((a, id) => a + (counts[id] ?? 0), 0) : total

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(10,8,6,.74)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
    }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{
        width: '100%', maxWidth: 620, maxHeight: '92dvh', overflowY: 'auto',
        background: '#1e1712', border: '1px solid rgba(251,247,240,.11)', borderRadius: 22,
        boxShadow: '0 40px 90px -30px rgba(0,0,0,.75)', color: '#FBF7F0', padding: 26,
      }}>
        {/* Hlavička */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--gold, #E8C88A)', marginBottom: 8 }}>{t('menu.quickEyebrow')}</div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 26, letterSpacing: '-0.02em', margin: '0 0 8px', lineHeight: 1.08 }}>{t('menu.quickTitle')}</h2>
            <p style={{ fontSize: 13.5, color: 'rgba(251,247,240,.6)', margin: 0, lineHeight: 1.45, maxWidth: 420 }}>{t('menu.quickSub')}</p>
          </div>
          <button onClick={onClose} aria-label="Zavřít" style={{
            flexShrink: 0, width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(251,247,240,.16)',
            background: 'rgba(251,247,240,.06)', color: '#FBF7F0', cursor: 'pointer', fontSize: 15, lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Kategorie */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 12px', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(251,247,240,.5)' }}>{t('menu.quickCatsHint')}</span>
          {selected.length > 0 && (
            <button onClick={() => setSelected([])} style={{
              flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 999,
              border: '1px solid rgba(251,247,240,.16)', background: 'rgba(251,247,240,.06)', color: 'rgba(251,247,240,.8)',
              cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-sans)', fontWeight: 600,
            }}>↺ {t('menu.quickClear')}</button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {CATEGORY_IDS.map(id => {
            const on = selected.includes(id)
            return (
              <button key={id} onClick={() => toggle(id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', width: '100%', textAlign: 'left', cursor: 'pointer',
                borderRadius: 13, transition: 'background .12s, border-color .12s',
                background: on ? 'rgba(217,119,87,.16)' : 'rgba(251,247,240,.04)',
                border: `1px solid ${on ? 'var(--accent, #d97757)' : 'rgba(251,247,240,.09)'}`,
                color: '#FBF7F0',
              }}>
                <span style={{ display: 'flex', color: on ? 'var(--accent, #d97757)' : 'rgba(251,247,240,.7)' }}><CatIcon id={id} size={17}/></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14 }}>{catLabel(t('cat.' + id))}</span>
                  <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(251,247,240,.45)', marginTop: 1 }}>{counts[id] ?? 0} {t('menu.quickEvents')}</span>
                </span>
                <span style={{
                  flexShrink: 0, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1.5px solid ${on ? 'var(--accent, #d97757)' : 'rgba(251,247,240,.25)'}`,
                  background: on ? 'var(--accent, #d97757)' : 'transparent', color: '#fff', fontSize: 12,
                }}>{on ? '✓' : ''}</span>
              </button>
            )
          })}
        </div>

        {/* Patička */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginTop: 22, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(251,247,240,.45)' }}>{t('menu.quickSelected', { n: selected.length, total: CATEGORY_IDS.length })}</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5, color: 'rgba(251,247,240,.85)', marginTop: 3 }}>{t('menu.quickPool', { n: pool })}</div>
          </div>
          <button onClick={() => onStart(selected)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 9, padding: '14px 24px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#d97757,#c15c3d)', color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15,
            boxShadow: '0 18px 40px -18px rgba(190,98,64,.9)',
          }}>{t('menu.quickStart')} →</button>
        </div>
      </div>
    </div>
  )
}

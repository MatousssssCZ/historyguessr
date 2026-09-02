import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCandidateEvents } from '@/lib/supabase'
import { CATEGORY_IDS, CatIcon, catLabel } from '@/components/GameSettings'
import { useIsMobile } from '@/hooks/useIsMobile'

const ACCENT = '#d97757'
const ROUND_OPTIONS = [1, 3, 5]

// Rychlá hra — výběr počtu kol (1/3/5) a kategorií. Prázdný výběr = všechny.
// onStart dostane vybrané kategorie a počet kol.
export default function QuickPlayModal({ onClose, onStart }: {
  onClose: () => void
  onStart: (categories: string[], rounds: number) => void
}) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const [rounds, setRounds] = useState(5)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    getCandidateEvents({ categories: [] }).then(list => {
      const m: Record<string, number> = {}
      for (const e of list) if (e.category) m[e.category] = (m[e.category] ?? 0) + 1
      setCounts(m); setTotal(list.length); setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const order = useMemo(
    () => loaded ? [...CATEGORY_IDS].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0)) : CATEGORY_IDS,
    [loaded, counts],
  )
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const allSelected = selected.length === CATEGORY_IDS.length
  const pool = selected.length ? selected.reduce((a, id) => a + (counts[id] ?? 0), 0) : total
  const roundWord = (n: number) => t(n === 1 ? 'menu.quickRoundOne' : n < 5 ? 'menu.quickRoundFew' : 'menu.quickRoundMany')

  // ── Přepínač počtu kol ─────────────────────────────────────
  const roundPicker = (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(251,247,240,.5)', marginBottom: 8 }}>{t('menu.quickRoundsLabel')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {ROUND_OPTIONS.map(n => {
          const on = rounds === n
          return (
            <button key={n} onClick={() => setRounds(n)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: isMobile ? '11px 0' : '13px 0', borderRadius: 12, cursor: 'pointer',
              background: on ? ACCENT : 'rgba(251,247,240,.05)',
              border: `1px solid ${on ? ACCENT : 'rgba(251,247,240,.1)'}`,
              color: '#FBF7F0', boxShadow: on ? '0 12px 26px -14px rgba(190,90,62,.9)' : 'none',
            }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 500, lineHeight: 1 }}>{n}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: on ? 'rgba(255,255,255,.85)' : 'rgba(251,247,240,.5)' }}>{roundWord(n)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  // ── Dlaždice kategorie ─────────────────────────────────────
  const tile = (id: string) => {
    const on = selected.includes(id)
    const label = isMobile ? t('catShort.' + id) : catLabel(t('cat.' + id))
    return (
      <button key={id} onClick={() => toggle(id)} style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: isMobile ? '12px 13px' : '15px 16px', width: '100%', textAlign: 'left', cursor: 'pointer',
        borderRadius: 14, transition: 'background .12s, border-color .12s',
        background: on ? 'rgba(217,119,87,.17)' : 'rgba(251,247,240,.04)',
        border: `1px solid ${on ? ACCENT : 'rgba(251,247,240,.09)'}`,
        color: '#FBF7F0',
      }}>
        <span style={{ flexShrink: 0, display: 'flex', color: on ? ACCENT : 'rgba(251,247,240,.62)' }}><CatIcon id={id} size={isMobile ? 18 : 20}/></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: isMobile ? 14 : 15, lineHeight: 1.15 }}>{label}</span>
          {loaded
            ? <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: isMobile ? 12 : 11.5, color: 'rgba(251,247,240,.45)', marginTop: 2 }}>{counts[id] ?? 0}{isMobile ? '' : ` ${t('menu.quickEvents')}`}</span>
            : <span style={{ display: 'block', width: 44, height: 8, borderRadius: 4, background: 'rgba(251,247,240,.1)', marginTop: 4 }} aria-hidden="true"/>}
        </span>
        <span style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1.5px solid ${on ? ACCENT : 'rgba(251,247,240,.28)'}`,
          background: on ? ACCENT : 'transparent', color: '#fff', fontSize: 12, fontWeight: 700,
        }}>{on ? '✓' : ''}</span>
      </button>
    )
  }

  const grid = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: isMobile ? 9 : 12 }}>
      {order.map(tile)}
    </div>
  )

  const startBtn = (full: boolean) => (
    <button onClick={() => onStart(selected, rounds)} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: full ? '100%' : undefined,
      padding: full ? 16 : '15px 28px', borderRadius: 15, border: 'none', cursor: 'pointer',
      background: 'linear-gradient(135deg,#d97757,#c15c3d)', color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15.5,
      boxShadow: '0 18px 40px -18px rgba(190,98,62,.9)',
    }}>{t('menu.quickStart')} →</button>
  )

  const closeBtn = (
    <button onClick={onClose} aria-label="Zavřít" style={{
      flexShrink: 0, width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(251,247,240,.16)',
      background: 'rgba(251,247,240,.06)', color: '#FBF7F0', cursor: 'pointer', fontSize: 15, lineHeight: 1,
    }}>✕</button>
  )

  const selAllBtn = (
    <button onClick={() => setSelected(allSelected ? [] : [...CATEGORY_IDS])} style={{
      background: 'none', border: 'none', cursor: 'pointer', color: ACCENT, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13,
    }}>{allSelected ? t('menu.quickClear') : t('menu.quickSelectAll')}</button>
  )

  const footerStat = (
    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'rgba(251,247,240,.7)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span aria-hidden="true">🔀</span> {t('menu.quickPool', { r: rounds, n: pool })}
    </span>
  )

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(10,8,6,.74)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      padding: isMobile ? '10px' : '24px',
    }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" style={{
        width: '100%', maxWidth: isMobile ? 460 : 1000, maxHeight: '94dvh', overflowY: 'auto',
        background: '#1c1610', border: '1px solid rgba(251,247,240,.11)', borderRadius: 24,
        boxShadow: '0 40px 90px -30px rgba(0,0,0,.75)', color: '#FBF7F0', padding: isMobile ? 20 : 30,
        display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 22,
      }}>

        {isMobile ? (
          // ═══════════ MOBIL ═══════════
          <>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 24, letterSpacing: '-0.01em', margin: 0 }}>{t('menu.quickEyebrow')}</h2>
              <div style={{ position: 'absolute', right: 0 }}>{closeBtn}</div>
            </div>
            {roundPicker}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(251,247,240,.5)' }}>{t('menu.quickThemes')}</span>
                {selAllBtn}
              </div>
              {grid}
            </div>
            {loaded && <div style={{ textAlign: 'left' }}>{footerStat}</div>}
            {startBtn(true)}
          </>
        ) : (
          // ═══════════ DESKTOP ═══════════
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: ACCENT, marginBottom: 8 }}>{t('menu.quickEyebrow')}</div>
                <h2 style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 30, letterSpacing: '-0.02em', margin: '0 0 8px', lineHeight: 1.05 }}>{t('menu.quickTitle')}</h2>
                <p style={{ fontSize: 14, color: 'rgba(251,247,240,.6)', margin: 0, lineHeight: 1.45 }}>{t('menu.quickSub')}</p>
              </div>
              {closeBtn}
            </div>
            <div style={{ height: 1, background: 'rgba(251,247,240,.1)' }}/>
            {roundPicker}
            <div style={{ height: 1, background: 'rgba(251,247,240,.1)' }}/>
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(251,247,240,.5)', marginBottom: 4 }}>{t('menu.quickCatsLabel')}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'rgba(251,247,240,.55)' }}>{t('menu.quickCatsHint')}</div>
                </div>
                {selected.length > 0 && (
                  <button onClick={() => setSelected([])} style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 999,
                    border: '1px solid rgba(251,247,240,.16)', background: 'rgba(251,247,240,.06)', color: 'rgba(251,247,240,.8)',
                    cursor: 'pointer', fontSize: 12.5, fontFamily: 'var(--font-sans)', fontWeight: 600,
                  }}>↺ {t('menu.quickClear')}</button>
                )}
              </div>
              {grid}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, color: 'rgba(251,247,240,.6)' }}>
                  {selected.length === 0 ? t('menu.quickAllCats') : t('menu.quickSelected', { n: selected.length, total: CATEGORY_IDS.length })}
                </div>
                {loaded && <div style={{ marginTop: 4 }}>{footerStat}</div>}
              </div>
              {startBtn(false)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

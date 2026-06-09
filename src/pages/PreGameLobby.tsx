import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { eventTitle, eventDescription } from '@/lib/eventLocale'
import { useNavigate } from 'react-router-dom'
import { getCandidateEvents, type CandidateEvent } from '@/lib/supabase'
import { formatYear } from '@/lib/scoring'
import BackButton from '@/components/BackButton'
import YearRange, { YEAR_MIN, YEAR_MAX } from '@/components/YearRange'
import type { GameOptions } from '@/hooks/useGame'

const CATEGORIES = [
  { id: 'war', label: '⚔ Války' },
  { id: 'moments', label: '📜 Historické okamžiky' },
  { id: 'places', label: '🧭 Objevy míst' },
  { id: 'inventions', label: '💡 Vynálezy' },
  { id: 'art', label: '🎨 Umění' },
  { id: 'sports', label: '🏅 Sportovní okamžiky' },
  { id: 'mysteries', label: '🔮 Záhady a legendy' },
  { id: 'disasters', label: '🌋 Katastrofy' },
]
const CAT_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]))

const ROUND_OPTIONS = [3, 5, 10]

type SortBy = 'year' | 'title'

export default function PreGameLobbyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [rounds, setRounds] = useState(5)
  const [categories, setCategories] = useState<string[]>([])
  const [yearFrom, setYearFrom] = useState(YEAR_MIN)
  const [yearTo, setYearTo] = useState(YEAR_MAX)

  const [candidates, setCandidates] = useState<CandidateEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('year')

  // Načti kandidáty při změně filtrů
  useEffect(() => {
    let alive = true
    setLoading(true)
    const lo = Math.min(yearFrom, yearTo)
    const hi = Math.max(yearFrom, yearTo)
    getCandidateEvents({ categories, yearFrom: lo, yearTo: hi })
      .then(list => {
        if (!alive) return
        setCandidates(list)
        // Zahoď vyloučení, které už neodpovídá filtru
        setExcluded(prev => {
          const ids = new Set(list.map(e => e.id))
          const next = new Set<string>()
          prev.forEach(id => { if (ids.has(id)) next.add(id) })
          return next
        })
        setLoading(false)
      })
      .catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [categories, yearFrom, yearTo])

  const sortedCandidates = useMemo(() => {
    const arr = [...candidates]
    if (sortBy === 'year') arr.sort((a, b) => a.year - b.year)
    else arr.sort((a, b) => a.title.localeCompare(b.title, 'cs'))
    return arr
  }, [candidates, sortBy])

  const availableCount = candidates.length - excluded.size
  const enough = availableCount >= rounds

  function toggleCategory(id: string) {
    setCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }
  function toggleExclude(id: string) {
    setExcluded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function start() {
    if (!enough) return
    const options: GameOptions = {
      rounds,
      categories,
      yearFrom: Math.min(yearFrom, yearTo),
      yearTo: Math.max(yearFrom, yearTo),
      excludeIds: [...excluded],
    }
    navigate('/game', { state: options })
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-100)', display: 'flex', flexDirection: 'column', paddingBottom: 'max(16px, var(--safe-bottom))' }}>
      {/* Hlavička */}
      <div style={{ position: 'relative', background: 'var(--feature-bg)', padding: 'calc(var(--safe-top) + 18px) 22px 22px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -60, right: -50, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,87,0.16), transparent 70%)', pointerEvents: 'none' }}/>
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <BackButton onClick={() => navigate('/menu')} label={t('pregame.backToMenu')} />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent-soft)', position: 'relative' }}>{t('pregame.mode')}</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--feature-fg)', letterSpacing: '-0.02em', margin: '6px 0 0', position: 'relative' }}>{t('pregame.title')}</h1>
      </div>

      {/* Obsah */}
      <div style={{ flex: 1, padding: '20px 20px 0', maxWidth: 560, width: '100%', margin: '0 auto' }}>
        {/* Počet kol */}
        <Section label={t('pregame.rounds')}>
          <div style={{ display: 'flex', background: 'var(--paper-200)', borderRadius: 12, padding: 4, gap: 4 }}>
            {ROUND_OPTIONS.map(r => (
              <button key={r} onClick={() => setRounds(r)} style={{
                flex: 1, border: 'none', padding: '9px 0', borderRadius: 9, cursor: 'pointer',
                fontFamily: 'var(--font-serif)', fontSize: 15,
                background: rounds === r ? 'var(--paper-50)' : 'transparent',
                color: rounds === r ? 'var(--ink)' : 'var(--ink-2)',
                fontWeight: rounds === r ? 500 : 400,
                boxShadow: rounds === r ? '0 1px 4px rgba(42,31,23,0.08)' : 'none',
              }}>{r}</button>
            ))}
          </div>
        </Section>

        {/* Kategorie */}
        <Section label={t('pregame.categories')} hint={t('pregame.noFilter')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(cat => {
              const on = categories.includes(cat.id)
              return (
                <button key={cat.id} onClick={() => toggleCategory(cat.id)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 999,
                  fontSize: 13, cursor: 'pointer',
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--line-strong)'}`,
                  background: on ? 'var(--accent)' : 'transparent',
                  color: on ? '#fff' : 'var(--ink-2)',
                }}>{t('cat.' + cat.id)}</button>
              )
            })}
          </div>
        </Section>

        {/* Rozsah let */}
        <Section label={t('pregame.yearRange')}>
          <YearRange from={yearFrom} to={yearTo} onFrom={setYearFrom} onTo={setYearTo}/>
        </Section>

        {/* Počítadlo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 12,
          padding: '11px 14px', borderRadius: 11, marginBottom: 18,
          background: enough ? 'var(--success-soft)' : 'rgba(192,57,43,0.08)',
          color: enough ? 'var(--success-deep)' : '#c0392b',
        }}>
          {loading ? '…' : enough
            ? <><span>✓</span> {t('pregame.inGame', { count: availableCount })}{excluded.size > 0 && <span style={{ color: 'var(--ink-3)' }}> · {t('pregame.excluded', { n: excluded.size })}</span>}</>
            : <><span>⚠</span> {t('pregame.notEnough', { n: availableCount, min: rounds })}</>}
        </div>

        {/* Vyladit události */}
        <div style={{ border: '1px solid var(--line-strong)', borderRadius: 12, overflow: 'hidden', marginBottom: 18 }}>
          <button onClick={() => setExpanded(e => !e)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
            padding: '14px', background: 'var(--surface)', border: 'none', cursor: 'pointer',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>🗂</span>
              <span style={{ fontSize: 14.5, color: 'var(--ink)', fontWeight: 500 }}>{t('pregame.tune')}</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
                {excluded.size > 0 ? t('pregame.away', { n: excluded.size }) : candidates.length}
              </span>
              <span style={{ color: 'var(--ink-3)', fontSize: 13, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
            </span>
          </button>

          {expanded && (
            <>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', padding: '0 14px 12px', background: 'var(--surface)' }}>
                {t('pregame.tuneHint')}
              </div>
              {/* Řazení */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--surface)', borderTop: '1px solid var(--line)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{t('pregame.sort')}</span>
                <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                  <SortBtn active={sortBy === 'year'} onClick={() => setSortBy('year')}>{t('pregame.sortYear')}</SortBtn>
                  <SortBtn active={sortBy === 'title'} onClick={() => setSortBy('title')}>{t('pregame.sortTitle')}</SortBtn>
                </div>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto', borderTop: '1px solid var(--line)' }}>
                {loading && <div style={{ padding: 16, fontSize: 13, color: 'var(--ink-3)' }}>{t('pregame.loadingEvents')}</div>}
                {!loading && sortedCandidates.length === 0 && <div style={{ padding: 16, fontSize: 13, color: 'var(--ink-3)' }}>{t('pregame.noEvents')}</div>}
                {sortedCandidates.map(ev => {
                  const out = excluded.has(ev.id)
                  return (
                    <div key={ev.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px',
                      borderBottom: '1px solid var(--line)', opacity: out ? 0.45 : 1,
                    }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 9, flexShrink: 0, overflow: 'hidden',
                        background: 'radial-gradient(120% 90% at 30% 10%, #8a6f50, #2a1f17 70%)',
                      }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: out ? 'line-through' : 'none' }}>{eventTitle(ev)}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>
                          {formatYear(ev.year)}{ev.category ? ` · ${t('cat.' + ev.category)}` : ''}
                        </div>
                      </div>
                      <button onClick={() => toggleExclude(ev.id)} aria-label={out ? t('pregame.restore') : t('pregame.exclude')} style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                        border: `1px solid ${out ? 'var(--ink)' : 'var(--line-strong)'}`,
                        background: out ? 'var(--ink)' : 'transparent',
                        color: out ? 'var(--paper-50)' : 'var(--ink-3)',
                      }}>{out ? '↺' : '×'}</button>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '6px 20px 16px', maxWidth: 560, width: '100%', margin: '0 auto' }}>
        <button onClick={start} disabled={!enough || loading} style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          background: enough && !loading ? 'var(--accent)' : 'var(--paper-300)',
          color: '#fff', border: 'none', borderRadius: 14, padding: 16,
          fontFamily: 'var(--font-serif)', fontSize: 19, cursor: enough && !loading ? 'pointer' : 'not-allowed',
          boxShadow: enough && !loading ? '0 10px 30px rgba(217,119,87,0.4)' : 'none',
        }}>
          {t('pregame.start')}
          <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>→</span>
        </button>
      </div>
    </div>
  )
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function SortBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 11.5, padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
      border: `1px solid ${active ? 'var(--ink)' : 'var(--line-strong)'}`,
      background: active ? 'var(--ink)' : 'transparent',
      color: active ? 'var(--paper-50)' : 'var(--ink-2)',
    }}>{children}</button>
  )
}


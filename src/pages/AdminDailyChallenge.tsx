import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getDailyAssignments, setDailyAssignment, getAdminEvents } from '@/lib/supabase'
import { formatYear } from '@/lib/scoring'
import type { DailyAssignment } from '@/lib/supabase'
import type { Event } from '@/types/database'

const MONTHS = ['Leden','Únor','Březen','Duben','Květen','Červen',
                'Červenec','Srpen','Září','Říjen','Listopad','Prosinec']

function daysInMonth(month: number): number {
  // month: 1-12, použij nepřestupný rok pro zobrazení
  return new Date(2023, month, 0).getDate()
}

export default function AdminDailyChallengePage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [assignments, setAssignments] = useState<Map<string, DailyAssignment>>(new Map())
  const [events, setEvents] = useState<Event[]>([])
  const [selectedDay, setSelectedDay] = useState<{ month: number; day: number } | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    if (!loading && !isAdmin) navigate('/menu')
  }, [loading, isAdmin])

  useEffect(() => {
    async function load() {
      setLoadingData(true)
      const [assignData, eventsData] = await Promise.all([
        getDailyAssignments(),
        getAdminEvents().then(r => r.data ?? []),
      ])
      const map = new Map<string, DailyAssignment>()
      for (const a of assignData) map.set(`${a.month}-${a.day}`, a)
      setAssignments(map)
      setEvents((eventsData as Event[]).filter(e => e.published))
      setLoadingData(false)
    }
    load()
  }, [])

  const today = new Date()
  const todayKey = `${today.getMonth() + 1}-${today.getDate()}`

  async function handleAssign(eventId: string | null) {
    if (!selectedDay) return
    setSaving(true)
    const { error } = await setDailyAssignment(selectedDay.month, selectedDay.day, eventId)
    if (!error) {
      const key = `${selectedDay.month}-${selectedDay.day}`
      const newMap = new Map(assignments)
      if (eventId === null) {
        newMap.delete(key)
      } else {
        const ev = events.find(e => e.id === eventId)
        newMap.set(key, { month: selectedDay.month, day: selectedDay.day, event_id: eventId, events: ev })
      }
      setAssignments(newMap)
    }
    setSaving(false)
    setSelectedDay(null)
    setSearch('')
  }

  // Návrhy podle přesného data události (shoda den + měsíc s vybraným dnem)
  const suggestions = selectedDay
    ? events.filter(e => {
        if (!e.event_date) return false
        const m = parseInt(e.event_date.slice(5, 7))
        const d = parseInt(e.event_date.slice(8, 10))
        return m === selectedDay.month && d === selectedDay.day
      })
    : []
  const suggestionIds = new Set(suggestions.map(e => e.id))

  const filtered = events.filter(e =>
    (e.title.toLowerCase().includes(search.toLowerCase()) ||
     e.category?.toLowerCase().includes(search.toLowerCase())) &&
    // při prázdném hledání nezdvojuj návrhy (jsou zvlášť nahoře)
    (search.trim() !== '' || !suggestionIds.has(e.id))
  )

  const selectedAssignment = selectedDay
    ? assignments.get(`${selectedDay.month}-${selectedDay.day}`)
    : null

  if (loadingData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-200)' }}>
        <span className="spinner"/>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>

      {/* Picker modal */}
      {selectedDay && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(42,31,23,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 16,
            width: '100%', maxWidth: 520,
            boxShadow: 'var(--shadow-xl)', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', maxHeight: '80vh',
          }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <p className="eyebrow" style={{ marginBottom: 4 }}>Přiřadit událost</p>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>
                {selectedDay.day}. {MONTHS[selectedDay.month - 1]}
              </h3>
              {selectedAssignment?.events && (
                <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '6px 0 0' }}>
                  Aktuálně: <strong>{selectedAssignment.events.title}</strong>
                </p>
              )}
            </div>

            {/* Search */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
              <input
                className="input"
                placeholder="Hledat událost…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Seznam událostí */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {selectedAssignment?.event_id && (
                <button
                  onClick={() => handleAssign(null)}
                  style={{
                    width: '100%', padding: '10px 20px', border: 'none',
                    background: 'transparent', textAlign: 'left',
                    fontSize: 13, color: '#c0392b', cursor: 'pointer',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  ✕ Odebrat přiřazení
                </button>
              )}
              {/* Návrhy podle data — události s event_date na tento den/měsíc */}
              {!search.trim() && suggestions.length > 0 && (
                <>
                  <div style={{ padding: '8px 20px 4px', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-deep)' }}>
                    📅 Návrhy podle data
                  </div>
                  {suggestions.map(ev => (
                    <button
                      key={`sug-${ev.id}`}
                      onClick={() => handleAssign(ev.id)}
                      disabled={saving}
                      style={{
                        width: '100%', padding: '10px 20px', border: 'none',
                        background: selectedAssignment?.event_id === ev.id ? 'rgba(217,119,87,0.12)' : 'rgba(217,119,87,0.05)',
                        textAlign: 'left', cursor: 'pointer',
                        borderLeft: '3px solid var(--accent)',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                        {ev.event_date}{ev.category && ` · ${ev.category}`}
                        {selectedAssignment?.event_id === ev.id && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>✓ přiřazeno</span>}
                      </div>
                    </button>
                  ))}
                  <div style={{ height: 1, background: 'var(--line)', margin: '6px 0' }}/>
                </>
              )}
              {filtered.length === 0 && suggestions.length === 0 && (
                <p style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                  Žádné události nenalezeny
                </p>
              )}
              {filtered.map(ev => (
                <button
                  key={ev.id}
                  onClick={() => handleAssign(ev.id)}
                  disabled={saving}
                  style={{
                    width: '100%', padding: '10px 20px',
                    border: 'none', background: selectedAssignment?.event_id === ev.id ? 'rgba(217,119,87,0.08)' : 'transparent',
                    textAlign: 'left', cursor: 'pointer',
                    borderLeft: selectedAssignment?.event_id === ev.id ? '3px solid var(--accent)' : '3px solid transparent',
                    transition: 'background 120ms',
                  }}
                  onMouseEnter={e => { if (selectedAssignment?.event_id !== ev.id) (e.currentTarget as HTMLButtonElement).style.background = 'var(--paper-100)' }}
                  onMouseLeave={e => { if (selectedAssignment?.event_id !== ev.id) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{ev.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                        {formatYear(ev.year)}
                        {ev.category && ` · ${ev.category}`}
                      </div>
                    </div>
                    {selectedAssignment?.event_id === ev.id && (
                      <span style={{ color: 'var(--accent)', fontSize: 16, flexShrink: 0 }}>✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
              <button
                className="btn btn-ghost"
                style={{ width: '100%' }}
                onClick={() => { setSelectedDay(null); setSearch('') }}
              >
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/admin')}>
          ← Správa událostí
        </button>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>Tento den v historii</h1>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '2px 0 0' }}>
            {Array.from(assignments.values()).filter(a => a.event_id).length} / 366 dní přiřazeno
          </p>
        </div>
      </header>

      {/* Kalendář */}
      <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MONTHS.map((monthName, mi) => {
            const month = mi + 1
            const days = daysInMonth(month)
            return (
              <div key={month} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Název měsíce */}
                <div style={{
                  width: 80, flexShrink: 0,
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  letterSpacing: '0.12em', color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                }}>
                  {monthName}
                </div>
                {/* Dny */}
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {Array.from({ length: days }, (_, di) => {
                    const day = di + 1
                    const key = `${month}-${day}`
                    const assignment = assignments.get(key)
                    const hasEvent = !!assignment?.event_id
                    const isToday = key === todayKey

                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay({ month, day })}
                        title={hasEvent ? assignment!.events?.title : `${day}. ${monthName} — nepřiřazeno`}
                        style={{
                          width: 28, height: 28,
                          borderRadius: 6,
                          border: isToday ? '2px solid var(--accent)' : '1px solid var(--line-strong)',
                          background: hasEvent ? 'rgba(217,119,87,0.15)' : 'var(--surface)',
                          color: hasEvent ? 'var(--accent-deep)' : 'var(--ink-3)',
                          fontSize: 11, fontFamily: 'var(--font-mono)',
                          cursor: 'pointer',
                          fontWeight: isToday ? 700 : 400,
                          transition: 'all 100ms',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = hasEvent ? 'rgba(217,119,87,0.25)' : 'var(--paper-200)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = hasEvent ? 'rgba(217,119,87,0.15)' : 'var(--surface)' }}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legenda */}
        <div style={{ display: 'flex', gap: 20, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(217,119,87,0.15)', border: '1px solid var(--line-strong)' }}/>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Přiřazená událost</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--surface)', border: '2px solid var(--accent)' }}/>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Dnešní den</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, background: 'var(--surface)', border: '1px solid var(--line-strong)' }}/>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Nepřiřazeno</span>
          </div>
        </div>
      </div>
    </div>
  )
}

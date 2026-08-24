import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { EventForm } from '@/pages/Admin'
import { CATEGORY_IDS } from '@/components/GameSettings'
import {
  listTasks, createTask, deleteTask, approveTask, rejectTask, returnTask,
  getEventById, setUserRole, type EventTask,
} from '@/lib/editor'
import type { Event } from '@/types/database'

export default function AdminEventTasksPage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'pool' | 'review'>('pool')
  const [tasks, setTasks] = useState<EventTask[]>([])
  const [review, setReview] = useState<{ task: EventTask; event: Event | null } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => { if (!loading && !isAdmin) navigate('/menu') }, [loading, isAdmin])

  const load = useCallback(async () => { setTasks(await listTasks()) }, [])
  useEffect(() => { load() }, [load])

  const pool = tasks.filter(t => t.status === 'todo' || t.status === 'in_progress')
  const submitted = tasks.filter(t => t.status === 'submitted')

  async function openReview(task: EventTask) {
    setErr(null)
    const ev = task.event_id ? await getEventById(task.event_id) : null
    setReview({ task, event: ev })
  }

  async function doApprove() {
    if (!review?.event) { setErr('K zadání není přiřazená událost.'); return }
    const { error } = await approveTask(review.task.id, review.event.id)
    if (error) { setErr(error); return }
    setReview(null); load()
  }
  async function doReject() {
    if (!review) return
    if (!confirm('Opravdu zrušit? Zadání se označí jako zrušené (návrh události zůstane nepublikovaný).')) return
    const { error } = await rejectTask(review.task.id)
    if (error) { setErr(error); return }
    setReview(null); load()
  }
  async function doReturn() {
    if (!review) return
    const note = prompt('Poznámka pro editora (proč vracíš / co upravit):', review.task.review_note ?? '')
    if (note === null) return
    const { error } = await returnTask(review.task.id, note)
    if (error) { setErr(error); return }
    setReview(null); load()
  }

  // ── Review detail (formulář + workflow lišta) ──
  if (review) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
          <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => { setReview(null); load() }}>← Zpět</button>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>Schválení: {review.task.title}</h1>
        </header>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px' }}>
          {err && <div className="alert alert-error" style={{ marginBottom: 16 }}>{err}</div>}
          <div className="card" style={{ padding: 16, marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1, minWidth: 200 }}>
              Uprav podle potřeby a <strong>ulož změny</strong>, pak publikuj. Nebo vrať editorovi / zruš.
            </span>
            <button className="btn btn-accent" onClick={doApprove} disabled={!review.event}>✓ Publikovat</button>
            <button className="btn btn-ghost" onClick={doReturn}>↩ Vrátit do číselníku</button>
            <button className="btn btn-ghost" style={{ color: 'var(--danger, #c0392b)' }} onClick={doReject}>✕ Zrušit</button>
          </div>
          {review.event
            ? <EventForm event={review.event} onDone={() => { setReview(null); load() }}/>
            : <div className="alert alert-error">K tomuto zadání není přiřazená žádná událost.</div>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/admin')}>← Administrace</button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>📋 Zadání pro editory</h1>
      </header>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '24px 24px 48px' }}>
        {err && <div className="alert alert-error" style={{ marginBottom: 16 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--paper-300)', borderRadius: 12, marginBottom: 22 }}>
          {([['pool', `Číselník (${pool.length})`], ['review', `Ke schválení (${submitted.length})`]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              flex: 1, padding: '10px 0', border: 0, borderRadius: 9, cursor: 'pointer', fontWeight: tab === k ? 700 : 500, fontSize: 13.5,
              background: tab === k ? 'var(--surface)' : 'transparent', color: tab === k ? 'var(--ink)' : 'var(--ink-3)',
            }}>{label}</button>
          ))}
        </div>

        {tab === 'pool' ? (
          <>
            <NewTaskForm onCreated={load}/>
            <RoleGrant/>
            <p className="eyebrow" style={{ margin: '26px 0 12px' }}>Zadání v číselníku</p>
            {pool.length === 0
              ? <div style={{ color: 'var(--ink-3)', fontSize: 14 }}>Zatím žádná zadání.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pool.map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15 }}>{t.title}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                          {t.year ?? '—'}{t.category ? ' · ' + t.category : ''}{t.note ? ' · ' + t.note : ''}
                        </div>
                      </div>
                      <span className={`badge ${t.status === 'in_progress' ? 'badge-warning' : 'badge-neutral'}`}>{t.status === 'in_progress' ? 'Zpracovává se' : 'Volné'}</span>
                      {t.status === 'todo' && (
                        <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12, color: 'var(--danger, #c0392b)' }}
                          onClick={async () => { if (confirm('Smazat zadání?')) { await deleteTask(t.id); load() } }}>Smazat</button>
                      )}
                    </div>
                  ))}
                </div>}
          </>
        ) : (
          <>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Čeká na schválení</p>
            {submitted.length === 0
              ? <div style={{ color: 'var(--ink-3)', fontSize: 14 }}>Nic ke schválení.</div>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {submitted.map(t => (
                    <button key={t.id} onClick={() => openReview(t)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', width: '100%', textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, cursor: 'pointer' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16 }}>{t.title}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{t.year ?? '—'}{t.category ? ' · ' + t.category : ''}</div>
                      </div>
                      <span className="badge badge-success">Zkontrolovat</span>
                      <span style={{ color: 'var(--ink-3)', fontSize: 16 }}>›</span>
                    </button>
                  ))}
                </div>}
          </>
        )}
      </div>
    </div>
  )
}

function NewTaskForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true); setMsg(null)
    const { error } = await createTask({ title, year: year ? parseInt(year) : null, category: category || null, note })
    setBusy(false)
    if (error) { setMsg('Chyba: ' + error.message); return }
    setTitle(''); setYear(''); setCategory(''); setNote(''); setMsg('✓ Přidáno do číselníku'); onCreated()
  }

  const input: React.CSSProperties = { padding: '10px 12px', border: '1px solid var(--line-strong)', borderRadius: 10, fontSize: 14, background: 'var(--surface)', color: 'var(--ink)' }
  return (
    <form onSubmit={add} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p className="eyebrow" style={{ margin: 0 }}>Nové zadání</p>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
        <input style={input} placeholder="Název události" value={title} onChange={e => setTitle(e.target.value)}/>
        <input style={input} placeholder="Rok (např. 1969)" value={year} onChange={e => setYear(e.target.value)} inputMode="numeric"/>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
        <select style={input} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">Kategorie (volitelné)</option>
          {CATEGORY_IDS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input style={input} placeholder="Poznámka pro editora (volitelné)" value={note} onChange={e => setNote(e.target.value)}/>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="submit" className="btn btn-accent" disabled={busy}>{busy ? 'Přidávám…' : 'Přidat zadání'}</button>
        {msg && <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{msg}</span>}
      </div>
    </form>
  )
}

function RoleGrant() {
  const [username, setUsername] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  async function grant(role: 'editor' | 'user') {
    if (!username.trim()) return
    const res = await setUserRole(username.trim(), role)
    setMsg(res === 'ok' ? `✓ ${username} → ${role}` : res === 'not_found' ? 'Uživatel nenalezen.' : 'Chyba.')
  }
  const input: React.CSSProperties = { flex: 1, padding: '10px 12px', border: '1px solid var(--line-strong)', borderRadius: 10, fontSize: 14, background: 'var(--surface)', color: 'var(--ink)' }
  return (
    <div className="card" style={{ padding: 18, marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p className="eyebrow" style={{ margin: 0 }}>Role editora</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input style={input} placeholder="Přezdívka uživatele" value={username} onChange={e => setUsername(e.target.value)}/>
        <button className="btn btn-accent" onClick={() => grant('editor')}>Udělat editorem</button>
        <button className="btn btn-ghost" onClick={() => grant('user')}>Odebrat</button>
      </div>
      {msg && <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{msg}</span>}
    </div>
  )
}

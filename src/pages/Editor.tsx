import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { EventForm } from '@/pages/Admin'
import {
  listTasks, claimTask, submitTask, attachTaskEvent, getEventById,
  type EventTask,
} from '@/lib/editor'
import type { Event } from '@/types/database'

const STATUS_LABEL: Record<string, string> = {
  todo: 'Ke zpracování', in_progress: 'Rozpracované', submitted: 'Odesláno', approved: 'Schváleno', rejected: 'Zrušeno',
}

export default function EditorPage() {
  const { user, isEditor, loading } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<EventTask[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [active, setActive] = useState<{ task: EventTask; event: Event | null } | null>(null)

  useEffect(() => { if (!loading && !isEditor) navigate('/menu') }, [loading, isEditor])

  const load = useCallback(async () => {
    setTasks(await listTasks(['todo', 'in_progress']))
  }, [])
  useEffect(() => { load() }, [load])

  async function openTask(task: EventTask) {
    setErr(null); setBusy(true)
    try {
      if (task.status === 'todo') {
        const { error } = await claimTask(task.id)
        if (error) { setErr(error === 'task_taken' ? 'Tohle zadání si už vzal někdo jiný.' : error); await load(); return }
      }
      const ev = task.event_id ? await getEventById(task.event_id) : null
      setActive({ task: { ...task, status: 'in_progress' }, event: ev })
    } finally { setBusy(false) }
  }

  function closeForm() { setActive(null); load() }

  async function onSavedDraft(eventId: string) {
    if (active && !active.task.event_id) await attachTaskEvent(active.task.id, eventId)
  }
  async function onSubmitted(eventId: string) {
    if (!active) return
    if (!active.task.event_id) await attachTaskEvent(active.task.id, eventId)
    const { error } = await submitTask(active.task.id, eventId)
    if (error) { setErr('Odeslání ke schválení selhalo: ' + error); return }
    closeForm()
  }

  if (active) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
          <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={closeForm}>← Zpět na číselník</button>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>Zpracování události</h1>
        </header>
        <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px' }}>
          {active.task.note && (
            <div className="alert" style={{ marginBottom: 18, background: 'rgba(217,119,87,0.08)', border: '1px solid var(--accent)' }}>
              <strong>Poznámka k zadání:</strong> {active.task.note}
            </div>
          )}
          {active.task.review_note && (
            <div className="alert alert-error" style={{ marginBottom: 18 }}>
              <strong>Vráceno k přepracování:</strong> {active.task.review_note}
            </div>
          )}
          <EventForm
            mode="editor"
            event={active.event ?? undefined}
            prefillTitle={active.task.title}
            prefillYear={active.task.year}
            onDone={closeForm}
            onSavedDraft={onSavedDraft}
            onSubmitted={onSubmitted}
          />
        </div>
      </div>
    )
  }

  const mine = tasks.filter(t => t.status === 'in_progress' && t.assigned_to === user?.id)
  const pool = tasks.filter(t => t.status === 'todo')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/menu')}>← Menu</button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>✍️ Editor událostí</h1>
      </header>

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 24px 48px' }}>
        {err && <div className="alert alert-error" style={{ marginBottom: 16 }}>{err}</div>}

        {mine.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>Rozpracované ({mine.length})</p>
            <TaskList tasks={mine} disabled={busy} onOpen={openTask}/>
          </div>
        )}

        <p className="eyebrow" style={{ marginBottom: 12 }}>Ke zpracování ({pool.length})</p>
        {pool.length === 0
          ? <div style={{ color: 'var(--ink-3)', fontSize: 14, padding: '10px 2px' }}>Zatím žádná zadání. Admin sem přidá události ke zpracování.</div>
          : <TaskList tasks={pool} disabled={busy} onOpen={openTask}/>}
      </div>
    </div>
  )
}

function TaskList({ tasks, disabled, onOpen }: { tasks: EventTask[]; disabled: boolean; onOpen: (t: EventTask) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tasks.map(t => (
        <button key={t.id} onClick={() => onOpen(t)} disabled={disabled} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', width: '100%', textAlign: 'left',
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, cursor: disabled ? 'default' : 'pointer',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)' }}>{t.title}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
              {t.year != null ? t.year : '— rok neuveden'}{t.category ? ' · ' + t.category : ''}
            </div>
          </div>
          <span className={`badge ${t.status === 'in_progress' ? 'badge-warning' : 'badge-neutral'}`}>{STATUS_LABEL[t.status]}</span>
          <span style={{ color: 'var(--ink-3)', fontSize: 16 }}>›</span>
        </button>
      ))}
    </div>
  )
}

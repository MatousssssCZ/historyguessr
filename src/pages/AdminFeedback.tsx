import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { adminListFeedback, adminSetFeedbackStatus, type FeedbackRow, type FeedbackStatus } from '@/lib/feedback'

const STATUSES: FeedbackStatus[] = ['new', 'in_progress', 'done']
const STATUS_LABEL: Record<FeedbackStatus, string> = { new: 'Nové', in_progress: 'Řeší se', done: 'Vyřešeno' }
const KIND_LABEL: Record<string, string> = { bug: '🐞 Chyba', idea: '💡 Nápad', other: '💬 Jiné' }

export default function AdminFeedbackPage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [filter, setFilter] = useState<FeedbackStatus | 'all'>('new')

  useEffect(() => { if (!loading && !isAdmin) navigate('/menu') }, [loading, isAdmin])
  async function reload() { setRows(await adminListFeedback()) }
  useEffect(() => { reload() }, [])

  const shown = filter === 'all' ? rows : rows.filter(r => r.status === filter)
  const counts = (s: FeedbackStatus) => rows.filter(r => r.status === s).length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/admin')}>← Administrace</button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>🐞 Hlášení a zpětná vazba</h1>
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '24px' }}>
        {/* Filtr */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {(['new', 'in_progress', 'done', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              fontFamily: 'var(--font-sans)', fontSize: 12.5, fontWeight: 600, padding: '7px 13px', borderRadius: 20, cursor: 'pointer',
              border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--line)'}`,
              background: filter === f ? 'rgba(217,119,87,0.12)' : 'var(--surface)',
              color: filter === f ? 'var(--accent-deep)' : 'var(--ink-2)',
            }}>{f === 'all' ? 'Vše' : `${STATUS_LABEL[f]} (${counts(f)})`}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(r => (
            <div key={r.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '13px 15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12.5 }}>{KIND_LABEL[r.kind] ?? r.kind}</span>
                {r.page && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)', background: 'var(--paper-200)', padding: '2px 7px', borderRadius: 6 }}>{r.page}</span>}
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>{new Date(r.created_at).toLocaleString('cs')}</span>
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{r.message}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {STATUSES.map(s => (
                  <button key={s} onClick={async () => { await adminSetFeedbackStatus(r.id, s); reload() }}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                      border: `1px solid ${r.status === s ? 'var(--accent)' : 'var(--line)'}`,
                      background: r.status === s ? 'rgba(217,119,87,0.12)' : 'transparent',
                      color: r.status === s ? 'var(--accent-deep)' : 'var(--ink-3)',
                    }}>{STATUS_LABEL[s]}</button>
                ))}
              </div>
            </div>
          ))}
          {shown.length === 0 && <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, padding: '30px 0' }}>Žádná hlášení.</div>}
        </div>
      </div>
    </div>
  )
}

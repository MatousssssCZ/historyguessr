import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { adminListRoadmap, adminCreateRoadmap, adminUpdateRoadmap, adminDeleteRoadmap, type RoadmapItem, type RoadmapStatus } from '@/lib/roadmap'

const STATUSES: RoadmapStatus[] = ['idea', 'planned', 'in_progress', 'done']
const STATUS_LABEL: Record<RoadmapStatus, string> = { idea: 'Nápad', planned: 'Plánováno', in_progress: 'Probíhá', done: 'Hotovo' }

export default function AdminRoadmapPage() {
  const { isAdmin, loading } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<RoadmapItem[]>([])
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [status, setStatus] = useState<RoadmapStatus>('planned')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (!loading && !isAdmin) navigate('/menu') }, [loading, isAdmin])

  async function reload() { setItems(await adminListRoadmap()) }
  useEffect(() => { reload() }, [])

  async function create() {
    if (!title.trim()) return
    setBusy(true)
    await adminCreateRoadmap(title.trim(), desc.trim(), status)
    setTitle(''); setDesc(''); setStatus('planned')
    await reload(); setBusy(false)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', background: 'var(--surface)', border: '1px solid var(--line-strong)',
    borderRadius: 10, padding: '10px 12px', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink)', marginBottom: 10,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper-200)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 32px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13 }} onClick={() => navigate('/admin')}>← Administrace</button>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>🗳️ Roadmap</h1>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 24px' }}>
        {/* Nová položka */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, marginBottom: 22 }}>
          <p className="eyebrow" style={{ marginBottom: 12 }}>Nová položka</p>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Název vylepšení" style={inputStyle}/>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} maxLength={500} placeholder="Popis (nepovinné)" rows={2} style={{ ...inputStyle, resize: 'vertical' }}/>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <select value={status} onChange={e => setStatus(e.target.value as RoadmapStatus)} style={{ ...inputStyle, marginBottom: 0, width: 'auto', flex: 1 }}>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <button onClick={create} disabled={busy || !title.trim()} className="btn btn-accent" style={{ padding: '10px 20px', fontSize: 13 }}>Přidat</button>
          </div>
        </div>

        {/* Seznam */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(item => (
            <div key={item.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: 'var(--accent)', minWidth: 34 }}>▲ {item.votes}</span>
                <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--ink)', flex: 1 }}>{item.title}</span>
                <button onClick={async () => { if (confirm('Smazat položku?')) { await adminDeleteRoadmap(item.id); reload() } }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16 }}>✕</button>
              </div>
              {item.description && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 8, lineHeight: 1.4 }}>{item.description}</div>}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STATUSES.map(s => (
                  <button key={s} onClick={async () => { await adminUpdateRoadmap(item.id, { status: s }); reload() }}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', padding: '4px 9px', borderRadius: 20, cursor: 'pointer',
                      border: `1px solid ${item.status === s ? 'var(--accent)' : 'var(--line)'}`,
                      background: item.status === s ? 'rgba(217,119,87,0.12)' : 'transparent',
                      color: item.status === s ? 'var(--accent-deep)' : 'var(--ink-3)',
                    }}>{STATUS_LABEL[s]}</button>
                ))}
              </div>
            </div>
          ))}
          {items.length === 0 && <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, padding: '24px 0' }}>Zatím žádné položky.</div>}
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { getEditorLeaderboard, editorProgress, type EditorRank } from '@/lib/editor'

// Motivační žebříček editorů. Sdílené v /editor i v adminu (Zadání pro editory).
// „Tvůj přínos" se ukáže jen tomu, kdo v žebříčku figuruje (má odeslaná zadání) —
// admin bez příspěvků uvidí jen žebříček.
export default function EditorLeaderboard({ meId }: { meId?: string }) {
  const [board, setBoard] = useState<EditorRank[]>([])
  useEffect(() => { getEditorLeaderboard().then(setBoard).catch(() => {}) }, [])

  if (board.length === 0) return null

  const me = board.find(r => r.user_id === meId)
  const myRank = meId ? board.findIndex(r => r.user_id === meId) + 1 : 0
  const approved = me?.approved ?? 0
  const { current, next } = editorProgress(approved)
  const prevAt = current?.at ?? 0
  const span = next ? next.at - prevAt : 1
  const pct = next ? Math.min(100, Math.round(((approved - prevAt) / span) * 100)) : 100

  return (
    <div style={{ marginBottom: 28 }}>
      {me && (
        <div className="card" style={{ padding: 18, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p className="eyebrow" style={{ margin: 0 }}>Tvůj přínos</p>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, marginTop: 3 }}>
                {current ? `${current.icon} ${current.title}` : '🌱 Začni první událostí'}
              </div>
            </div>
            {myRank > 0 && (
              <div style={{ flexShrink: 0, textAlign: 'center', background: 'var(--accent)', color: '#fff', borderRadius: 12, padding: '8px 12px' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, lineHeight: 1 }}>#{myRank}</div>
                <div style={{ fontSize: 10, opacity: .85, marginTop: 2 }}>pořadí</div>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            <span><b style={{ fontSize: 17, color: 'var(--accent)' }}>{approved}</b> schváleno</span>
            <span style={{ color: 'var(--ink-2)' }}><b style={{ fontSize: 17 }}>{me.pending}</b> čeká</span>
            <span style={{ color: 'var(--ink-3)' }}><b style={{ fontSize: 17 }}>{me.submitted}</b> celkem</span>
          </div>
          {next && (
            <div style={{ marginTop: 14 }}>
              <div style={{ height: 8, background: 'var(--line)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }}/>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>
                Do titulu <b style={{ color: 'var(--ink-2)' }}>{next.icon} {next.title}</b> zbývá {next.at - approved} schválených
              </div>
            </div>
          )}
        </div>
      )}

      <p className="eyebrow" style={{ marginBottom: 10 }}>🏆 Žebříček editorů</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {board.map((r, i) => {
          const meRow = r.user_id === meId
          return (
            <div key={r.user_id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12,
              background: meRow ? 'color-mix(in srgb, var(--accent) 12%, var(--surface))' : 'var(--surface)',
              border: `1px solid ${meRow ? 'var(--accent)' : 'var(--line)'}`,
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, width: 28, color: i < 3 ? 'var(--accent)' : 'var(--ink-3)' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-serif)', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.username || 'Editor'}{meRow ? ' (ty)' : ''}
              </span>
              {r.pending > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{r.pending} čeká</span>}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>{r.approved}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

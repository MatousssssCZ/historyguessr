import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  getFriends, getFriendRequests, sendFriendRequest, respondFriendRequest, removeFriend,
  type Friend, type FriendRequestResult,
} from '@/lib/supabase'
import { levelFromXp } from '@/lib/leveling'
import MobileNav from '@/components/MobileNav'
import DesktopSidebar from '@/components/DesktopSidebar'

const eyebrow: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }
const rowCard: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '12px 13px', display: 'flex', alignItems: 'center', gap: 12 }

export default function FriendsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [addName, setAddName] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const [f, r] = await Promise.all([getFriends(), getFriendRequests()])
    setFriends(f); setRequests(r); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = addName.trim()
    if (!name) return
    setSending(true); setMsg(null)
    const res = await sendFriendRequest(name)
    setSending(false)
    const okStates: FriendRequestResult[] = ['sent', 'accepted']
    setMsg({ ok: okStates.includes(res), text: t('friends.res_' + res) })
    if (okStates.includes(res)) { setAddName(''); load() }
  }
  async function respond(id: string, accept: boolean) { await respondFriendRequest(id, accept); load() }
  async function unfriend(id: string) { if (!confirm(t('friends.removeConfirm'))) return; await removeFriend(id); load() }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--paper-200)' }}>
      <DesktopSidebar/>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 'var(--safe-top)', paddingBottom: 'var(--nav-space)' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 18px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 20px' }}>
          <BackCircle onClick={() => navigate('/menu')} label={t('common.backToMenu')}/>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 25, color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em' }}>{t('friends.title')}</h1>
        </div>

        {/* Přidat přítele */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 15, marginBottom: 22 }}>
          <p style={{ ...eyebrow, margin: '0 0 11px' }}>{t('friends.add')}</p>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 9 }}>
            <input value={addName} onChange={e => setAddName(e.target.value)} placeholder={t('friends.addPlaceholder')} maxLength={24} style={{
              flex: 1, minWidth: 0, background: 'var(--paper-200)', border: '1px solid var(--line-strong)', borderRadius: 12,
              padding: '11px 13px', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink)',
            }}/>
            <button type="submit" disabled={sending || !addName.trim()} style={{
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 16px',
              fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: sending || !addName.trim() ? 0.6 : 1,
            }}>{t('friends.addBtn')}</button>
          </form>
          {msg && <div style={{ marginTop: 10, fontSize: 12.5, color: msg.ok ? 'var(--success-deep, #3f7a4d)' : 'var(--danger)' }}>{msg.text}</div>}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}><span className="spinner" style={{ width: 24, height: 24 }}/></div>
        ) : (
          <>
            {requests.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                <p style={{ ...eyebrow, margin: '0 0 12px' }}>{t('friends.requests')} ({requests.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {requests.map(r => (
                    <div key={r.id} style={rowCard}>
                      <Avatar name={r.username}/>
                      <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{r.username}</span>
                      <button onClick={() => respond(r.id, true)} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '7px 12px', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{t('friends.accept')}</button>
                      <button onClick={() => respond(r.id, false)} style={{ background: 'transparent', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '7px 12px', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer' }}>{t('friends.decline')}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{ ...eyebrow, margin: '0 0 12px' }}>{t('friends.list')} ({friends.length})</p>
            {friends.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--ink-3)' }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>👥</div>
                <p style={{ fontSize: 14, margin: 0 }}>{t('friends.empty')}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {friends.map(f => (
                  <div key={f.id} style={rowCard}>
                    <Avatar name={f.username}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{f.username}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-3)', marginTop: 2, letterSpacing: '0.06em' }}>{t('menu.level').toUpperCase()} {levelFromXp(f.xp ?? 0).level}</div>
                    </div>
                    <button onClick={() => unfriend(f.id)} style={{ background: 'transparent', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '7px 12px', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11.5, color: 'var(--ink-2)', cursor: 'pointer' }}>{t('friends.remove')}</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      </div>
      <MobileNav/>
    </div>
  )
}

function BackCircle({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
      background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
    }}>←</button>
  )
}

// Barevný monogram (odstín z názvu)
function Avatar({ name }: { name: string | null }) {
  const n = name ?? '?'
  let hash = 0
  for (let i = 0; i < n.length; i++) hash = (hash * 31 + n.charCodeAt(i)) >>> 0
  const hue = hash % 360
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(150deg, hsl(${hue} 35% 78%), hsl(${hue} 40% 62%))`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: `hsl(${hue} 45% 30%)`, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15,
    }}>{(n[0] ?? '?').toUpperCase()}</div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import {
  getFriends, getFriendRequests, sendFriendRequest, respondFriendRequest, removeFriend,
  type Friend, type FriendRequestResult,
} from '@/lib/supabase'
import { levelFromXp } from '@/lib/leveling'
import BackButton from '@/components/BackButton'

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

  async function respond(id: string, accept: boolean) {
    await respondFriendRequest(id, accept)
    load()
  }
  async function unfriend(id: string) {
    if (!confirm(t('friends.removeConfirm'))) return
    await removeFriend(id)
    load()
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-100)', paddingBottom: 'max(20px, var(--safe-bottom))' }}>
      {/* Hlavička */}
      <div style={{ position: 'relative', background: 'var(--feature-bg)', padding: 'calc(var(--safe-top) + 18px) 22px 22px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -60, right: -50, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,87,0.16), transparent 70%)', pointerEvents: 'none' }}/>
        <div style={{ marginBottom: 14, position: 'relative' }}>
          <BackButton onClick={() => navigate('/menu')} label={t('common.backToMenu')} />
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--feature-fg)', letterSpacing: '-0.02em', margin: 0, position: 'relative' }}>{t('friends.title')}</h1>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '18px 18px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Přidat přítele */}
        <div className="card" style={{ padding: 18 }}>
          <p className="eyebrow" style={{ marginBottom: 12 }}>{t('friends.add')}</p>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8 }}>
            <input className="input" style={{ flex: 1 }} value={addName} onChange={e => setAddName(e.target.value)} placeholder={t('friends.addPlaceholder')} maxLength={24}/>
            <button className="btn btn-accent" type="submit" disabled={sending || !addName.trim()}>{t('friends.addBtn')}</button>
          </form>
          {msg && <div className={`alert ${msg.ok ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 10 }}>{msg.text}</div>}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 30 }}><span className="spinner" style={{ width: 24, height: 24 }}/></div>
        ) : (
          <>
            {/* Příchozí žádosti */}
            {requests.length > 0 && (
              <div>
                <p className="eyebrow" style={{ marginBottom: 10 }}>{t('friends.requests')} ({requests.length})</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {requests.map(r => (
                    <div key={r.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                      <Avatar name={r.username}/>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{r.username}</span>
                      <button className="btn btn-accent" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => respond(r.id, true)}>{t('friends.accept')}</button>
                      <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => respond(r.id, false)}>{t('friends.decline')}</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seznam přátel */}
            <div>
              <p className="eyebrow" style={{ marginBottom: 10 }}>{t('friends.list')} ({friends.length})</p>
              {friends.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--ink-3)' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🫂</div>
                  <p style={{ fontSize: 14, margin: 0 }}>{t('friends.empty')}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {friends.map(f => (
                    <div key={f.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                      <Avatar name={f.username}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{f.username}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{t('menu.level')} {levelFromXp(f.xp ?? 0).level}</div>
                      </div>
                      <button className="btn btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => unfriend(f.id)}>{t('friends.remove')}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Avatar({ name }: { name: string | null }) {
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(217,119,87,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, color: 'var(--accent-deep)', flexShrink: 0 }}>
      {(name?.[0] ?? '?').toUpperCase()}
    </div>
  )
}

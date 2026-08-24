import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { subscribeIncomingInvites, respondInvite, muteInviter, getPendingInvites, type GameInvite } from '@/lib/invites'
import Icon from '@/components/Icon'

// App-wide banner příchozí pozvánky do multiplayeru. Přijde přes Realtime (i když
// je hráč jinde v appce); „Připojit" ho rovnou auto-joinne do místnosti.
export default function GameInviteListener() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [invite, setInvite] = useState<GameInvite | null>(null)

  useEffect(() => {
    if (!user?.id) return
    let alive = true
    // Doběr nevyřízených pozvánek. Realtime je rychlá cesta, ale nemusí vždy
    // dorazit (RLS/socket), proto k tomu pravidelně pollujeme + při návratu na
    // záložku — pozvánka tak přijde spolehlivě do pár sekund.
    const poll = () => getPendingInvites()
      .then(list => { if (alive && list.length) setInvite(prev => prev ?? list[0]) })
      .catch(() => {})
    poll()
    const unsub = subscribeIncomingInvites(user.id, inv => setInvite(prev => prev ?? inv))
    const iv = setInterval(poll, 10000)
    const onFocus = () => { if (document.visibilityState === 'visible') poll() }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      alive = false
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
      unsub()
    }
  }, [user?.id])

  if (!invite) return null

  const accept = async () => {
    const code = invite.room_code
    try { await respondInvite(invite.id, true) } catch { /* ignore */ }
    setInvite(null)
    navigate(`/multiplayer/lobby?code=${code}`)
  }
  const decline = async () => { try { await respondInvite(invite.id, false) } catch { /* ignore */ } setInvite(null) }
  const mute = async () => { try { await muteInviter(invite.from_user_id) } catch { /* ignore */ } setInvite(null) }

  return (
    <div style={{ position: 'fixed', top: 'calc(env(safe-area-inset-top,0px) + 12px)', left: 12, right: 12, zIndex: 9000, maxWidth: 440, margin: '0 auto' }}>
      <div style={{ background: '#1C1813', color: '#FBF7F0', borderRadius: 16, padding: '14px 15px', boxShadow: '0 12px 34px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(150deg,#d97757,#b85a3e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700 }}>{invite.from_username.charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14 }}>{t('lobby.inviteTitle', { name: invite.from_username })}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'rgba(251,247,240,.6)', marginTop: 1 }}>{t('menu.multiplayer')} · {invite.room_code}</div>
          </div>
          <span style={{ color: '#E9A183' }}><Icon name="swords" size={20}/></span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={accept} style={{ flex: 1, padding: 11, border: 0, borderRadius: 12, background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>{t('lobby.inviteJoin')}</button>
          <button onClick={decline} style={{ padding: '11px 16px', border: '1px solid rgba(251,247,240,.25)', borderRadius: 12, background: 'transparent', color: 'rgba(251,247,240,.8)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>{t('lobby.inviteDecline')}</button>
        </div>
        <button onClick={mute} style={{ display: 'block', margin: '10px auto 0', background: 'none', border: 0, color: 'rgba(251,247,240,.45)', fontFamily: 'var(--font-sans)', fontSize: 11.5, cursor: 'pointer' }}>{t('lobby.inviteMute')}</button>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { getFriendRequests, signOut } from '@/lib/supabase'

const ACCENT_GRAD = 'linear-gradient(150deg,#d97757,#b85a3e)'

type Tab = 'home' | 'campaigns' | 'badges' | 'profile'

/** Sdílená mobilní spodní lišta (Domů · Kampaně · [Play] · Odznaky · Profil).
 *  Na desktopu se nevykresluje. Play otevře bottom-sheet launcher. */
export default function MobileNav({ active }: { active?: Tab }) {
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false))
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const [sheet, setSheet] = useState(false)
  const [friendReqs, setFriendReqs] = useState(0)

  useEffect(() => { getFriendRequests().then(r => setFriendReqs(r.length)).catch(() => {}) }, [])

  if (!isMobile) return null

  const goQuick = () => { setSheet(false); navigate('/game', { state: { rounds: 1 } }) }
  const goClassic = () => { setSheet(false); navigate('/play') }
  const goDaily = () => { setSheet(false); navigate('/daily') }
  const goMP = () => { setSheet(false); navigate('/multiplayer/lobby') }
  const goAdmin = () => { setSheet(false); navigate('/admin') }
  const onLogout = async () => { await signOut(); navigate('/auth') }

  const item = (icon: 'home' | 'compass' | 'medal' | 'user', label: string, onClick: () => void, tab?: Tab, badge?: number) => {
    const on = tab && tab === active
    return (
      <button onClick={onClick} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: on ? 'var(--accent)' : 'var(--ink-3)', padding: 0 }}>
        <NavIcon name={icon} active={!!on}/>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: on ? 700 : 600, fontSize: 9 }}>{label}</span>
        {!!badge && badge > 0 && <span style={{ position: 'absolute', top: -4, right: -8, background: '#e23b3b', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 8, padding: '1px 5px', borderRadius: 999 }}>{badge}</span>}
      </button>
    )
  }

  return (
    <>
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, height: 'calc(66px + var(--safe-bottom))',
        paddingBottom: 'var(--safe-bottom)', background: 'var(--surface-blur, rgba(251,247,240,0.9))', backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', zIndex: 50,
      }}>
        <div style={{ display: 'flex', gap: 38 }}>
          {item('home', t('menu.navHome'), () => navigate('/menu'), 'home')}
          {item('compass', t('menu.campaigns'), () => navigate('/campaigns'), 'campaigns')}
        </div>
        <button onClick={() => setSheet(true)} aria-label={t('menu.navPlay')} style={{
          position: 'absolute', left: '50%', top: -16, transform: 'translateX(-50%)',
          width: 56, height: 56, borderRadius: '50%', background: ACCENT_GRAD, border: 'none', cursor: 'pointer',
          boxShadow: '0 14px 30px -6px rgba(217,119,87,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="35" height="35" viewBox="0 0 24 24" fill="#fff"><path d="M8 5.5 L18.5 12 L8 18.5 Z"/></svg>
        </button>
        <div style={{ display: 'flex', gap: 38 }}>
          {item('medal', t('menu.navBadges'), () => navigate('/stats'), 'badges')}
          {item('user', t('menu.navProfile'), () => navigate('/account'), 'profile', friendReqs)}
        </div>
      </div>

      {sheet && (
        <PlaySheet onClose={() => setSheet(false)} goQuick={goQuick} goClassic={goClassic} goDaily={goDaily} goMP={goMP}
          extra={isAdmin ? goAdmin : undefined} onLogout={onLogout}/>
      )}
    </>
  )
}

function NavIcon({ name, active }: { name: 'home' | 'compass' | 'medal' | 'user'; active?: boolean }) {
  const s = { width: 23, height: 23, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (name === 'home') return (
    <svg viewBox="0 0 24 24" style={{ ...s, fill: active ? 'currentColor' : 'none' }}>
      <path d="M3.5 11.5 L12 4 L20.5 11.5 V19.5 a1 1 0 0 1-1 1 H4.5 a1 1 0 0 1-1-1 Z"/>
      {!active && <path d="M9.5 20.5 V14.5 h5 v6" fill="none"/>}
    </svg>
  )
  if (name === 'compass') return (
    <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5 L10.7 10.7 L8.5 15.5 L13.3 13.3 Z"/></svg>
  )
  if (name === 'medal') return (
    <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="15" r="5"/><path d="M8.5 10.6 L6.5 3.5 M15.5 10.6 L17.5 3.5"/></svg>
  )
  return (
    <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="8" r="4"/><path d="M5 20.5 a7 7 0 0 1 14 0"/></svg>
  )
}

function PlaySheet({ onClose, goQuick, goClassic, goDaily, goMP, extra, onLogout }: {
  onClose: () => void; goQuick: () => void; goClassic: () => void; goDaily: () => void; goMP: () => void
  extra?: () => void; onLogout: () => void
}) {
  const { t } = useTranslation()
  const row = (icon: string, title: string, sub: string, onClick: () => void, rec?: boolean) => (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 13, width: '100%', textAlign: 'left', cursor: 'pointer',
      padding: 14, borderRadius: 16,
      background: rec ? 'rgba(217,119,87,0.09)' : 'var(--paper-100)',
      border: `1px solid ${rec ? 'var(--accent)' : 'var(--line)'}`,
    }}>
      <span style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, background: rec ? ACCENT_GRAD : 'var(--paper-300)', color: rec ? '#fff' : 'var(--accent)' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontWeight: rec ? 700 : 600, fontSize: 14.5, color: 'var(--ink)' }}>{title}</span>
          {rec && <span style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 8, padding: '2px 6px', borderRadius: 20 }}>{t('menu.recommended').toUpperCase()}</span>}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>
      </div>
      <span style={{ color: rec ? 'var(--accent)' : 'var(--ink-3)', fontSize: 15 }}>›</span>
    </button>
  )
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(38,33,28,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: 'var(--surface)', borderRadius: '28px 28px 0 0', padding: '12px 18px calc(22px + var(--safe-bottom))',
        boxShadow: '0 -20px 50px -20px rgba(0,0,0,0.4)', animation: 'slideUp 260ms cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 4, background: 'var(--line-strong)', margin: '2px auto 16px' }}/>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)' }}>{t('menu.howToPlay')}</div>
          <button onClick={onClose} aria-label="✕" style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--paper-200)', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13 }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {row('⚡', t('menu.quickGame'), t('menu.quickGameSub'), goQuick, true)}
          {row('🎚', t('menu.classicGame'), t('menu.classicGameSub'), goClassic)}
          {row('🔥', t('menu.daily'), t('menu.dailyModeSub'), goDaily)}
          {row('⚔', t('menu.multiplayer'), t('menu.multiplayerSub'), goMP)}
          {extra && row('⚙️', t('menu.admin'), t('menu.adminSub'), extra)}
        </div>
        <button onClick={onLogout} style={{ width: '100%', marginTop: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13, padding: 8 }}>{t('common.logout')}</button>
      </div>
    </div>
  )
}

import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useIsMobile } from '@/hooks/useIsMobile'
import { levelFromXp } from '@/lib/leveling'

const ACCENT_GRAD = 'linear-gradient(150deg,#d97757,#b85a3e)'

type NavItem = { icon: string; label: string; to: string; match: string[] }

/**
 * Trvalý postranní panel na desktopu — sdílený mezi stránkami „nabídky"
 * (Domů, Kampaně, Odznaky, Přátelé, Profil, [Admin]). Aktivní položka se
 * pozná z aktuální URL. Na mobilu se nevykresluje (tam je spodní MobileNav).
 *
 * `streak` je volitelný — Menu ho má načtený a předá; ostatní stránky ne.
 */
export default function DesktopSidebar({ streak }: { streak?: number }) {
  const { t } = useTranslation()
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()

  if (isMobile) return null

  const name = profile?.username ?? 'Hráči'
  const monogram = name.trim().charAt(0).toUpperCase() || '?'
  const lvl = levelFromXp(profile?.xp ?? 0)

  const nav: NavItem[] = [
    { icon: '🏠', label: t('menu.navHome'), to: '/menu', match: ['/menu'] },
    { icon: '🏛', label: t('menu.campaigns'), to: '/campaigns', match: ['/campaigns'] },
    { icon: '🏅', label: t('menu.navBadges'), to: '/stats', match: ['/stats'] },
    { icon: '👥', label: t('menu.friendsTitle'), to: '/friends', match: ['/friends'] },
    { icon: '👤', label: t('menu.navProfile'), to: '/account', match: ['/account'] },
  ]
  if (isAdmin) nav.push({ icon: '⚙️', label: t('menu.admin'), to: '/admin', match: ['/admin'] })

  const activeOf = (item: NavItem) => item.match.some(m => location.pathname === m || location.pathname.startsWith(m + '/'))

  return (
    <div style={{
      width: 234, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--line)',
      display: 'flex', flexDirection: 'column', padding: '22px 16px', minHeight: '100dvh',
      position: 'sticky', top: 0, alignSelf: 'flex-start', maxHeight: '100dvh',
    }}>
      <button onClick={() => navigate('/menu')} style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', marginBottom: 26 }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="17" height="17" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="13" stroke="#fff" strokeWidth="1.6"/>
            <path d="M16 3 C9 9 9 23 16 29" stroke="#fff" strokeWidth="0.9" opacity="0.7" fill="none"/>
            <path d="M16 3 C23 9 23 23 16 29" stroke="#fff" strokeWidth="0.9" opacity="0.7" fill="none"/>
            <circle cx="16" cy="16" r="2.3" fill="#fff"/>
          </svg>
        </div>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, letterSpacing: '-0.01em', color: 'var(--ink)' }}>HistoryGuessr</span>
      </button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {nav.map(n => {
          const active = activeOf(n)
          return (
            <button key={n.to} onClick={() => navigate(n.to)} style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
              padding: '10px 12px', borderRadius: 11,
              background: active ? 'var(--paper-100)' : 'transparent',
              border: `1px solid ${active ? 'var(--line)' : 'transparent'}`,
              color: active ? 'var(--ink)' : 'var(--ink-2)',
              fontFamily: 'var(--font-sans)', fontWeight: active ? 700 : 500, fontSize: 13.5,
            }}>
              <span style={{ fontSize: 18 }}>{n.icon}</span>{n.label}
            </button>
          )
        })}
      </div>

      <button onClick={() => navigate('/account')} style={{
        marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 11, padding: 10, borderRadius: 13,
        background: 'var(--paper-100)', border: '1px solid var(--line)', cursor: 'pointer', textAlign: 'left', width: '100%',
      }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--font-serif)', fontSize: 16 }}>{monogram}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-3)', marginTop: 1 }}>
            LVL {lvl.level}{streak != null ? ` · ${t('menu.streakDays', { n: streak })}` : ''}
          </div>
        </div>
      </button>
    </div>
  )
}

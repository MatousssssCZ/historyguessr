import { useState, useRef, useLayoutEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { currentLocale } from '@/i18n'
import { levelFromXp } from '@/lib/leveling'
import Icon from '@/components/Icon'
import LanguageSwitcher from '@/components/LanguageSwitcher'

const ACCENT_GRAD = 'linear-gradient(150deg,#d97757,#b85a3e)'

type Item = { label: string; to: string; match: string[]; external?: boolean }

// Tmavá horní lišta sjednocující inner stránky s domovským menu:
// logo → /menu, navigační pilulka (indikátor sedí na aktivní položce dle route),
// vpravo streak + level + avatar (→ /account).
export default function AppHeader({ streak }: { streak?: number }) {
  const { t } = useTranslation()
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const loc = currentLocale()
  const eloc = loc === 'en' ? 'en' : loc === 'de' ? 'de' : 'cs'
  const exSeg = eloc === 'en' ? 'explore' : eloc === 'de' ? 'entdecken' : 'objevuj'
  const name = profile?.username ?? t('common.defaultPlayer')
  const lvl = levelFromXp(profile?.xp ?? 0)

  const items: Item[] = [
    { label: t('menu.navHome'), to: '/menu', match: ['/menu'] },
    { label: t('menu.campaigns'), to: '/campaigns', match: ['/campaigns'] },
    { label: t('menu.navBadges'), to: '/stats', match: ['/stats'] },
    { label: t('menu.navFriends'), to: '/friends', match: ['/friends'] },
    { label: t('menu.navExplore'), to: `/${eloc}/${exSeg}`, match: [`/${eloc}/${exSeg}`], external: true },
  ]
  if (isAdmin) items.push({ label: t('menu.admin'), to: '/admin', match: ['/admin'] })

  // -1 = žádná položka lišty neodpovídá (např. /account je pod avatarem) → indikátor skrytý
  const activeIndex = items.findIndex(it => it.match.some(m => location.pathname === m || location.pathname.startsWith(m + '/')))
  const onAccount = location.pathname === '/account' || location.pathname.startsWith('/account/')

  const refs = useRef<Array<HTMLElement | null>>([])
  const [pos, setPos] = useState<{ left: number; width: number; on: boolean }>({ left: 0, width: 0, on: false })
  useLayoutEffect(() => {
    const measure = () => {
      const el = activeIndex >= 0 ? refs.current[activeIndex] : null
      if (el) setPos({ left: el.offsetLeft, width: el.offsetWidth, on: true })
      else setPos(p => ({ ...p, on: false }))
    }
    measure()
    // Přeměř po donačtení webfontu (reflow šířek) a při změně velikosti okna
    let cancelled = false
    const fonts = (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts
    fonts?.ready.then(() => { if (!cancelled) measure() })
    window.addEventListener('resize', measure)
    return () => { cancelled = true; window.removeEventListener('resize', measure) }
  }, [activeIndex, items.length])

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 20, background: '#1C1813', color: '#FBF7F0',
      borderBottom: '1px solid rgba(251,247,240,.1)', paddingTop: 'var(--safe-top)',
    }}>
      <div style={{ maxWidth: 1320, margin: '0 auto', height: 66, padding: '0 24px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 16 }}>
        {/* Logo → menu */}
        <button onClick={() => navigate('/menu')} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#FBF7F0', justifySelf: 'start' }}>
          <span style={{ width: 30, height: 30, borderRadius: 9, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Icon name="globe" size={17}/></span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18, letterSpacing: '-0.01em' }}>Historyguesser</span>
        </button>

        {/* Nav pilulka */}
        <nav style={{ position: 'relative', display: 'flex', gap: 3, padding: 5, background: 'rgba(24,20,15,.6)', border: '1px solid rgba(251,247,240,.14)', borderRadius: 15 }}>
          <span aria-hidden="true" style={{ position: 'absolute', top: 5, bottom: 5, left: pos.left, width: pos.width, background: '#FBF7F0', borderRadius: 11, opacity: pos.on ? 1 : 0, transition: 'left .3s cubic-bezier(.34,1.35,.5,1), width .3s cubic-bezier(.34,1.35,.5,1)', pointerEvents: 'none' }}/>
          {items.map((n, i) => {
            const lit = i === activeIndex
            const st: React.CSSProperties = { position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', height: 36, padding: '0 15px', borderRadius: 11, fontFamily: 'var(--font-sans)', fontWeight: lit ? 700 : 600, fontSize: 13, cursor: 'pointer', textDecoration: 'none', color: lit ? '#26211C' : 'rgba(251,247,240,.78)', background: 'transparent', border: 'none', whiteSpace: 'nowrap', transition: 'color .2s' }
            const setRef = (el: HTMLElement | null) => { refs.current[i] = el }
            return n.external
              ? <a key={n.to} ref={setRef as (el: HTMLAnchorElement | null) => void} href={n.to} style={st}>{n.label}</a>
              : <button key={n.to} ref={setRef as (el: HTMLButtonElement | null) => void} onClick={() => navigate(n.to)} style={st}>{n.label}</button>
          })}
        </nav>

        {/* Vpravo: streak + level + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, justifySelf: 'end' }}>
          {streak != null && <span style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 11, background: 'rgba(251,247,240,.08)', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#E8C88A' }}>🔥 {streak}</span>}
          <span style={{ display: 'flex', alignItems: 'center', height: 34, padding: '0 12px', borderRadius: 11, background: 'rgba(251,247,240,.08)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', color: 'rgba(251,247,240,.8)' }}>{t('menu.level').toUpperCase()} {lvl.level}</span>
          <LanguageSwitcher variant="glass"/>
          <button onClick={() => navigate('/account')} aria-label={t('menu.navProfile')} style={{ width: 38, height: 38, borderRadius: '50%', cursor: 'pointer', background: ACCENT_GRAD, color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15, border: onAccount ? '2px solid #FBF7F0' : '2px solid transparent', boxShadow: onAccount ? '0 0 0 2px rgba(217,119,87,.6)' : 'none' }}>{name.charAt(0).toUpperCase()}</button>
        </div>
      </div>
    </header>
  )
}

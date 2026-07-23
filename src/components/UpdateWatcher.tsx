import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { hasNewVersion } from '@/lib/appVersion'

// Cesty, kde se NESMÍ samo obnovit — hráč by přišel o rozehrané kolo.
const GAMEPLAY = /^\/(game|daily|try|multiplayer\/game)/

const CHECK_MS = 10 * 60 * 1000

/**
 * Hlídá, jestli nevyšel nový build. Mimo hru stránku rovnou obnoví (uživatel si
 * ničeho nevšimne), během hry jen nabídne tlačítko, ať nepřijde o rozehrané kolo.
 * V devu se nic neděje (běží se ze /src, ne z hashovaného bundlu).
 */
export default function UpdateWatcher() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [outdated, setOutdated] = useState(false)

  useEffect(() => {
    let alive = true
    const check = async () => {
      if (!alive || document.visibilityState !== 'visible') return
      if (await hasNewVersion()) { if (alive) setOutdated(true) }
    }
    check()
    const iv = setInterval(check, CHECK_MS)
    // Návrat do tabu je nejčastější okamžik, kdy uživatel drží starou verzi
    document.addEventListener('visibilitychange', check)
    return () => { alive = false; clearInterval(iv); document.removeEventListener('visibilitychange', check) }
  }, [])

  const inGameplay = GAMEPLAY.test(pathname)

  // Mimo hru obnov rovnou — bez ptaní
  useEffect(() => {
    if (outdated && !inGameplay) window.location.reload()
  }, [outdated, inGameplay])

  if (!outdated || !inGameplay) return null

  return (
    <div style={{
      position: 'fixed', left: 12, right: 12, zIndex: 1100,  // nad Leaflet ovládáním (1000)
      bottom: 'calc(12px + var(--safe-bottom))',
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 14,
      padding: '11px 14px', boxShadow: 'var(--shadow-lg)', maxWidth: 460, margin: '0 auto',
    }}>
      <span style={{ fontSize: 18 }}>✨</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink)' }}>{t('common.updateReady')}</span>
      <button onClick={() => window.location.reload()} style={{
        flexShrink: 0, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10,
        padding: '8px 14px', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
      }}>{t('common.reload')}</button>
    </div>
  )
}

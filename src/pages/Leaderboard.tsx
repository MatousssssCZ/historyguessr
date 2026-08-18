import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { currentLocale } from '@/i18n'
import { useAuth } from '@/hooks/useAuth'
import { levelFromXp } from '@/lib/leveling'
import { getGlobalLeaderboard, getWorldSlice, getFriendsLeaderboard, type LeaderboardRow } from '@/lib/supabase'
import { PageShell, PageHeader } from '@/components/ui/Page'
import MobileNav from '@/components/MobileNav'

const ACCENT_GRAD = 'linear-gradient(150deg,#d97757,#b85a3e)'
const GOLD = '#C89A3C'

type Tab = 'world' | 'friends'
type Entry = { rank: number; id: string; name: string; sub?: string; score: number; isMe: boolean }

export default function LeaderboardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, isAnonymous } = useAuth()
  const loc = currentLocale()

  const [tab, setTab] = useState<Tab>('world')
  const [loading, setLoading] = useState(true)
  const [world, setWorld] = useState<LeaderboardRow[]>([])
  const [slice, setSlice] = useState<LeaderboardRow[]>([])
  const [friends, setFriends] = useState<LeaderboardRow[]>([])

  useEffect(() => {
    let alive = true
    setLoading(true)
    Promise.all([
      getGlobalLeaderboard(50).catch(() => [] as LeaderboardRow[]),
      getWorldSlice(3).catch(() => [] as LeaderboardRow[]),
      isAnonymous ? Promise.resolve([] as LeaderboardRow[]) : getFriendsLeaderboard().catch(() => [] as LeaderboardRow[]),
    ]).then(([w, s, f]) => {
      if (!alive) return
      setWorld(w); setSlice(s); setFriends(f); setLoading(false)
    })
    return () => { alive = false }
  }, [isAnonymous])

  const worldEntries: Entry[] = world.map(r => ({
    rank: r.rank, id: r.user_id, name: r.username ?? '—',
    sub: `${t('menu.level')} ${levelFromXp(r.xp).level}`,
    score: r.total_score, isMe: r.user_id === user?.id,
  }))
  const inTop = world.some(r => r.user_id === user?.id)
  const sliceEntries: Entry[] = (!inTop && slice.length) ? slice.map(r => ({
    rank: r.rank, id: r.user_id, name: r.username ?? '—',
    sub: `${t('menu.level')} ${levelFromXp(r.xp).level}`,
    score: r.total_score, isMe: r.user_id === user?.id,
  })) : []
  const friendEntries: Entry[] = friends.map(r => ({
    rank: r.rank, id: r.user_id, name: r.user_id === user?.id ? t('round.you') : (r.username ?? '—'),
    sub: `${t('menu.level')} ${levelFromXp(r.xp).level}`,
    score: r.total_score, isMe: r.user_id === user?.id,
  }))

  const entries = tab === 'world' ? worldEntries : friendEntries
  const showSlice = tab === 'world' && sliceEntries.length > 0

  return (
    <PageShell maxWidth={720}>
      <PageHeader eyebrow={t('lb.subtitle')} title={t('lb.title')} onBack={() => navigate('/menu')}/>

      {/* Přepínač Svět / Přátelé */}
      <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 13, background: 'var(--paper-300)', marginBottom: 16, maxWidth: 320 }}>
        {(['world', 'friends'] as Tab[]).map(tk => {
          const on = tab === tk
          return (
            <button key={tk} onClick={() => setTab(tk)} style={{
              flex: 1, padding: '9px 0', borderRadius: 10, border: 0, cursor: 'pointer',
              background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-2)',
              fontFamily: 'var(--font-sans)', fontWeight: on ? 700 : 600, fontSize: 13.5,
              boxShadow: on ? 'var(--shadow-sm)' : 'none',
            }}>{tk === 'world' ? t('lb.world') : t('lb.friends')}</button>
          )
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" style={{ width: 26, height: 26 }}/></div>
      ) : entries.length === 0 ? (
        <div style={{ padding: '30px 4px', color: 'var(--ink-3)', fontSize: 14 }}>{t('lb.empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entries.map(e => <Row key={e.id} e={e} loc={loc} onOpen={() => navigate(`/player/${e.id}`)}/>)}
          {showSlice && (
            <>
              <div style={{ textAlign: 'center', color: 'var(--ink-3)', letterSpacing: 4, fontSize: 14, padding: '2px 0' }}>···</div>
              {sliceEntries.map(e => <Row key={`s-${e.id}`} e={e} loc={loc} onOpen={() => navigate(`/player/${e.id}`)}/>)}
            </>
          )}
        </div>
      )}
      <MobileNav active="home"/>
    </PageShell>
  )
}

function Row({ e, loc, onOpen }: { e: Entry; loc: string; onOpen?: () => void }) {
  const mono = (e.name || '?').trim().charAt(0).toUpperCase() || '?'
  const medal = e.rank <= 3
  return (
    <div role={onOpen ? 'button' : undefined} onClick={onOpen} style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 13, cursor: onOpen ? 'pointer' : 'default',
      background: e.isMe ? 'rgba(217,119,87,0.09)' : 'var(--surface)',
      border: `1px solid ${e.isMe ? 'var(--accent)' : 'var(--line)'}`,
    }}>
      <span style={{ width: 26, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: e.rank <= 3 || e.isMe ? 700 : 500, color: e.rank === 1 ? GOLD : e.isMe ? 'var(--accent)' : 'var(--ink-3)' }}>
        {medal ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}
      </span>
      <span style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: e.isMe ? '#fff' : 'var(--ink-2)', background: e.isMe ? ACCENT_GRAD : 'var(--paper-300)' }}>{mono}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: e.isMe ? 700 : 600, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
        {e.sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>{e.sub}</div>}
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: e.isMe ? 700 : 600, fontSize: 14, color: e.isMe ? 'var(--accent)' : 'var(--ink)' }}>{e.score.toLocaleString(loc)}</span>
      {onOpen && <span style={{ color: 'var(--ink-3)', fontSize: 16, flexShrink: 0 }}>›</span>}
    </div>
  )
}

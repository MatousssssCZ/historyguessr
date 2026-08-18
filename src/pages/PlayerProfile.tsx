import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { currentLocale } from '@/i18n'
import { levelFromXp } from '@/lib/leveling'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { getPublicProfile, getPublicCategoryHits, type PublicProfile } from '@/lib/supabase'
import { PageShell, PageHeader } from '@/components/ui/Page'
import { AchievementRow } from '@/pages/Stats'
import MobileNav from '@/components/MobileNav'

const ACCENT_GRAD = 'linear-gradient(150deg,#d97757,#b85a3e)'

export default function PlayerProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { userId } = useParams<{ userId: string }>()
  const loc = currentLocale()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [hits, setHits] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!userId) return
    let alive = true
    setLoading(true)
    Promise.all([getPublicProfile(userId).catch(() => null), getPublicCategoryHits(userId).catch(() => ({}))])
      .then(([p, h]) => { if (!alive) return; setProfile(p); setHits(h); setLoading(false) })
    return () => { alive = false }
  }, [userId])

  const name = profile?.username ?? '—'
  const mono = name.trim().charAt(0).toUpperCase() || '?'
  const lvl = profile ? levelFromXp(profile.xp) : null
  const avgRound = profile && profile.rounds_played > 0 ? Math.round(profile.sum_round_score / profile.rounds_played) : 0
  const memberSince = profile ? new Date(profile.created_at).toLocaleDateString(loc, { month: 'long', year: 'numeric' }) : ''

  return (
    <PageShell maxWidth={720}>
      <PageHeader eyebrow={t('pp.eyebrow')} title={name} onBack={() => navigate(-1)}/>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" style={{ width: 26, height: 26 }}/></div>
      ) : !profile ? (
        <div style={{ padding: '30px 4px', color: 'var(--ink-3)', fontSize: 14 }}>{t('pp.notFound')}</div>
      ) : (
        <>
          {/* Hlavička profilu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '16px 18px', marginBottom: 14 }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', flexShrink: 0, background: ACCENT_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--font-serif)', fontSize: 26 }}>{mono}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                {t('menu.level')} {lvl?.level} · {t('pp.memberSince', { when: memberSince })}
              </div>
            </div>
          </div>

          {/* Metriky */}
          <div className="rgrid rgrid-4" style={{ marginBottom: 18 }}>
            <StatTile label={t('pp.rank')} value={`#${profile.world_rank.toLocaleString(loc)}`}/>
            <StatTile label={t('pp.pointsRounds')} value={profile.sum_round_score.toLocaleString(loc)} hint={t('pp.pointsRoundsHint')}/>
            <StatTile label={t('pp.xp')} value={profile.xp.toLocaleString(loc)} hint={t('pp.xpHint')}/>
            <StatTile label={t('pp.streak')} value={t('pp.days', { count: profile.streak })}/>
            <StatTile label={t('pp.avgRound')} value={`${avgRound}`} hint={t('pp.outOf1000')}/>
            <StatTile label={t('pp.rounds')} value={profile.rounds_played.toLocaleString(loc)}/>
          </div>

          {/* Odznaky */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: '4px 0 12px' }}>{t('pp.achievements')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ACHIEVEMENTS.map(cat => <AchievementRow key={cat.id} cat={cat} hits={hits[cat.id] ?? 0}/>)}
          </div>
        </>
      )}
      <MobileNav active="home"/>
    </PageShell>
  )
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 5 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{value}</div>
      {hint && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-3)', marginTop: 1 }}>{hint}</div>}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { currentLocale } from '@/i18n'
import { levelFromXp } from '@/lib/leveling'
import { ACHIEVEMENTS } from '@/lib/achievements'
import { getPublicProfile, getPublicCategoryHits, type PublicProfile } from '@/lib/supabase'
import { getPublicShowcase, relicModel, relicName, relicDesc, RARITY_META, type PublicRelic } from '@/lib/relics'
import RelicViewer from '@/components/RelicViewer'
import RelicBadge from '@/components/RelicBadge'
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
  const [showcase, setShowcase] = useState<PublicRelic[]>([])
  const [relicDetail, setRelicDetail] = useState<PublicRelic | null>(null)

  useEffect(() => {
    if (!userId) return
    let alive = true
    setLoading(true)
    Promise.all([getPublicProfile(userId).catch(() => null), getPublicCategoryHits(userId).catch(() => ({})), getPublicShowcase(userId).catch(() => [])])
      .then(([p, h, sc]) => { if (!alive) return; setProfile(p); setHits(h); setShowcase(sc as PublicRelic[]); setLoading(false) })
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

          {/* Vystavené relikvie */}
          {showcase.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: '4px 0 12px' }}>{t('pp.showcase')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
                {showcase.map(pr => {
                  return (
                    <button key={pr.relic.id} onClick={() => setRelicDetail(pr)} style={{
                      border: '1px solid var(--line)', borderRadius: 15, overflow: 'hidden',
                      background: 'var(--surface)', cursor: 'pointer', padding: '14px 11px 11px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, textAlign: 'center',
                    }}>
                      <RelicBadge rarity={pr.state} iconUrl={pr.relic.icon_url} name={relicName(pr.relic)} size={72}/>
                      <div style={{ minWidth: 0, width: '100%' }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{relicName(pr.relic)}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--ink-3)', marginTop: 3 }}>{t('kron.rar_' + pr.state)}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Odznaky */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: '4px 0 12px' }}>{t('pp.achievements')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ACHIEVEMENTS.map(cat => <AchievementRow key={cat.id} cat={cat} hits={hits[cat.id] ?? 0}/>)}
          </div>
        </>
      )}
      {relicDetail && <PublicRelicModal pr={relicDetail} owner={name} onClose={() => setRelicDetail(null)}/>}
      <MobileNav active="home"/>
    </PageShell>
  )
}

function PublicRelicModal({ pr, owner, onClose }: { pr: PublicRelic; owner: string; onClose: () => void }) {
  const { t } = useTranslation()
  const tone = RARITY_META[pr.state].tone
  const model = relicModel(pr.relic, pr.state)
  const rank = ({ common: 1, rare: 2, epic: 3, legendary: 4 } as const)[pr.state]
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(31,27,22,0.58)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--paper-50)', borderRadius: 24, overflow: 'hidden', width: '100%', maxWidth: 420, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)', animation: 'scaleIn 240ms var(--ease-spring) both' }}>
        <div style={{ position: 'relative', height: 250, background: 'var(--ink-dark, #1A1611)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 42%, ${tone}6b, rgba(16,13,10,.9) 74%)` }}/>
          <RelicViewer modelUrl={model} glow={rank >= 3 ? 'gold' : 'stone'}/>
          <span style={{ position: 'absolute', left: 20, top: 20, padding: '6px 12px', borderRadius: 999, background: tone, fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: '#FBF7F0' }}>{t('kron.rar_' + pr.state)}</span>
          <button onClick={onClose} style={{ position: 'absolute', right: 20, top: 20, width: 32, height: 32, borderRadius: 10, background: 'rgba(251,247,240,0.14)', border: '1px solid rgba(251,247,240,0.2)', color: '#fff', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '20px 22px 22px', overflowY: 'auto' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--ink-3)' }}>{[pr.relic.year_label, pr.relic.category && t(`catShort.${pr.relic.category}`, { defaultValue: pr.relic.category })].filter(Boolean).join(' · ').toUpperCase()}</div>
          <h3 style={{ margin: '9px 0 0', fontFamily: 'var(--font-serif)', fontSize: 27, color: 'var(--ink)', letterSpacing: '-0.025em' }}>{relicName(pr.relic)}</h3>
          {relicDesc(pr.relic) && <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-2)' }}>{relicDesc(pr.relic)}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12.5, color: 'var(--ink-3)' }}>
            <span>{t('pp.showcasedBy', { name: owner })}</span>
            <span>·</span>
            <span>{t('kron.ownedByPct', { n: pr.ownedPct })}</span>
          </div>
        </div>
      </div>
    </div>
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

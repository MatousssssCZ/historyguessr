import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { localizedTitle, localizedDescription } from '@/lib/eventLocale'
import { currentLocale } from '@/i18n'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  getCampaignBundle, startCampaignAttempt, getEventsByIds, campaignErrorOf,
  FREE_EXPEDITIONS, type CampaignBundle,
} from '@/lib/supabase'
import MobileNav from '@/components/MobileNav'
import DesktopSidebar from '@/components/DesktopSidebar'
import { PageShell, PageHeader } from '@/components/ui/Page'
import Icon from '@/components/Icon'
import { useIsMobile } from '@/hooks/useIsMobile'
import CompassLoader from '@/components/CompassLoader'
import { FREE_ENTITLEMENTS } from '@/lib/entitlements'
import { categoryAccess, campaignAccess, categoryStars, formatExpeditions } from '@/lib/campaignLogic'
import { campaignAnalytics, monetizationAnalytics } from '@/lib/analytics'
import type { Campaign, CampaignCategory } from '@/types/database'

const GOLD = '#f5ce8b'
const ACCENT_GRAD = 'linear-gradient(150deg,#d97757,#b85a3e)'

export default function CampaignsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { categoryId } = useParams()
  const [bundle, setBundle] = useState<CampaignBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()

  const reload = useCallback(async () => {
    if (!user) return
    try {
      setBundle(await getCampaignBundle(user.id))
    } catch (e) {
      console.warn('[Campaigns] načtení selhalo (běží migrace 031/032?):', e)
      setBundle({
        categories: [], campaignsByCat: {}, progress: {}, totalStars: 0,
        expeditions: FREE_EXPEDITIONS, isPremium: false, entitlements: FREE_ENTITLEMENTS,
      })
    }
    setLoading(false)
  }, [user])

  useEffect(() => { reload() }, [reload])
  useEffect(() => { if (user && !categoryId) campaignAnalytics.viewed(user.id) }, [user, categoryId])

  if (loading || !bundle) {
    return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-200)' }}><CompassLoader size={60} light/></div>
  }

  // Detail kategorie má vlastní barevnou hlavičku (bez horní lišty)
  if (categoryId) {
    return (
      <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--paper-200)' }}>
        <DesktopSidebar/>
        <div style={{ flex: 1, minWidth: 0, paddingBottom: isMobile ? 'var(--nav-space)' : 40 }}>
          <CategoryView bundle={bundle} categoryId={categoryId} isMobile={isMobile} userId={user?.id} onBack={() => navigate('/campaigns')} onReload={reload}/>
        </div>
        {isMobile && <MobileNav active="campaigns"/>}
      </div>
    )
  }

  return (
    <PageShell maxWidth={1100}>
        <PageHeader
          title={t('camp.title')}
          onBack={isMobile ? () => navigate('/menu') : undefined}
          actions={<><StarPill stars={bundle.totalStars}/><ExpeditionPill bundle={bundle}/></>}
        />
        <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '-14px 0 20px' }}>{t('camp.sub')}</p>

        <CategoriesGrid bundle={bundle} isMobile={isMobile} userId={user?.id} onOpen={(id) => {
          campaignAnalytics.categoryOpened(id, user?.id)
          navigate(`/campaigns/${id}`)
        }}/>
      {isMobile && <MobileNav active="campaigns"/>}
    </PageShell>
  )
}

// ─── Pilulky v hlavičce ───────────────────────────────────
function StarPill({ stars }: { stars: number }) {
  const { t } = useTranslation()
  return (
    <span title={t('camp.starsTotal')} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 20,
      background: 'var(--surface)', border: '1px solid var(--line)',
      fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--ink)',
    }}><span style={{ color: GOLD }}>★</span> {stars}</span>
  )
}

function ExpeditionPill({ bundle }: { bundle: CampaignBundle }) {
  const { t } = useTranslation()
  const { remaining, perDay } = bundle.expeditions
  const empty = remaining === 0
  return (
    <span title={t('camp.expeditionsLeft')} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 20,
      background: 'var(--surface)', border: `1px solid ${empty ? 'rgba(192,57,43,0.35)' : 'var(--line)'}`,
      fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
      color: empty ? 'var(--danger)' : 'var(--ink)',
    }}><span style={{ color: 'var(--accent)' }}>⚡</span> {formatExpeditions(remaining, perDay)}</span>
  )
}

// ═══════════════════ Mapa kategorií ═══════════════════
function CategoriesGrid({ bundle, isMobile, userId, onOpen }: {
  bundle: CampaignBundle; isMobile: boolean; userId?: string; onOpen: (id: string) => void
}) {
  if (bundle.categories.length === 0) return <ComingSoonCard full/>
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: 16,
    }}>
      {bundle.categories.map(cat => (
        <CategoryCard key={cat.id} cat={cat} bundle={bundle} userId={userId} onOpen={onOpen}/>
      ))}
      {!isMobile && <ComingSoonCard/>}
    </div>
  )
}

function CategoryCard({ cat, bundle, userId, onOpen }: {
  cat: CampaignCategory; bundle: CampaignBundle; userId?: string; onOpen: (id: string) => void
}) {
  const { t } = useTranslation()
  const camps = bundle.campaignsByCat[cat.id] ?? []
  const acc = categoryAccess(cat, bundle.totalStars, bundle.entitlements)
  const cs = categoryStars(camps, bundle.progress)
  const locked = !acc.isUnlocked
  const color = cat.color || '#BE6240'
  // Obrázek kategorie nahraný v administraci (u zamčených jen zešediví, zámek zůstává)
  const headerImg = cat.hero_image_url || null

  return (
    <button onClick={() => {
      if (locked) {
        campaignAnalytics.lockedAttempt('category', cat.id, acc.lockReason ?? 'stars', acc.missingStars, userId)
        if (acc.lockReason === 'premium') monetizationAnalytics.upsellShown('premium_category', userId)
        return
      }
      onOpen(cat.id)
    }} style={{
      position: 'relative', textAlign: 'left', padding: 0, overflow: 'hidden', cursor: locked ? 'not-allowed' : 'pointer',
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18,
      transition: 'transform 140ms, box-shadow 140ms',
    }}
      onMouseEnter={e => { if (!locked) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 28px -14px rgba(42,31,23,0.3)' } }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>

      {/* Hlavička: ilustrační fotka z události kategorie + barevný scrim, ikona a odznaky */}
      <div style={{
        position: 'relative', height: 104, padding: 14,
        background: locked ? 'var(--paper-300)' : `linear-gradient(155deg, ${color}, ${shade(color, -18)})`,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        filter: locked ? 'grayscale(0.7)' : 'none', overflow: 'hidden',
      }}>
        {headerImg && (
          <>
            <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: `url(${headerImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}/>
            <div aria-hidden style={{ position: 'absolute', inset: 0, background: `linear-gradient(155deg, ${color}cc, ${shade(color, -18)}dd)` }}/>
          </>
        )}
        <span style={{ position: 'relative', fontSize: 30, opacity: locked ? 0.45 : 1, textShadow: headerImg ? '0 1px 6px rgba(0,0,0,0.4)' : 'none' }}>{cat.icon || '📁'}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          {cat.is_premium && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, background: GOLD, color: '#5a4527',
              fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, padding: '4px 9px', borderRadius: 20,
            }}>♛ PREMIUM</span>
          )}
          {!locked && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(38,33,28,0.62)',
              backdropFilter: 'blur(6px)', color: '#fff',
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
            }}><span style={{ color: GOLD }}>★</span> {cs.earned}/{cs.max}</span>
          )}
        </div>

        {/* Zámek přes hlavičku */}
        {locked && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{
              width: 52, height: 52, borderRadius: '50%', background: 'rgba(38,33,28,0.45)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21,
            }}>🔒</span>
          </div>
        )}
      </div>

      {/* Tělo */}
      <div style={{ padding: '14px 16px 16px', opacity: locked ? 0.6 : 1 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{localizedTitle(cat)}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {locked
            ? (acc.lockReason === 'premium' ? t('camp.premiumPart') : t('camp.missingStars', { n: acc.missingStars }))
            : `${t('camp.count', { count: camps.length })}${localizedDescription(cat) ? ` · ${localizedDescription(cat)}` : ''}`}
        </div>
      </div>
    </button>
  )
}

function ComingSoonCard({ full }: { full?: boolean }) {
  const { t } = useTranslation()
  return (
    <div style={{
      border: '1.5px dashed var(--line-strong)', borderRadius: 18, minHeight: full ? 220 : 180,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
      color: 'var(--ink-3)', textAlign: 'center', padding: 20,
      gridColumn: full ? '1 / -1' : undefined,
    }}>
      <span style={{ fontSize: 26, opacity: 0.5 }}>⧗</span>
      <span style={{ fontSize: 13.5, lineHeight: 1.4, whiteSpace: 'pre-line' }}>{t('camp.comingSoon')}</span>
    </div>
  )
}

// ═══════════════════ Detail kategorie ═══════════════════
function CategoryView({ bundle, categoryId, isMobile, userId, onBack, onReload }: {
  bundle: CampaignBundle; categoryId: string; isMobile: boolean; userId?: string
  onBack: () => void; onReload: () => Promise<void>
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [starting, setStarting] = useState<string | null>(null)
  const [intro, setIntro] = useState<Campaign | null>(null)  // popis kampaně před spuštěním
  const [showUpsell, setShowUpsell] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'playable' | 'completed' | 'locked'>('all')

  const cat = bundle.categories.find(c => c.id === categoryId)
  const camps = bundle.campaignsByCat[categoryId] ?? []
  const cs = categoryStars(camps, bundle.progress)

  async function play(campaign: Campaign) {
    if (starting) return
    setErr(null); setStarting(campaign.id)
    try {
      // Server ověří hvězdy, Premium i limit a teprve pak odečte výpravu.
      campaignAnalytics.opened(campaign.id, userId)
      const { attemptId, eventIds } = await startCampaignAttempt(campaign.id)
      const events = await getEventsByIds(eventIds)
      if (events.length < campaign.rounds_count) {
        setErr(t('camp.eventsLoadFailed')); setStarting(null); return
      }
      campaignAnalytics.started(campaign.id, userId)
      navigate('/game', {
        state: { events, attemptId, campaignId: campaign.id, campaignTitle: localizedTitle(campaign), rounds: events.length },
      })
    } catch (e: unknown) {
      setStarting(null)
      const kind = campaignErrorOf(e)
      if (kind === 'no_energy') {
        monetizationAnalytics.expeditionsExhausted(userId)
        monetizationAnalytics.upsellShown('no_expeditions', userId)
        setShowUpsell(true); return
      }
      if (kind === 'premium_required') monetizationAnalytics.upsellShown('premium_campaign', userId)
      const raw = (e as { message?: string })?.message ?? ''
      console.error('[Campaigns] start selhal:', e)
      setErr(
        kind === 'premium_required' ? t('camp.premiumCampaign')
        : kind === 'locked_global_stars' || kind === 'locked_category_stars' ? t('camp.notEnoughStars')
        : kind === 'campaign_incomplete' ? t('camp.incomplete')
        // U neznámé chyby ukaž i syrovou hlášku ze serveru — ať jde poznat příčina
        : `${t('camp.startFailed')}${raw ? ` (${raw})` : ''}`,
      )
    }
  }

  if (!cat || !categoryAccess(cat, bundle.totalStars, bundle.entitlements).isUnlocked) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-3)' }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>🔒</div>
        <p>{t('camp.lockedCat')}</p>
        <button className="btn btn-ghost" onClick={onBack}>{t('camp.backToCampaigns')}</button>
      </div>
    )
  }

  const color = cat.color || '#BE6240'
  const heroImg = cat.hero_image_url || null

  // Odvozený stav každé kampaně (server-pravda přes campaignAccess + progress)
  const derived = camps.map((c, i) => {
    const acc = campaignAccess(c, cs.earned, bundle.entitlements, cat)
    const prog = bundle.progress[c.id]
    const completed = !!prog?.completed_runs
    const st: 'completed' | 'playable' | 'locked' = !acc.isUnlocked ? 'locked' : completed ? 'completed' : 'playable'
    return { c, i, acc, prog, st }
  })
  const continueId = derived.find(d => d.st === 'playable')?.c.id ?? null
  const counts = {
    all: derived.length,
    playable: derived.filter(d => d.st === 'playable').length,
    completed: derived.filter(d => d.st === 'completed').length,
    locked: derived.filter(d => d.st === 'locked').length,
  }
  const completedTotal = counts.completed
  const visible = filter === 'all' ? derived : derived.filter(d => d.st === filter)
  const pct = derived.length ? (completedTotal / derived.length) * 100 : 0

  const backBtn = (
    <button onClick={onBack} aria-label={t('camp.back')} style={{
      position: 'absolute', top: isMobile ? 'calc(var(--safe-top) + 12px)' : 16, left: isMobile ? 14 : 16, zIndex: 3,
      width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
      background: 'rgba(20,16,10,0.5)', backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontSize: 16,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>←</button>
  )

  // Hrdina — obrázek + gradient scrim, text jen ve spodním tmavém pruhu
  const hero = (
    <div style={{ position: 'relative', height: isMobile ? 198 : 212, overflow: 'hidden', borderRadius: isMobile ? 0 : 20, background: `linear-gradient(155deg, ${color}, ${shade(color, -18)})` }}>
      {heroImg && <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: `url(${heroImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}/>}
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(20,16,10,.45) 0%, rgba(20,16,10,0) 30%, rgba(20,16,10,.15) 55%, rgba(20,16,10,.88) 100%)' }}/>
      {backBtn}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: isMobile ? '0 18px 16px' : '0 28px 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, color: '#E8C88A' }}>
            <Icon name="swords" size={15}/>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{t('camp.catKicker')}</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: isMobile ? 26 : 34, color: '#fff', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.05, textShadow: '0 2px 12px rgba(0,0,0,.55)' }}>{localizedTitle(cat)}</h1>
          {localizedDescription(cat) && (
            <p style={{ fontSize: isMobile ? 12.5 : 14, color: 'rgba(245,241,232,0.82)', margin: '6px 0 0', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden', maxWidth: 560 }}>{localizedDescription(cat)}</p>
          )}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fff', whiteSpace: 'nowrap' }}><span style={{ color: GOLD }}>★</span> {cs.earned} / {cs.max}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>·</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap' }}>{completedTotal} / {derived.length} {t('camp.campaignsWord')}</span>
              <div style={{ flex: 1, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.2)', overflow: 'hidden', minWidth: 24 }}><div style={{ height: '100%', width: `${pct}%`, background: '#BE6240' }}/></div>
            </div>
          )}
        </div>
        {!isMobile && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 18, padding: '12px 18px', borderRadius: 14, background: 'rgba(20,16,10,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.14)' }}>
            <HeroStat label={t('camp.hStars')} value={`${cs.earned} / ${cs.max}`}/>
            <div style={{ width: 1, height: 34, background: 'rgba(255,255,255,0.18)' }}/>
            <HeroStat label={t('camp.hDone')} value={`${completedTotal} / ${derived.length}`}/>
            <div style={{ width: 90, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, background: '#BE6240' }}/></div>
          </div>
        )}
      </div>
    </div>
  )

  // Filtry stavu (klientská filtrace)
  const filterChips: { key: typeof filter; label: string; count: number }[] = [
    { key: 'all', label: t('camp.fAll'), count: counts.all },
    { key: 'playable', label: t('camp.fPlayable'), count: counts.playable },
    ...(!isMobile ? [{ key: 'completed' as const, label: t('camp.fCompleted'), count: counts.completed }] : []),
    { key: 'locked', label: t('camp.fLocked'), count: counts.locked },
  ]
  const filters = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
      {filterChips.map(f => {
        const on = filter === f.key
        return (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            border: `1px solid ${on ? '#26211C' : 'var(--line-strong)'}`, background: on ? '#26211C' : 'var(--surface)',
            color: on ? 'var(--paper-50)' : 'var(--ink-2)', fontFamily: 'var(--font-sans)', fontWeight: on ? 700 : 500, fontSize: 13,
          }}>{f.label} <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: on ? 0.85 : 0.6 }}>{f.count}</span></button>
        )
      })}
      {!isMobile && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-3)', flexShrink: 0 }}>{t('camp.starsUnlock')}</span>}
    </div>
  )

  const grid = (
    <>
      {err && <div className="alert alert-error" style={{ marginBottom: 14 }}>⚠ {err}</div>}
      {visible.length === 0 && <p style={{ color: 'var(--ink-3)', fontSize: 14, padding: '20px 2px' }}>{t('camp.fEmpty')}</p>}
      <div style={isMobile
        ? { display: 'flex', flexDirection: 'column', gap: 12 }
        : { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: 186, gap: 12 }}>
        {visible.map(d => (
          <CampaignCard key={d.c.id} d={d} cat={cat} isMobile={isMobile} categoryStarsEarned={cs.earned}
            isContinue={d.c.id === continueId} busy={starting === d.c.id} onPlay={setIntro}/>
        ))}
      </div>
    </>
  )

  const overlays = (
    <>
      {intro && <CampaignIntro campaign={intro} cat={cat} bundle={bundle} busy={starting === intro.id} onStart={() => { const c = intro; setIntro(null); play(c) }} onClose={() => setIntro(null)}/>}
      {showUpsell && <ExpeditionUpsell bundle={bundle} userId={userId} onClose={() => { setShowUpsell(false); onReload() }}/>}
    </>
  )

  if (!isMobile) {
    return (
      <>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '20px 40px 0' }}>{hero}</div>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '18px 40px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filters}
          {grid}
        </div>
        {overlays}
      </>
    )
  }
  return (
    <>
      {hero}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {filters}
        {grid}
      </div>
      {overlays}
    </>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(245,241,232,0.6)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: '#fff' }}>{value}</div>
    </div>
  )
}

type Derived = { c: Campaign; i: number; acc: ReturnType<typeof campaignAccess>; prog: CampaignBundle['progress'][string] | undefined; st: 'completed' | 'playable' | 'locked' }

function CampaignCard({ d, cat, isMobile, isContinue, busy, categoryStarsEarned, onPlay }: {
  d: Derived; cat: CampaignCategory; isMobile: boolean; isContinue: boolean; busy: boolean; categoryStarsEarned: number; onPlay: (c: Campaign) => void
}) {
  const { t } = useTranslation()
  const { c, i, acc, prog, st } = d
  const reqStars = c.required_category_stars ?? 0
  const curStars = Math.min(categoryStarsEarned, reqStars)
  const color = cat.color || '#BE6240'
  const locked = st === 'locked'
  const completed = st === 'completed'
  const stars = prog?.best_stars ?? 0
  const clickable = !locked && !busy
  const go = () => { if (clickable) onPlay(c) }

  const imgBg: React.CSSProperties = { position: 'relative', flexShrink: 0, overflow: 'hidden', background: `linear-gradient(155deg, ${color}, ${shade(color, -18)})` }
  const imgInner = (
    <>
      {c.visual_url && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${c.visual_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}/>}
      {locked && <div style={{ position: 'absolute', inset: 0, background: 'rgba(30,26,20,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.85)' }}><Icon name="lock" size={22}/></div>}
    </>
  )
  const kicker = (label: string) => (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{label}</div>
  )
  const title = (
    <div style={{ fontFamily: 'var(--font-serif)', fontSize: isContinue ? 20 : 16.5, letterSpacing: '-0.01em', color: locked ? '#5b5349' : 'var(--ink)', lineHeight: 1.15, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{localizedTitle(c)}</div>
  )

  // ── A) Pokračuj zde ──
  if (isContinue) {
    const inner = (
      <>
        <div style={{ ...imgBg, width: isMobile ? '100%' : 150, height: isMobile ? 74 : 'auto' }}>
          {imgInner}
          <span style={{ position: 'absolute', top: 10, left: 10, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 999, background: 'var(--accent)', color: '#fff' }}>{t('camp.continueHere')}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, padding: isMobile ? '12px 14px 14px' : '16px 18px', display: 'flex', flexDirection: 'column' }}>
          {kicker(`${t('camp.continueHere')} · ${t('camp.campNo', { n: i + 1 })}`)}
          <div style={{ margin: '6px 0 4px' }}>{title}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>{t('camp.eventsShort', { n: c.rounds_count })}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: isMobile ? 12 : 'auto', flexDirection: isMobile ? 'column' : 'row' }}>
            <div style={{ color: 'var(--line-strong)', fontSize: 15, letterSpacing: 3 }}>☆☆☆</div>
            <button className="btn btn-accent" style={{ fontSize: 14, minWidth: 110, width: isMobile ? '100%' : 'auto' }} disabled={busy} onClick={(e) => { e.stopPropagation(); go() }}>{busy ? '…' : t('camp.play')} →</button>
          </div>
        </div>
      </>
    )
    return (
      <div role="button" onClick={go} style={{
        gridColumn: isMobile ? undefined : 'span 2', flexShrink: 0,
        display: 'flex', flexDirection: isMobile ? 'column' : 'row', cursor: clickable ? 'pointer' : 'default',
        background: 'var(--surface)', border: '1.5px solid var(--accent)', borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 10px 26px -14px rgba(190,98,64,0.5)', height: isMobile ? 'auto' : 186,
      }}>{inner}</div>
    )
  }

  // ── B/C/D) mřížkové karty (obrázek nahoře + obsah dole) ──
  return (
    <div role={clickable ? 'button' : undefined} onClick={go} style={{
      flexShrink: 0, display: 'flex', flexDirection: 'column', cursor: clickable ? 'pointer' : 'default',
      background: locked ? '#F4EEE4' : 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden',
      height: isMobile ? 'auto' : 186,
    }}>
      <div style={{ ...imgBg, height: isMobile ? 84 : 92 }}>
        {imgInner}
        {completed && <span style={{ position: 'absolute', top: 10, left: 10, display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 999, background: '#4E7A50', color: '#fff' }}>✓ {t('camp.done')}</span>}
        {!completed && !locked && <span style={{ position: 'absolute', top: 10, left: 10, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: 999, background: 'var(--surface)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}>{t('camp.fPlayable')}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0, padding: '11px 14px 13px', display: 'flex', flexDirection: 'column' }}>
        {kicker(t('camp.campNo', { n: i + 1 }))}
        <div style={{ margin: '5px 0 0' }}>{title}</div>
        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
          {locked ? (
            acc.lockReason === 'premium' ? (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#5b5349' }}>{t('camp.premiumPart')}</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ height: 5, borderRadius: 999, background: 'var(--line)', overflow: 'hidden', flex: 1, marginRight: 10 }}>
                  <div style={{ height: '100%', width: `${Math.round((curStars / Math.max(1, reqStars)) * 100)}%`, background: '#C89A3C' }}/>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#5b5349', whiteSpace: 'nowrap' }}>{curStars} / {reqStars} <span style={{ color: '#C89A3C' }}>★</span></span>
              </div>
            )
          ) : completed ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <StarRow stars={stars}/>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{(prog?.best_score ?? 0).toLocaleString('cs-CZ')} b.</span>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12.5, flexShrink: 0 }} disabled={busy} onClick={(e) => { e.stopPropagation(); go() }}>{busy ? '…' : t('camp.replay')}</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--ink-3)' }}>{t('camp.eventsShort', { n: c.rounds_count })}</span>
              <button className="btn btn-ghost" style={{ fontSize: 12.5, minWidth: 78, flexShrink: 0 }} disabled={busy} onClick={(e) => { e.stopPropagation(); go() }}>{busy ? '…' : t('camp.play')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CampaignIntro({ campaign, cat, bundle, busy, onStart, onClose }: {
  campaign: Campaign; cat: CampaignCategory; bundle: CampaignBundle
  busy: boolean; onStart: () => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const color = cat.color || '#BE6240'
  const prog = bundle.progress[campaign.id]
  const played = !!prog?.completed_runs

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(38,33,28,0.58)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--paper-50)', borderRadius: 24, overflow: 'hidden', width: '100%', maxWidth: 440,
        maxHeight: '90dvh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)',
        animation: 'scaleIn 240ms var(--ease-spring) both',
      }}>
        {/* Vizuál kampaně (nebo barevný podklad kategorie) */}
        <div style={{
          position: 'relative', height: 150, flexShrink: 0,
          background: `linear-gradient(155deg, ${color}, ${shade(color, -18)})`,
        }}>
          {campaign.visual_url && (
            <>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${campaign.visual_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}/>
              <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(155deg, ${color}bb, ${shade(color, -18)}dd)` }}/>
            </>
          )}
          <div style={{ position: 'absolute', left: 18, right: 18, bottom: 14, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <span style={{ fontSize: 26 }}>{cat.icon || '🏛'}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>{localizedTitle(cat)}</span>
          </div>
          {campaign.is_premium && (
            <span style={{
              position: 'absolute', top: 14, right: 14, background: GOLD, color: '#5a4527',
              fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, padding: '4px 9px', borderRadius: 20,
            }}>♛ PREMIUM</span>
          )}
        </div>

        <div style={{ padding: '18px 22px 0', overflowY: 'auto' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 25, lineHeight: 1.15, letterSpacing: '-0.01em', color: 'var(--ink)', margin: '0 0 8px' }}>
            {localizedTitle(campaign)}
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <Chip>{t('camp.roundsCount', { n: campaign.rounds_count })}</Chip>
            {played && prog && (
              <Chip>{t('camp.bestResult')}: {prog.best_score.toLocaleString(currentLocale())} b.</Chip>
            )}
          </div>
          {played && <div style={{ marginBottom: 14 }}><StarRow stars={prog?.best_stars ?? 0} size={18}/></div>}

          {localizedDescription(campaign) && (
            <>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 7px' }}>
                {t('camp.intro')}
              </p>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 18px' }}>{localizedDescription(campaign)}</p>
            </>
          )}
        </div>

        <div style={{ padding: '4px 22px 20px', flexShrink: 0 }}>
          <button onClick={onStart} disabled={busy} style={{
            width: '100%', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 14,
            padding: 15, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15,
            cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
            boxShadow: '0 12px 26px -8px rgba(217,119,87,0.5)',
          }}>{busy ? '…' : `${played ? t('camp.replay') : t('camp.start')} →`}</button>
          <button onClick={onClose} style={{
            width: '100%', marginTop: 8, background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--ink-3)', fontSize: 14, padding: 8, fontFamily: 'var(--font-sans)',
          }}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)',
      background: 'var(--paper-200)', border: '1px solid var(--line)', borderRadius: 999, padding: '5px 11px',
    }}>{children}</span>
  )
}

export function StarRow({ stars, size = 15 }: { stars: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3 }}>
      {[0, 1, 2].map(k => (
        <span key={k} style={{ fontSize: size, lineHeight: 1, color: stars > k ? GOLD : 'var(--line-strong)' }}>★</span>
      ))}
    </span>
  )
}

// ═══════════════════ Upsell — došly výpravy ═══════════════════
function ExpeditionUpsell({ bundle, userId, onClose }: { bundle: CampaignBundle; userId?: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { perDay, resetsAt } = bundle.expeditions
  const resetTxt = resetsAt
    ? new Date(resetsAt).toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' })
    : t('camp.upsellMidnight')
  const benefits = [
    t('camp.upsellB1'),
    t('camp.upsellB2'),
    t('camp.upsellB3'),
  ]
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(38,33,28,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <div style={{ background: 'var(--paper-50)', borderRadius: 24, padding: '30px 26px', maxWidth: 380, width: '100%', boxShadow: 'var(--shadow-xl)', textAlign: 'center' }}>
        <div style={{
          width: 62, height: 62, borderRadius: 17, margin: '0 auto 16px', background: ACCENT_GRAD,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
          boxShadow: '0 14px 28px -10px rgba(217,119,87,0.55)',
        }}>⚡</div>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, margin: '0 0 8px', color: 'var(--ink)' }}>{t('camp.upsellTitle')}</h3>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 20px' }}>
          {t('camp.upsellBody', { n: perDay })}<br/>{t('camp.upsellNext', { time: resetTxt })}
        </p>

        <div style={{ background: 'var(--paper-200)', border: '1px solid var(--line)', borderRadius: 16, padding: 16, marginBottom: 20, textAlign: 'left' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', marginBottom: 10 }}>{t('camp.upsellWith')}</div>
          {benefits.map(b => (
            <div key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13.5, color: 'var(--ink-2)', padding: '5px 0' }}>
              <span style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1, background: '#5c9468',
                color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✓</span>
              {b}
            </div>
          ))}
        </div>

        <button className="btn btn-accent" style={{ width: '100%', padding: 14, fontSize: 15, marginBottom: 10 }}
          onClick={() => {
            monetizationAnalytics.upsellCtaClicked('no_expeditions', userId)
            alert(t('camp.premiumSoon'))
          }}>{t('camp.upsellCta')}</button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13.5, padding: 6 }}>
          {t('camp.upsellLater')}
        </button>
      </div>
    </div>
  )
}

// ─── utils ────────────────────────────────────────────────

/** Ztmaví/zesvětlí hex barvu o dané procento (pro gradient hlavičky). */
function shade(hex: string, pct: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return hex
  const adj = (v: number) => Math.max(0, Math.min(255, Math.round(v + (v * pct) / 100)))
  const [r, g, b] = [1, 2, 3].map(i => adj(parseInt(m[i], 16)))
  return `rgb(${r},${g},${b})`
}


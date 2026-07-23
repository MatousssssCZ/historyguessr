import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLocale } from '@/i18n'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  getCampaignBundle, startCampaignAttempt, getEventsByIds, campaignErrorOf,
  FREE_EXPEDITIONS, type CampaignBundle,
} from '@/lib/supabase'
import MobileNav from '@/components/MobileNav'
import DesktopSidebar from '@/components/DesktopSidebar'
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
        <div style={{ flex: 1, minWidth: 0, paddingBottom: isMobile ? 'calc(88px + var(--safe-bottom))' : 40 }}>
          <CategoryView bundle={bundle} categoryId={categoryId} isMobile={isMobile} userId={user?.id} onBack={() => navigate('/campaigns')} onReload={reload}/>
        </div>
        {isMobile && <MobileNav active="campaigns"/>}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--paper-200)' }}>
      <DesktopSidebar/>
      <div style={{ flex: 1, minWidth: 0, paddingBottom: isMobile ? 'calc(88px + var(--safe-bottom))' : 40, paddingTop: 'var(--safe-top)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '18px 18px 0' : '30px 40px' }}>
        {/* Hlavička: zpět + název + ★ + výpravy */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            {isMobile && <button onClick={() => navigate('/menu')} aria-label={t('camp.backToMenu')} style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>←</button>}
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: isMobile ? 32 : 40, margin: 0, letterSpacing: '-0.02em', color: 'var(--ink)' }}>{t('camp.title')}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, paddingTop: 4 }}>
            <StarPill stars={bundle.totalStars}/>
            <ExpeditionPill bundle={bundle}/>
          </div>
        </div>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '0 0 20px' }}>{t('camp.sub')}</p>

        <CategoriesGrid bundle={bundle} isMobile={isMobile} userId={user?.id} onOpen={(id) => {
          campaignAnalytics.categoryOpened(id, user?.id)
          navigate(`/campaigns/${id}`)
        }}/>
      </div>
      </div>
      {isMobile && <MobileNav active="campaigns"/>}
    </div>
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
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{cat.title}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {locked
            ? (acc.lockReason === 'premium' ? t('camp.premiumPart') : t('camp.missingStars', { n: acc.missingStars }))
            : `${t('camp.count', { count: camps.length })}${cat.description ? ` · ${cat.description}` : ''}`}
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
  const [showUpsell, setShowUpsell] = useState(false)
  const [err, setErr] = useState<string | null>(null)

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
        state: { events, attemptId, campaignId: campaign.id, campaignTitle: campaign.title, rounds: events.length },
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
  const roundsHint = camps.length > 0 ? camps[0].rounds_count : 5
  const heroImg = cat.hero_image_url || null

  const backBtn = (
    <button onClick={onBack} aria-label={t('camp.back')} style={{
      width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
      background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 18,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>←</button>
  )

  const heroTitle = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <span style={{
        width: 60, height: 60, borderRadius: 15, flexShrink: 0, fontSize: 28,
        background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{cat.icon || '📁'}</span>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: isMobile ? 28 : 34, color: '#fff', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.05 }}>{cat.title}</h1>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, color: 'rgba(255,255,255,0.92)', marginTop: 5 }}>
          <span style={{ color: GOLD }}>★</span> {cs.earned} / {cs.max} <span style={{ color: GOLD }}>★</span>
          {camps.length > 0 && <span style={{ color: 'rgba(255,255,255,0.7)' }}> · {t('camp.count', { count: camps.length })}</span>}
        </div>
      </div>
    </div>
  )

  const heroBg = (
    <>
      {heroImg && (
        <>
          <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: `url(${heroImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}/>
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: `linear-gradient(155deg, ${color}cc, ${shade(color, -18)}e6)` }}/>
        </>
      )}
    </>
  )

  const desc = (cat.description || camps.length > 0) && (
    <p style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.55, margin: isMobile ? '0 0 18px' : '0 0 22px' }}>
      {cat.description}
      {camps.length > 0 && ` ${t('camp.count', { count: camps.length })}, ${t('camp.eventsEach', { rounds: roundsHint })}`}
    </p>
  )

  const rows = (
    <>
      {err && <div className="alert alert-error" style={{ marginBottom: 14 }}>⚠ {err}</div>}
      {camps.length === 0 && <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>{t('camp.noCampaigns')}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12 }}>
        {camps.map((c, i) => (
          <CampaignRow
            key={c.id} campaign={c} index={i} cat={cat} bundle={bundle} isMobile={isMobile}
            categoryStarsEarned={cs.earned} busy={starting === c.id} onPlay={play}
          />
        ))}
      </div>
    </>
  )

  // ── Desktop: hero jako zaoblená karta v širokém sloupci ──
  if (!isMobile) {
    return (
      <>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 40px 8px' }}>
          <div style={{
            position: 'relative', overflow: 'hidden', borderRadius: 20,
            background: `linear-gradient(155deg, ${color}, ${shade(color, -18)})`,
            padding: '22px 28px 26px',
          }}>
            {heroBg}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {backBtn}
              {heroTitle}
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 40px 8px' }}>
          {desc}
          {rows}
        </div>
        {showUpsell && <ExpeditionUpsell bundle={bundle} userId={userId} onClose={() => { setShowUpsell(false); onReload() }}/>}
      </>
    )
  }

  // ── Mobil: full-bleed hlavička ──
  return (
    <>
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: `linear-gradient(155deg, ${color}, ${shade(color, -18)})`,
        padding: 'calc(var(--safe-top) + 14px) 18px 20px',
      }}>
        {heroBg}
        <div style={{ position: 'relative', maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {backBtn}
          {heroTitle}
        </div>
      </div>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 18 }}>
        {desc}
        {rows}
      </div>
      {showUpsell && <ExpeditionUpsell bundle={bundle} userId={userId} onClose={() => { setShowUpsell(false); onReload() }}/>}
    </>
  )
}

function CampaignRow({ campaign, index, cat, bundle, categoryStarsEarned, busy, onPlay, isMobile }: {
  campaign: Campaign; index: number; cat: CampaignCategory; bundle: CampaignBundle
  categoryStarsEarned: number; busy: boolean; onPlay: (c: Campaign) => void; isMobile?: boolean
}) {
  const { t } = useTranslation()
  // Odemyká se POČTEM ★ v kategorii — ne dokončením předchozí kampaně
  const acc = campaignAccess(campaign, categoryStarsEarned, bundle.entitlements, cat)
  const prog = bundle.progress[campaign.id]
  const stars = prog?.best_stars ?? 0
  const played = !!prog?.completed_runs
  const locked = !acc.isUnlocked
  // Zvýrazni první odemčenou nehranou kampaň — „kde jsi"
  const isNext = !locked && !played

  return (
    <div style={{
      background: locked ? 'var(--paper-200)' : isNext ? 'rgba(217,119,87,0.07)' : 'var(--surface)',
      border: `1px solid ${isNext ? 'var(--accent)' : 'var(--line)'}`,
      borderRadius: 16, padding: isMobile ? '14px 16px' : '18px 22px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 30, flexShrink: 0, textAlign: 'center',
        fontFamily: 'var(--font-serif)', fontSize: 17, color: locked ? 'var(--ink-3)' : 'var(--ink-2)',
      }}>{locked ? '🔒' : index + 1}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-serif)', fontSize: 16.5, letterSpacing: '-0.01em',
          color: locked ? 'var(--ink-3)' : 'var(--ink)',
        }}>{campaign.title}</div>

        {locked ? (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>
            {acc.lockReason === 'premium' ? t('camp.premiumPart') : t('camp.missingStarsCat', { n: acc.missingStars })}
          </div>
        ) : played ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <StarRow stars={stars}/>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
              {prog!.best_score.toLocaleString('cs-CZ')} b.
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>
            {t('camp.notPlayed', { n: campaign.rounds_count })}
          </div>
        )}
      </div>

      {!locked && (
        <button className={isNext ? 'btn btn-accent' : 'btn btn-ghost'}
          style={{ fontSize: 13, flexShrink: 0, minWidth: 92 }}
          disabled={busy} onClick={() => onPlay(campaign)}>
          {busy ? '…' : played ? t('camp.replay') : t('camp.play')}
        </button>
      )}
    </div>
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


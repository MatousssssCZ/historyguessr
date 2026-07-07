import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { getCampaignBundle, startCampaignAttempt, getEventsByIds, type CampaignBundle } from '@/lib/supabase'
import MobileNav from '@/components/MobileNav'
import CompassLoader from '@/components/CompassLoader'
import {
  effectiveEnergy, isCategoryUnlocked, isCampaignUnlocked, categoryStars, DAILY_ENERGY,
} from '@/lib/campaignLogic'
import type { Campaign } from '@/types/database'

export default function CampaignsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { categoryId } = useParams()
  const [bundle, setBundle] = useState<CampaignBundle | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) return
    try {
      setBundle(await getCampaignBundle(user.id))
    } catch (e) {
      console.warn('[Campaigns] načtení selhalo (běží migrace 028?):', e)
      setBundle({ categories: [], campaignsByCat: {}, progress: {}, totalStars: 0, energy: DAILY_ENERGY, isPremium: false, energyResetAt: null })
    }
    setLoading(false)
  }, [user])

  useEffect(() => { reload() }, [reload])

  if (loading || !bundle) {
    return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-200)' }}><CompassLoader size={60} light/></div>
  }

  const energy = effectiveEnergy(bundle.energy, bundle.energyResetAt, bundle.isPremium)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', paddingBottom: 'calc(88px + var(--safe-bottom))' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface)', borderBottom: '1px solid var(--line)', paddingTop: 'var(--safe-top)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px' }}>
          <button onClick={() => navigate(categoryId ? '/campaigns' : '/menu')} aria-label="Zpět" style={backBtn}>←</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0, letterSpacing: '-0.01em' }}>Kampaně</h1>
          </div>
          {/* Celkové ★ */}
          <div style={pill} title="Celkem nasbíraných hvězd">
            <span style={{ color: '#f5ce8b' }}>★</span> {bundle.totalStars}
          </div>
          {/* Energie */}
          <div style={{ ...pill, color: energy === Infinity ? 'var(--accent-deep)' : (energy <= 0 ? '#c0392b' : 'var(--ink)') }} title="Pokusy dnes">
            ⚡ {energy === Infinity ? '∞' : `${energy}/${DAILY_ENERGY}`}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 18px' }}>
        {categoryId
          ? <CategoryView bundle={bundle} categoryId={categoryId} energy={energy} onReload={reload}/>
          : <CategoriesGrid bundle={bundle} onOpen={(id) => navigate(`/campaigns/${id}`)}/>}
      </div>

      <MobileNav/>
    </div>
  )
}

// ═══════════════════ Seznam kategorií ═══════════════════
function CategoriesGrid({ bundle, onOpen }: { bundle: CampaignBundle; onOpen: (id: string) => void }) {
  if (bundle.categories.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-3)' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏛</div>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink-2)', margin: 0 }}>Kampaně se připravují</p>
        <p style={{ fontSize: 13, marginTop: 6 }}>Brzy tu přibydou první tematické cesty historií.</p>
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
      {bundle.categories.map(cat => {
        const camps = bundle.campaignsByCat[cat.id] ?? []
        const unlocked = isCategoryUnlocked(cat, bundle.totalStars, bundle.isPremium)
        const cs = categoryStars(camps, bundle.progress)
        return (
          <button key={cat.id} disabled={!unlocked} onClick={() => onOpen(cat.id)}
            style={{
              position: 'relative', textAlign: 'left', cursor: unlocked ? 'pointer' : 'not-allowed',
              background: 'var(--surface)', border: `1px solid ${unlocked ? 'var(--line)' : 'var(--line)'}`,
              borderRadius: 18, padding: 18, overflow: 'hidden', opacity: unlocked ? 1 : 0.65,
              transition: 'transform 140ms, box-shadow 140ms',
            }}
            onMouseEnter={e => { if (unlocked) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 26px -12px rgba(42,31,23,0.28)' } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}>
            {/* barevný proužek */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: cat.color || 'var(--accent)' }}/>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 34 }}>{cat.icon || '📁'}</span>
              {!unlocked && <span style={{ fontSize: 20 }}>🔒</span>}
              {cat.is_premium && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-deep)', background: 'rgba(245,206,139,0.3)', padding: '2px 7px', borderRadius: 20 }}>PREMIUM</span>}
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginTop: 12 }}>{cat.title}</div>
            {cat.description && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{cat.description}</div>}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: '#f5ce8b' }}>★</span> {cs.earned}/{cs.max}
              </span>
              {unlocked
                ? <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{camps.length} kampaní ›</span>
                : <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>🔒 ★ {cat.unlock_stars}</span>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ═══════════════════ Detail kategorie ═══════════════════
function CategoryView({ bundle, categoryId, energy, onReload }: {
  bundle: CampaignBundle; categoryId: string; energy: number; onReload: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [starting, setStarting] = useState<string | null>(null)
  const [showUpsell, setShowUpsell] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const cat = bundle.categories.find(c => c.id === categoryId)
  const camps = bundle.campaignsByCat[categoryId] ?? []

  if (!cat || !isCategoryUnlocked(cat, bundle.totalStars, bundle.isPremium)) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--ink-3)' }}>
        <div style={{ fontSize: 34, marginBottom: 10 }}>🔒</div>
        <p>Tato kategorie ještě není odemčená.</p>
        <button className="btn btn-ghost" onClick={() => navigate('/campaigns')}>← Zpět</button>
      </div>
    )
  }

  async function play(campaign: Campaign) {
    if (starting) return
    setErr(null); setStarting(campaign.id)
    try {
      const { eventIds } = await startCampaignAttempt(campaign.id)
      if (eventIds.length < 5) { setErr('Kampaň nemá kompletních 5 událostí.'); setStarting(null); return }
      const events = await getEventsByIds(eventIds)
      if (events.length < 5) { setErr('Události kampaně se nepodařilo načíst.'); setStarting(null); return }
      navigate('/game', { state: { events, campaignId: campaign.id, campaignTitle: campaign.title, rounds: events.length } })
    } catch (e: any) {
      setStarting(null)
      if (e?.message?.includes('no_energy')) { setShowUpsell(true); return }
      setErr(e?.message || 'Kampaň se nepodařilo spustit.')
    }
  }

  const cs = categoryStars(camps, bundle.progress)

  return (
    <div>
      {/* Hlavička kategorie */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <span style={{ fontSize: 40 }}>{cat.icon || '📁'}</span>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, margin: 0 }}>{cat.title}</h2>
          <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '3px 0 0', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: '#f5ce8b' }}>★</span> {cs.earned}/{cs.max} · {camps.length} kampaní
          </p>
        </div>
      </div>
      {cat.description && <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 20px' }}>{cat.description}</p>}

      {err && <div className="alert alert-error" style={{ marginBottom: 14 }}>⚠ {err}</div>}

      {camps.length === 0 && <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>Zatím žádné kampaně.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {camps.map((c, i) => {
          const unlocked = isCampaignUnlocked(camps, i, bundle.progress)
          const prog = bundle.progress[c.id]
          const stars = prog?.stars ?? 0
          const busy = starting === c.id
          return (
            <div key={c.id} style={{
              background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16,
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, opacity: unlocked ? 1 : 0.6,
            }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: unlocked ? 'var(--paper-200)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink-2)' }}>
                {unlocked ? i + 1 : '🔒'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)' }}>{c.title}</div>
                {/* hvězdy */}
                <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                  {[0, 1, 2].map(k => <span key={k} style={{ fontSize: 15, color: stars > k ? '#f5ce8b' : 'var(--line-strong)' }}>★</span>)}
                  {prog && <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 6, fontFamily: 'var(--font-mono)' }}>{prog.best_score.toLocaleString('cs')} b.</span>}
                </div>
              </div>
              {unlocked ? (
                <button className="btn btn-accent" style={{ fontSize: 13, flexShrink: 0 }} disabled={busy} onClick={() => play(c)}>
                  {busy ? '…' : (prog ? 'Zopakovat' : 'Hrát')}
                </button>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--ink-3)', flexShrink: 0, textAlign: 'right', maxWidth: 110 }}>Dokonči předchozí kampaň</span>
              )}
            </div>
          )
        })}
      </div>

      {showUpsell && <EnergyUpsell energy={energy} onClose={() => { setShowUpsell(false); onReload() }}/>}
    </div>
  )
}

// ═══════════════════ Upsell (došla energie) ═══════════════════
function EnergyUpsell({ energy, onClose }: { energy: number; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(42,31,23,0.6)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 22, padding: 28, maxWidth: 380, width: '100%', boxShadow: 'var(--shadow-xl)', textAlign: 'center' }}>
        <div style={{ fontSize: 44, marginBottom: 10 }}>⚡</div>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, margin: '0 0 8px' }}>Došly ti pokusy</h3>
        <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.55, margin: '0 0 18px' }}>
          Ve free verzi máš <strong>{DAILY_ENERGY} pokusů denně</strong> ({energy <= 0 ? 'dnes už 0' : energy}). Reset přijde zítra.
          S <strong>Premium</strong> hraješ kampaně neomezeně.
        </p>
        <div style={{ background: 'var(--paper-200)', borderRadius: 14, padding: 14, marginBottom: 18, textAlign: 'left' }}>
          {['Neomezené pokusy o kampaně', 'Žádné čekání na reset', 'Podpora dalšího obsahu'].map(x => (
            <div key={x} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', padding: '4px 0' }}>
              <span style={{ color: 'var(--accent)' }}>✓</span> {x}
            </div>
          ))}
        </div>
        <button className="btn btn-accent" style={{ width: '100%', marginBottom: 8 }} onClick={() => alert('Premium — připravujeme 🙏')}>
          Chci Premium
        </button>
        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={onClose}>Zavřít</button>
      </div>
    </div>
  )
}

// ── styly ──
const backBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: '50%', flexShrink: 0, cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }
const pill: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 20, background: 'var(--paper-200)', border: '1px solid var(--line)', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }

import { useEffect, useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { levelFromXp } from '@/lib/leveling'
import { currentLocale } from '@/i18n'
import { useAuth } from '@/hooks/useAuth'
import { useIsMobile } from '@/hooks/useIsMobile'
import MobileNav from '@/components/MobileNav'
import AppHeader from '@/components/AppHeader'
import CompassLoader from '@/components/CompassLoader'
import Icon from '@/components/Icon'
import { useStatsData, StatsRail, BadgesSections, type StatsData } from '@/pages/Stats'
import RelicViewer from '@/components/RelicViewer'
import RelicBadge from '@/components/RelicBadge'
import {
  getKronikaBundle, setRelicShowcase, relicModel, relicName, relicDesc, RARITY_META, RARITY_ORDER, RARITY_RANK,
  type KronikaBundle, type RelicView, type Rarity,
} from '@/lib/relics'

const rarityLabel = (tf: (k: string) => string, r: Rarity) => tf(`kron.rar_${r}`)

type KronTab = 'relics' | 'badges'

const GOLD = '#B08040'
const STONE = '#8A7E6C'

export default function KronikaPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [bundle, setBundle] = useState<KronikaBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<RelicView | null>(null)
  const [tab, setTab] = useState<KronTab>('relics')
  const statsData = useStatsData()

  const reload = useCallback(async () => {
    if (!user) return
    setBundle(await getKronikaBundle(user.id))
    setLoading(false)
  }, [user])
  useEffect(() => { reload() }, [reload])

  if (loading || !bundle) {
    return <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-200)' }}><CompassLoader size={60} light/></div>
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)' }}>
      {!isMobile && <AppHeader/>}
      <div style={{ paddingTop: isMobile ? 'var(--safe-top)' : 0, paddingBottom: isMobile ? 'var(--nav-space)' : 40 }}>
        <KronikaHero bundle={bundle} isMobile={isMobile}/>
        <div style={{ maxWidth: 1240, margin: '0 auto', background: 'var(--paper-200)', padding: isMobile ? '18px 15px 0' : '24px 26px 0' }}>
          <Switcher tab={tab} setTab={setTab} bundle={bundle} rewards={statsData.rewards.length}/>
        </div>
        {tab === 'relics' && <RelicsTab bundle={bundle} isMobile={isMobile} onOpen={setDetail} statsData={statsData} userId={user?.id} onChanged={reload}/>}
        {tab === 'badges' && (
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '16px 15px 24px' : '20px 26px 34px' }}>
            {statsData.loading ? <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" style={{ width: 26, height: 26 }}/></div>
              : <BadgesSections data={statsData} wide/>}
          </div>
        )}
      </div>
      {detail && (
        <RelicDetailModal view={detail} userId={user?.id} onClose={() => setDetail(null)}
          onChanged={() => { reload() }} onReplay={() => navigate('/campaigns')}/>
      )}
      {isMobile && <MobileNav active="badges"/>}
    </div>
  )
}

// ── Přepínač Relikvie · Statistiky · Odznaky ────────────────
function Switcher({ tab, setTab, bundle, rewards }: { tab: KronTab; setTab: (t: KronTab) => void; bundle: KronikaBundle; rewards: number }) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 6, padding: 5, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 15, flexWrap: 'wrap' }}>
        <SwitchItem active={tab === 'relics'} label={t('kron.tabRelics')} icon="🏺" count={`${bundle.ownedTotal}/${bundle.total}`} onClick={() => setTab('relics')}/>
        <SwitchItem active={tab === 'badges'} label={t('kron.tabBadges')} icon="🏅" count={rewards ? String(rewards) : undefined} onClick={() => setTab('badges')}/>
      </div>
    </div>
  )
}

// ── Hero: prsten sbírky + level ─────────────────────────────
function KronikaHero({ bundle, isMobile }: { bundle: KronikaBundle; isMobile: boolean }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const lvl = levelFromXp(profile?.xp ?? 0)
  const pct = bundle.total ? Math.round((bundle.ownedTotal / bundle.total) * 100) : 0
  return (
    <div style={{ position: 'relative', background: 'var(--ink-dark, #1A1611)', padding: isMobile ? '24px 18px 22px' : '30px 34px 26px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', color: '#E9A183' }}>{t('kron.eyebrow')}</div>
          <h1 style={{ margin: '9px 0 0', fontFamily: 'var(--font-serif)', fontSize: isMobile ? 27 : 40, color: '#FBF7F0', letterSpacing: '-0.03em', lineHeight: 1.05 }}>{t('kron.title')}</h1>
          <p style={{ margin: '8px 0 0', maxWidth: 520, fontSize: isMobile ? 13 : 14, lineHeight: 1.6, color: 'rgba(251,247,240,0.75)' }}>{t('kron.sub')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
          <div style={{ flex: isMobile ? '1 1 100%' : 'none', minWidth: 0, padding: '15px 19px', borderRadius: 16, background: 'rgba(251,247,240,0.06)', border: '1px solid rgba(251,247,240,0.14)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <RingDial pct={pct} value={String(bundle.ownedTotal)} sub={`/${bundle.total}`} color={GOLD}/>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.15em', color: 'rgba(251,247,240,0.6)' }}>{t('kron.relics')}</div>
              <div style={{ fontSize: 12.5, color: 'rgba(251,247,240,0.85)', marginTop: 4, whiteSpace: 'nowrap' }}>{t('kron.collectionPct', { n: pct })}</div>
            </div>
          </div>
          <div style={{ flex: isMobile ? '1 1 100%' : 'none', minWidth: 0, padding: '15px 19px', borderRadius: 16, background: 'rgba(251,247,240,0.06)', border: '1px solid rgba(251,247,240,0.14)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <RingDial pct={Math.round(lvl.pct * 100)} value={String(lvl.level)} color="#E9A183"/>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.15em', color: 'rgba(251,247,240,0.6)' }}>{t('menu.level')}</div>
              <div style={{ fontSize: 12.5, color: 'rgba(251,247,240,0.85)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lvl.into.toLocaleString(currentLocale())} / {lvl.need.toLocaleString(currentLocale())} XP</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RingDial({ pct, value, sub, color }: { pct: number; value: string; sub?: string; color: string }) {
  const deg = Math.round(pct * 3.6)
  return (
    <div style={{ position: 'relative', width: 60, height: 60, flex: 'none', borderRadius: '50%', background: `conic-gradient(${color} 0 ${deg}deg, rgba(251,247,240,0.14) ${deg}deg 360deg)` }}>
      <div style={{ position: 'absolute', inset: 7, borderRadius: '50%', background: 'var(--ink-dark, #1A1611)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, color: '#FBF7F0', lineHeight: 1 }}>{value}</span>
        {sub && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(251,247,240,0.55)' }}>{sub}</span>}
      </div>
    </div>
  )
}

// ── Relikvie tab (vitrína + statistiky vlevo + vystaveno/sady/tituly vpravo) ──
function RelicsTab({ bundle, isMobile, onOpen, statsData, userId, onChanged }: {
  bundle: KronikaBundle; isMobile: boolean; onOpen: (v: RelicView) => void; statsData: StatsData
  userId?: string; onChanged: () => void
}) {
  const { t } = useTranslation()
  const [cat, setCat] = useState<string>('all')

  const cats = Object.entries(bundle.byCategory)
  const visible = cat === 'all' ? bundle.relics : bundle.relics.filter(v => (v.relic.category ?? 'other') === cat)

  const filters = (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      <FilterChip active={cat === 'all'} label={t('camp.fAll')} count={`${bundle.ownedTotal}/${bundle.total}`} onClick={() => setCat('all')}/>
      {cats.map(([k, c]) => (
        <FilterChip key={k} active={cat === k} label={t(`catShort.${k}`, { defaultValue: k })} count={`${c.owned}/${c.total}`} onClick={() => setCat(k)}/>
      ))}
    </div>
  )

  const legend = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      {RARITY_ORDER.map(r => (
        <span key={r} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--ink-2)' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: RARITY_META[r].tone }}/>{rarityLabel(t, r)}</span>
      ))}
    </div>
  )

  const grid = (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 140 : 130}px, 1fr))`, gap: 11 }}>
      {visible.map(v => <RelicTile key={v.relic.id} v={v} onOpen={onOpen}/>)}
      {visible.length === 0 && <p style={{ gridColumn: '1 / -1', color: 'var(--ink-3)', fontSize: 14, padding: '18px 2px' }}>{t('kron.empty')}</p>}
    </div>
  )

  const vitrina = (
    <div style={{ flex: isMobile ? '1 1 100%' : '3 1 430px', minWidth: isMobile ? 0 : 'min(100%, 430px)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: isMobile ? '16px 15px 18px' : '20px 22px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--ink-3)' }}>{t('kron.showcaseCase')}</div>
          <h3 style={{ margin: '8px 0 0', fontFamily: 'var(--font-serif)', fontSize: isMobile ? 22 : 26, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{t('kron.discovered')}</h3>
        </div>
        {!isMobile && legend}
      </div>
      <div style={{ marginTop: 16, marginBottom: 18 }}>{filters}</div>
      {grid}
    </div>
  )

  const sidebar = (
    <div style={{ flex: isMobile ? '1 1 100%' : '1 1 250px', minWidth: isMobile ? 0 : 250, display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 14 }}>
      <ShowcaseCard bundle={bundle} userId={userId} onChanged={onChanged} onOpen={onOpen}/>
      {bundle.sets.map(s => <SetCard key={s.set.id} set={s.set} relics={s.relics}/>)}
    </div>
  )

  return (
    <div style={{ background: 'var(--paper-200)', padding: isMobile ? '16px 15px 24px' : '20px 26px 34px', display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start', maxWidth: 1240, margin: '0 auto' }}>
      {!isMobile && (
        <div style={{ flex: '1 1 100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 9, fontSize: 12, color: 'var(--ink-2)' }}>
          <span style={{ color: GOLD }}>✦</span>{t('kron.perfectNote')}
        </div>
      )}
      {isMobile
        ? <>{vitrina}{sidebar}<StatsRail data={statsData}/></>
        : <><StatsRail data={statsData}/>{vitrina}{sidebar}</>}
    </div>
  )
}

function SwitchItem({ active, label, icon, count, onClick }: { active?: boolean; label: string; icon: string; count?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 18px', borderRadius: 11, cursor: 'pointer', border: 'none',
      background: active ? 'var(--ink)' : 'transparent', color: active ? 'var(--paper-50)' : 'var(--ink-2)',
      fontFamily: 'var(--font-sans)', fontWeight: active ? 700 : 600, fontSize: 13,
    }}>
      <span style={{ fontSize: 15 }}>{icon}</span>{label}
      {count && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, opacity: active ? 0.65 : 0.6 }}>{count}</span>}
    </button>
  )
}

function FilterChip({ active, label, count, onClick }: { active: boolean; label: string; count: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 7, height: 34, padding: '0 14px', borderRadius: 10, cursor: 'pointer',
      background: active ? 'var(--ink)' : 'var(--paper-100, #F1EBE0)', border: active ? 'none' : '1px solid var(--line)',
      color: active ? 'var(--paper-50)' : 'var(--ink-2)', fontFamily: 'var(--font-sans)', fontWeight: active ? 700 : 600, fontSize: 12,
    }}>{label}<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, opacity: active ? 0.6 : 0.55 }}>{count}</span></button>
  )
}

// ── RelicTile ───────────────────────────────────────────────
function RelicTile({ v, onOpen }: { v: RelicView; onOpen: (v: RelicView) => void }) {
  const { t } = useTranslation()
  const { relic, state } = v
  const rarity: Rarity | null = v.owned?.state ?? null
  const owned = !!rarity
  const clickable = owned
  const tone = rarity ? RARITY_META[rarity].tone : STONE
  const legendary = rarity === 'legendary'

  const frame: React.CSSProperties = owned
    ? { border: `1.5px solid ${tone}`, background: legendary ? 'linear-gradient(180deg,rgba(176,128,64,.14),rgba(176,128,64,.04))' : 'var(--surface)', boxShadow: legendary ? '0 14px 30px -18px rgba(176,128,64,.7)' : 'none' }
    : { border: state === 'secret' ? '1.5px dashed var(--line-strong)' : '1px solid var(--line)', background: 'var(--paper-300, #F3EDE2)' }

  return (
    <div role={clickable ? 'button' : undefined} onClick={() => clickable && onOpen(v)}
      style={{ borderRadius: 15, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: clickable ? 'pointer' : 'default', ...frame }}>
      <div style={{ position: 'relative', height: 116, display: 'flex', alignItems: 'center', justifyContent: 'center', background: owned ? `radial-gradient(circle at 50% 45%, ${tone}1f, transparent 70%)` : 'rgba(31,27,22,.04)' }}>
        {state === 'secret'
          ? <span style={{ fontSize: 40, color: 'rgba(31,27,22,.16)' }}>❔</span>
          : <RelicBadge rarity={rarity} silhouetteUrl={relic.silhouette_url} iconUrl={relic.icon_url} name={relicName(relic)} size={84} dim={!owned}/>}
        {owned && <span style={{ position: 'absolute', left: 9, top: 9, display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999, background: tone, fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: '#FBF7F0' }}>{legendary ? '✦ ' : ''}{rarityLabel(t, rarity!).toUpperCase()}</span>}
        {state === 'locked' && <span style={{ position: 'absolute', right: 9, top: 9, fontSize: 15, color: 'var(--gold-ink, #7A5A28)' }}><Icon name="lock" size={15}/></span>}
      </div>
      <div style={{ padding: '11px 13px 13px', background: owned ? 'var(--surface)' : 'var(--paper-100, #F7F2E8)' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, lineHeight: 1.3, color: owned ? 'var(--ink)' : 'var(--ink-2)' }}>{relicName(relic)}</div>
        {owned ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 7 }}>
            <span style={{ fontSize: 10.5, color: 'var(--ink-2)' }}>{v.bestScore.toLocaleString(currentLocale())} / {v.maxScore.toLocaleString(currentLocale())}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{v.ownedPct} %</span>
          </div>
        ) : state === 'secret' ? (
          <div style={{ fontSize: 11, lineHeight: 1.45, color: 'var(--ink-2)', marginTop: 7 }}>{t('kron.secretHint')} <span style={{ color: 'var(--ink-3)' }}>· {v.ownedPct} %</span></div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, padding: '7px 9px', background: 'var(--gold-band-bg, rgba(176,128,64,.13))', border: '1px solid rgba(176,128,64,.32)', borderRadius: 9 }}>
            <Icon name="lock" size={11}/>
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 10.5, color: 'var(--gold-ink, #7A5A28)' }}>{t('kron.lockCampaign')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Vystaveno na profilu ────────────────────────────────────
function ShowcaseCard({ bundle, userId, onChanged, onOpen }: {
  bundle: KronikaBundle; userId?: string; onChanged: () => void; onOpen: (v: RelicView) => void
}) {
  const { t } = useTranslation()
  const slots = [0, 1, 2]
  const [picking, setPicking] = useState(false)
  const canPick = !!userId && bundle.showcase.length < 3
  return (
    <div style={{ flex: '1 1 250px', minWidth: 0, background: 'var(--ink)', borderRadius: 18, padding: '18px 19px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', color: 'rgba(251,247,240,0.6)' }}>{t('kron.showcase')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 9, marginTop: 13 }}>
        {slots.map(i => {
          const v = bundle.showcase[i]
          if (!v) return (
            <button key={i} onClick={() => canPick && setPicking(true)} disabled={!canPick} title={t('kron.showcaseAdd')} style={{ aspectRatio: '1', borderRadius: 13, border: '1.5px dashed rgba(251,247,240,0.28)', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(251,247,240,0.5)', fontSize: 22, cursor: canPick ? 'pointer' : 'default' }}>+</button>
          )
          return (
            <button key={i} onClick={() => onOpen(v)} title={relicName(v.relic)} style={{ aspectRatio: '1', border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
              <RelicBadge rarity={v.owned?.state ?? null} silhouetteUrl={v.relic.silhouette_url} iconUrl={v.relic.icon_url} name={relicName(v.relic)} size={64}/>
            </button>
          )
        })}
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.5, color: 'rgba(251,247,240,0.65)', marginTop: 12 }}>{t('kron.showcaseHint')}</div>
      {picking && userId && <ShowcasePicker bundle={bundle} userId={userId} onClose={() => setPicking(false)} onChanged={onChanged}/>}
    </div>
  )
}

// Výběr relikvie k vystavení: nabídne vlastněné, které ještě nejsou vystavené.
function ShowcasePicker({ bundle, userId, onClose, onChanged }: {
  bundle: KronikaBundle; userId: string; onClose: () => void; onChanged: () => void
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState<string | null>(null)
  const options = bundle.relics.filter(v => v.owned && !v.owned.showcased)

  async function pick(v: RelicView) {
    if (!v.owned) return
    setBusy(v.relic.id)
    const res = await setRelicShowcase(userId, v.relic.id, true)
    setBusy(null)
    if (!res.ok) { alert(res.error === 'showcase_limit' ? t('kron.showcaseLimit') : res.error); return }
    onChanged()
    onClose()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(31,27,22,0.58)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--paper-50)', borderRadius: 22, width: '100%', maxWidth: 460, maxHeight: '86dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-xl)', animation: 'scaleIn 220ms var(--ease-spring) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '18px 20px 12px' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--ink-3)' }}>{t('kron.showcase')}</div>
            <h3 style={{ margin: '6px 0 0', fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{t('kron.showcasePick')}</h3>
          </div>
          <button onClick={onClose} style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 10, background: 'var(--paper-200)', border: '1px solid var(--line)', color: 'var(--ink-2)', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '4px 20px 20px', overflowY: 'auto' }}>
          {options.length === 0 ? (
            <p style={{ color: 'var(--ink-3)', fontSize: 13.5, padding: '10px 2px' }}>{t('kron.showcaseNone')}</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 11 }}>
              {options.map(v => (
                <button key={v.relic.id} onClick={() => pick(v)} disabled={!!busy} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 8px', borderRadius: 14, border: '1px solid var(--line)', background: 'var(--surface)', cursor: busy ? 'default' : 'pointer', opacity: busy && busy !== v.relic.id ? 0.5 : 1 }}>
                  <RelicBadge rarity={v.owned?.state ?? null} silhouetteUrl={v.relic.silhouette_url} iconUrl={v.relic.icon_url} name={relicName(v.relic)} size={56}/>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{relicName(v.relic)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SetCard({ set, relics }: { set: { id: string; name: string; reward_name: string | null }; relics: RelicView[] }) {
  const { t } = useTranslation()
  const owned = relics.filter(r => r.owned).length
  return (
    <div style={{ flex: '1 1 250px', minWidth: 0, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 19px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--ink-3)' }}>{t('kron.setOf', { owned, total: relics.length })}</div>
      <h4 style={{ margin: '8px 0 0', fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{set.name}</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
        {relics.map(r => (
          <div key={r.relic.id} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: r.owned ? 'var(--ink-2)' : 'var(--ink-3)' }}>
            <span style={{ color: r.owned ? 'var(--good, #4E6E4C)' : 'var(--gold-ink, #7A5A28)' }}>{r.owned ? '✓' : '🔒'}</span>{relicName(r.relic)}
          </div>
        ))}
      </div>
      {set.reward_name && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '10px 12px', background: 'var(--gold-band-bg, rgba(176,128,64,.13))', border: '1px solid rgba(176,128,64,.32)', borderRadius: 11 }}>
          <span style={{ fontSize: 16 }}>🏆</span>
          <span style={{ fontSize: 11.5, lineHeight: 1.45, color: 'var(--ink-2)' }}>{t('kron.setReward')} <b style={{ fontWeight: 700 }}>{set.reward_name}</b></span>
        </div>
      )}
    </div>
  )
}

// ── Detail relikvie (32b) ───────────────────────────────────
function RelicDetailModal({ view, userId, onClose, onChanged, onReplay }: {
  view: RelicView; userId?: string; onClose: () => void; onChanged: () => void; onReplay: (campId: string) => void
}) {
  const { t } = useTranslation()
  const { relic, owned } = view
  const rarity: Rarity = owned?.state ?? 'common'
  const tone = RARITY_META[rarity].tone
  const rank = RARITY_RANK[rarity]
  const model = relicModel(relic, rarity)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [moreBelow, setMoreBelow] = useState(false)
  const pct = view.maxScore ? Math.round((view.bestScore / view.maxScore) * 100) : 0

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (el) setMoreBelow(el.scrollTop + el.clientHeight < el.scrollHeight - 8)
  }, [])
  useEffect(() => { const id = setTimeout(checkScroll, 60); return () => clearTimeout(id) }, [checkScroll])

  async function toggleShowcase() {
    if (!userId || !owned) return
    setBusy(true)
    const res = await setRelicShowcase(userId, relic.id, !owned.showcased)
    setBusy(false)
    if (!res.ok) { alert(res.error === 'showcase_limit' ? t('kron.showcaseLimit') : res.error); return }
    onChanged()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(31,27,22,0.58)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', background: 'var(--paper-50)', borderRadius: 24, overflow: 'hidden', width: '100%', maxWidth: 440, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)', animation: 'scaleIn 240ms var(--ease-spring) both' }}>
        <div style={{ position: 'relative', height: 250, background: 'var(--ink-dark, #1A1611)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 42%, ${tone}6b, rgba(16,13,10,.9) 74%)` }}/>
          <RelicViewer modelUrl={model} glow={rank >= 3 ? 'gold' : 'stone'}/>
          <span style={{ position: 'absolute', left: 20, top: 20, display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, background: tone, fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: '#FBF7F0' }}>{rarityLabel(t, rarity).toUpperCase()}</span>
          <button onClick={onClose} style={{ position: 'absolute', right: 20, top: 20, width: 32, height: 32, borderRadius: 10, background: 'rgba(251,247,240,0.14)', border: '1px solid rgba(251,247,240,0.2)', color: '#fff', cursor: 'pointer' }}>✕</button>
          {model && (
            <button onClick={() => setExpanded(true)} title={t('kron.expand')} style={{ position: 'absolute', right: 20, bottom: 16, display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', borderRadius: 10, background: 'rgba(251,247,240,0.14)', border: '1px solid rgba(251,247,240,0.2)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12 }}>⤢ {t('kron.expand')}</button>
          )}
        </div>
        <div ref={scrollRef} onScroll={checkScroll} style={{ padding: '22px 24px 26px', overflowY: 'auto' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--ink-3)' }}>{[relic.year_label, relic.category && t(`catShort.${relic.category}`, { defaultValue: relic.category })].filter(Boolean).join(' · ').toUpperCase()}</div>
          <h3 style={{ margin: '9px 0 0', fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--ink)', letterSpacing: '-0.025em' }}>{relicName(relic)}</h3>
          {relicDesc(relic) && <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-2)' }}>{relicDesc(relic)}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 18 }}>
            <Fact label={t('kron.acquired')} value={owned ? new Date(owned.acquired_at).toLocaleDateString(currentLocale()) : '—'}/>
            <Fact label={t('kron.bestResult')} value={`${view.bestScore.toLocaleString(currentLocale())} b.`}/>
            <Fact label={t('kron.ownedBy')} value={t('kron.ownedByPct', { n: view.ownedPct })}/>
            <Fact label={t('kron.stars')} value={'★'.repeat(view.bestStars) + '☆'.repeat(3 - view.bestStars)}/>
          </div>

          <div style={{ marginTop: 16, padding: '15px 16px', border: `1px solid ${tone}5c`, background: `${tone}1f`, borderRadius: 14 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--ink-3)', marginBottom: 10 }}>{t('kron.rarityPath')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {RARITY_ORDER.map((r, i) => {
                const reached = RARITY_RANK[r] <= rank
                return (
                  <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <span style={{ flex: 1, textAlign: 'center', padding: '4px 4px', borderRadius: 999, background: reached ? RARITY_META[r].tone : 'transparent', border: reached ? 'none' : `1px dashed ${RARITY_META[r].tone}80`, color: reached ? '#FBF7F0' : RARITY_META[r].tone, fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.04em' }}>{rarityLabel(t, r).toUpperCase()}</span>
                    {i < RARITY_ORDER.length - 1 && <span style={{ color: 'var(--ink-3)', fontSize: 10 }}>›</span>}
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 12 }}>
              <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'rgba(31,27,22,0.1)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: tone }}/></div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{view.bestScore.toLocaleString(currentLocale())} / {view.maxScore.toLocaleString(currentLocale())}</span>
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-2)', marginTop: 10 }}>{rarity === 'legendary' ? t('kron.rarityMax') : t('kron.rarityNext')}</div>
          </div>

          <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
            <button onClick={toggleShowcase} disabled={busy || !owned} style={{ flex: 1, height: 48, borderRadius: 14, border: 'none', cursor: owned ? 'pointer' : 'default', background: owned?.showcased ? 'var(--paper-200)' : 'var(--accent)', color: owned?.showcased ? 'var(--ink)' : '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14 }}>
              {owned?.showcased ? t('kron.showcased') : `★ ${t('kron.showcaseCta')}`}
            </button>
            {relic.campaign_id && <button onClick={() => onReplay(relic.campaign_id!)} style={{ flex: 'none', height: 48, padding: '0 20px', borderRadius: 14, background: 'var(--paper-50)', border: '1.5px solid var(--accent)', color: 'var(--accent-ink, #A34E30)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{t('kron.replay')}</button>}
          </div>
        </div>
        {/* Náznak scrollu */}
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 46, pointerEvents: 'none', opacity: moreBelow ? 1 : 0, transition: 'opacity 180ms', background: 'linear-gradient(to top, var(--paper-50) 12%, transparent)' }}/>
        {moreBelow && <div aria-hidden style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', pointerEvents: 'none', color: 'var(--ink-3)', fontSize: 16, animation: 'bob 1.2s ease-in-out infinite' }}>⌄</div>}
      </div>

      {expanded && model && (
        <div onClick={(e) => { e.stopPropagation(); setExpanded(false) }} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(16,13,10,0.94)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 45%, ${tone}55, rgba(16,13,10,.97) 70%)` }}/>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: 'min(88vw, 620px)', height: 'min(70vh, 620px)' }}>
            <RelicViewer modelUrl={model} glow={rank >= 3 ? 'gold' : 'stone'}/>
          </div>
          <div style={{ position: 'relative', marginTop: 14, display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(251,247,240,0.75)' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 18 }}>{relicName(relic)}</span>
            <span style={{ fontSize: 12, color: 'rgba(251,247,240,0.5)' }}>· {t('kron.dragRotate')}</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setExpanded(false) }} style={{ position: 'absolute', top: 'calc(16px + var(--safe-top))', right: 16, width: 40, height: 40, borderRadius: 12, background: 'rgba(251,247,240,0.14)', border: '1px solid rgba(251,247,240,0.24)', color: '#fff', cursor: 'pointer', fontSize: 15 }}>✕</button>
        </div>
      )}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '12px 14px', background: 'var(--paper-300, #F3EDE2)', borderRadius: 12 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-3)' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', marginTop: 5 }}>{value}</div>
    </div>
  )
}

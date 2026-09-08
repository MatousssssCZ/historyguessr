import { useEffect, useState, useCallback } from 'react'
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
import {
  getKronikaBundle, setRelicShowcase, relicImage,
  type KronikaBundle, type RelicView,
} from '@/lib/relics'

type KronTab = 'relics' | 'badges'

const GOLD = '#B08040'
const GOLD_LIGHT = '#E8C88A'
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
        {tab === 'relics' && <RelicsTab bundle={bundle} isMobile={isMobile} onOpen={setDetail} statsData={statsData}/>}
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
function RelicsTab({ bundle, isMobile, onOpen, statsData }: {
  bundle: KronikaBundle; isMobile: boolean; onOpen: (v: RelicView) => void; statsData: StatsData
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
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--ink-2)' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: STONE }}/>{t('kron.preserved')} <span style={{ color: 'var(--ink-3)' }}>· {t('kron.preservedHint')}</span></span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--ink-2)' }}><span style={{ width: 10, height: 10, borderRadius: 2, background: GOLD }}/>{t('kron.perfect')} <span style={{ color: 'var(--ink-3)' }}>· {t('kron.perfectHint')}</span></span>
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
      <ShowcaseCard bundle={bundle}/>
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
  const img = relicImage(relic, state)
  const perfect = state === 'perfect'
  const preserved = state === 'preserved'
  const owned = perfect || preserved
  const clickable = owned

  const frame: React.CSSProperties = perfect
    ? { border: `1.5px solid ${GOLD}`, background: 'linear-gradient(180deg,rgba(176,128,64,.14),rgba(176,128,64,.04))', boxShadow: '0 14px 30px -18px rgba(176,128,64,.7)' }
    : preserved ? { border: '1px solid var(--line)', background: 'var(--paper-100, #F5F0E6)' }
    : { border: state === 'secret' ? '1.5px dashed var(--line-strong)' : '1px solid var(--line)', background: 'var(--paper-300, #F3EDE2)' }

  return (
    <div role={clickable ? 'button' : undefined} onClick={() => clickable && onOpen(v)}
      style={{ borderRadius: 15, overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: clickable ? 'pointer' : 'default', ...frame }}>
      <div style={{ position: 'relative', height: 104, display: 'flex', alignItems: 'center', justifyContent: 'center', background: perfect ? 'radial-gradient(circle at 50% 45%,rgba(176,128,64,.34),transparent 68%)' : owned ? 'transparent' : 'rgba(31,27,22,.05)' }}>
        {img
          ? <img src={img} alt="" style={{ width: '78%', height: '78%', objectFit: 'contain', filter: owned ? 'none' : 'grayscale(1) opacity(0.35)' }}/>
          : <span style={{ fontSize: 40, color: perfect ? GOLD : preserved ? STONE : 'rgba(31,27,22,.16)' }}>{owned ? '🏺' : '❔'}</span>}
        {owned && <span style={{ position: 'absolute', left: 9, top: 9, display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 999, background: perfect ? GOLD : STONE, fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 700, letterSpacing: '0.1em', color: '#FBF7F0' }}>{perfect ? `✦ ${t('kron.perfectBadge')}` : t('kron.preservedBadge')}</span>}
        {state === 'locked' && <span style={{ position: 'absolute', fontSize: 17, color: 'var(--gold-ink, #7A5A28)' }}><Icon name="lock" size={17}/></span>}
      </div>
      <div style={{ padding: '11px 13px 13px', background: owned ? 'var(--surface)' : 'var(--paper-100, #F7F2E8)' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, lineHeight: 1.3, color: owned ? 'var(--ink)' : 'var(--ink-2)' }}>{owned || state === 'secret' ? relic.name : relic.name}</div>
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
function ShowcaseCard({ bundle }: { bundle: KronikaBundle }) {
  const { t } = useTranslation()
  const slots = [0, 1, 2]
  return (
    <div style={{ flex: '1 1 250px', minWidth: 0, background: 'var(--ink)', borderRadius: 18, padding: '18px 19px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', color: 'rgba(251,247,240,0.6)' }}>{t('kron.showcase')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 9, marginTop: 13 }}>
        {slots.map(i => {
          const v = bundle.showcase[i]
          if (!v) return <div key={i} style={{ aspectRatio: '1', borderRadius: 13, border: '1.5px dashed rgba(251,247,240,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(251,247,240,0.5)', fontSize: 20 }}>+</div>
          const img = relicImage(v.relic, v.state)
          return (
            <div key={i} title={v.relic.name} style={{ aspectRatio: '1', borderRadius: 13, border: `1.5px solid ${v.state === 'perfect' ? 'rgba(176,128,64,0.7)' : 'rgba(138,126,108,0.7)'}`, background: 'radial-gradient(circle at 50% 45%,rgba(176,128,64,.3),rgba(251,247,240,.04))', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {img ? <img src={img} alt="" style={{ width: '76%', height: '76%', objectFit: 'contain' }}/> : <span style={{ fontSize: 24, color: GOLD_LIGHT }}>🏺</span>}
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.5, color: 'rgba(251,247,240,0.65)', marginTop: 12 }}>{t('kron.showcaseHint')}</div>
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
            <span style={{ color: r.owned ? 'var(--good, #4E6E4C)' : 'var(--gold-ink, #7A5A28)' }}>{r.owned ? '✓' : '🔒'}</span>{r.relic.name}
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
  const { relic, state, owned } = view
  const perfect = state === 'perfect'
  const img = relicImage(relic, state)
  const [busy, setBusy] = useState(false)
  const pct = view.maxScore ? Math.round((view.bestScore / view.maxScore) * 100) : 0

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
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--paper-50)', borderRadius: 24, overflow: 'hidden', width: '100%', maxWidth: 440, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)', animation: 'scaleIn 240ms var(--ease-spring) both' }}>
        <div style={{ position: 'relative', height: 250, background: 'var(--ink-dark, #1A1611)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: perfect ? 'radial-gradient(circle at 50% 42%,rgba(232,200,138,.42),rgba(16,13,10,.9) 74%)' : 'radial-gradient(circle at 50% 42%,rgba(138,126,108,.42),rgba(16,13,10,.9) 74%)' }}/>
          {img ? <img src={img} alt="" style={{ position: 'relative', width: '60%', height: '76%', objectFit: 'contain' }}/> : <span style={{ position: 'relative', fontSize: 76, color: perfect ? GOLD_LIGHT : '#D8CFBF' }}>🏺</span>}
          <span style={{ position: 'absolute', left: 20, top: 20, display: 'flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, background: perfect ? GOLD : STONE, fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: '#FBF7F0' }}>{perfect ? t('kron.perfectRelic') : t('kron.preservedRelic')}</span>
          <button onClick={onClose} style={{ position: 'absolute', right: 20, top: 20, width: 32, height: 32, borderRadius: 10, background: 'rgba(251,247,240,0.14)', border: '1px solid rgba(251,247,240,0.2)', color: '#fff', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '22px 24px 24px', overflowY: 'auto' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--ink-3)' }}>{[relic.year_label, relic.category && t(`catShort.${relic.category}`, { defaultValue: relic.category })].filter(Boolean).join(' · ').toUpperCase()}</div>
          <h3 style={{ margin: '9px 0 0', fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--ink)', letterSpacing: '-0.025em' }}>{relic.name}</h3>
          {relic.description && <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.65, color: 'var(--ink-2)' }}>{relic.description}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginTop: 18 }}>
            <Fact label={t('kron.acquired')} value={owned ? new Date(owned.acquired_at).toLocaleDateString(currentLocale()) : '—'}/>
            <Fact label={t('kron.bestResult')} value={`${view.bestScore.toLocaleString(currentLocale())} b.`}/>
            <Fact label={t('kron.ownedBy')} value={t('kron.ownedByPct', { n: view.ownedPct })}/>
            <Fact label={t('kron.stars')} value={'★'.repeat(view.bestStars) + '☆'.repeat(3 - view.bestStars)}/>
          </div>

          <div style={{ marginTop: 16, padding: '15px 16px', border: '1px solid rgba(176,128,64,0.36)', background: 'var(--gold-band-bg, rgba(176,128,64,.12))', borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em', color: 'var(--gold-ink, #7A5A28)' }}>{t('kron.itemState')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ padding: '3px 9px', borderRadius: 999, background: STONE, fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: '#FBF7F0' }}>{t('kron.preservedBadge')}</span>
                <span style={{ color: 'var(--gold-ink, #7A5A28)' }}>→</span>
                <span style={{ padding: '3px 9px', borderRadius: 999, border: perfect ? 'none' : '1px dashed rgba(122,90,40,0.5)', background: perfect ? GOLD : 'transparent', color: perfect ? '#FBF7F0' : 'var(--gold-ink, #7A5A28)', fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700 }}>{t('kron.perfectBadge')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 11 }}>
              <div style={{ flex: 1, height: 7, borderRadius: 4, background: 'rgba(122,90,40,0.18)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: GOLD }}/></div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--gold-ink, #7A5A28)', whiteSpace: 'nowrap' }}>{view.bestScore.toLocaleString(currentLocale())} / {view.maxScore.toLocaleString(currentLocale())}</span>
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-2)', marginTop: 10 }}>{perfect ? t('kron.stateDonePerfect') : t('kron.stateToPerfect')}</div>
          </div>

          <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
            <button onClick={toggleShowcase} disabled={busy || !owned} style={{ flex: 1, height: 48, borderRadius: 14, border: 'none', cursor: owned ? 'pointer' : 'default', background: owned?.showcased ? 'var(--paper-200)' : 'var(--accent)', color: owned?.showcased ? 'var(--ink)' : '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14 }}>
              {owned?.showcased ? t('kron.showcased') : `★ ${t('kron.showcaseCta')}`}
            </button>
            {relic.campaign_id && <button onClick={() => onReplay(relic.campaign_id!)} style={{ flex: 'none', height: 48, padding: '0 20px', borderRadius: 14, background: 'var(--paper-50)', border: '1.5px solid var(--accent)', color: 'var(--accent-ink, #A34E30)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{t('kron.replay')}</button>}
          </div>
        </div>
      </div>
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

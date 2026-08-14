import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getMyEntitlements } from '@/lib/supabase'
import { isPremiumUser } from '@/lib/entitlements'
import { getRoadmap, toggleRoadmapVote, suggestRoadmapItem, type RoadmapItem, type RoadmapStatus } from '@/lib/roadmap'
import { PageHeader } from '@/components/ui/Page'

const STATUS_STYLE: Record<RoadmapStatus, { bg: string; fg: string }> = {
  in_progress: { bg: 'rgba(217,119,87,0.16)', fg: 'var(--accent-deep)' },
  planned:     { bg: 'var(--paper-300)', fg: 'var(--ink-2)' },
  idea:        { bg: 'rgba(122,168,204,0.18)', fg: '#3a6b8c' },
  done:        { bg: 'rgba(92,148,104,0.18)', fg: 'var(--success-deep, #3f7a4d)' },
}

export default function RoadmapPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [items, setItems] = useState<RoadmapItem[]>([])
  const [premium, setPremium] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')

  async function load() {
    const [ent, list] = await Promise.all([getMyEntitlements().catch(() => null), getRoadmap()])
    setPremium(isPremiumUser(ent))
    setItems(list)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function vote(item: RoadmapItem) {
    if (!premium) { navigate('/premium'); return }
    setBusy(item.id)
    // optimistický update
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, voted: !i.voted, votes: i.votes + (i.voted ? -1 : 1) } : i))
    try { await toggleRoadmapVote(item.id) }
    catch { setItems(prev => prev.map(i => i.id === item.id ? { ...i, voted: item.voted, votes: item.votes } : i)) }
    finally { setBusy(null) }
  }

  async function submit() {
    if (!title.trim()) return
    setBusy('form')
    try {
      await suggestRoadmapItem(title.trim(), desc.trim())
      setTitle(''); setDesc(''); setShowForm(false)
      await load()
    } catch { /* ignore */ } finally { setBusy(null) }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', paddingTop: 'var(--safe-top)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 18px 60px' }}>
        <PageHeader title={t('roadmap.title')} onBack={() => navigate(-1)}/>
        <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '-14px 0 18px', lineHeight: 1.5 }}>{t('roadmap.intro')}</p>

        {!premium && !loading && (
          <button onClick={() => navigate('/premium')} style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
            background: 'linear-gradient(150deg,#d97757,#b85a3e)', border: 'none', borderRadius: 16, padding: '13px 15px', color: '#fff', marginBottom: 16,
          }}>
            <span style={{ fontSize: 20 }}>⭐</span>
            <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5 }}>{t('roadmap.premiumCta')}</span>
            <span style={{ fontSize: 18, opacity: 0.9 }}>›</span>
          </button>
        )}

        {/* Seznam */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(item => {
            const st = STATUS_STYLE[item.status]
            return (
              <div key={item.id} style={{ display: 'flex', gap: 12, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '13px 14px' }}>
                <button
                  onClick={() => vote(item)}
                  disabled={busy === item.id}
                  aria-label={t('roadmap.vote')}
                  style={{
                    flexShrink: 0, width: 52, borderRadius: 12, cursor: 'pointer',
                    border: `1.5px solid ${item.voted ? 'var(--accent)' : 'var(--line-strong)'}`,
                    background: item.voted ? 'rgba(217,119,87,0.10)' : 'var(--paper-100)',
                    color: item.voted ? 'var(--accent-deep)' : 'var(--ink-2)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, padding: '8px 0',
                  }}>
                  <span style={{ fontSize: 14, lineHeight: 1 }}>▲</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>{item.votes}</span>
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>{item.title}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 20, background: st.bg, color: st.fg }}>{t('roadmap.status.' + item.status)}</span>
                  </div>
                  {item.description && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>{item.description}</div>}
                </div>
              </div>
            )
          })}
          {!loading && items.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, padding: '30px 0' }}>{t('roadmap.empty')}</div>
          )}
        </div>

        {/* Návrh nápadu (Premium) */}
        {premium && (
          <div style={{ marginTop: 18 }}>
            {showForm ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 16 }}>
                <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder={t('roadmap.formTitle')} style={{
                  width: '100%', boxSizing: 'border-box', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 11,
                  padding: '11px 13px', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 10,
                }}/>
                <textarea value={desc} onChange={e => setDesc(e.target.value)} maxLength={500} placeholder={t('roadmap.formDesc')} rows={3} style={{
                  width: '100%', boxSizing: 'border-box', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 11,
                  padding: '11px 13px', fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--ink)', marginBottom: 12, resize: 'vertical',
                }}/>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowForm(false)} style={{ flex: 1, background: 'var(--paper-200)', border: '1px solid var(--line)', borderRadius: 11, padding: 11, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>{t('common.close')}</button>
                  <button onClick={submit} disabled={!title.trim() || busy === 'form'} style={{ flex: 1, background: 'var(--accent)', border: 'none', borderRadius: 11, padding: 11, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, color: '#fff', cursor: 'pointer' }}>{t('roadmap.formSubmit')}</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowForm(true)} style={{
                width: '100%', background: 'transparent', border: '1.5px dashed var(--line-strong)', borderRadius: 16, padding: 14,
                fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink-2)', cursor: 'pointer',
              }}>+ {t('roadmap.suggest')}</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

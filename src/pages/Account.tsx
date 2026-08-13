import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { updateProfile, signOut, getMyEntitlements, deleteMyAccount } from '@/lib/supabase'
import { isPremiumUser, type Entitlements } from '@/lib/entitlements'
import { validateUsername, USERNAME_MAX } from '@/lib/username'
import ThemeToggle from '@/components/ThemeToggle'
import MobileNav from '@/components/MobileNav'
import DesktopSidebar from '@/components/DesktopSidebar'
import HowToPlay from '@/components/HowToPlay'
import InstallGuide from '@/components/InstallGuide'
import { isStandalone } from '@/lib/pwaInstall'
import { DownloadIcon } from '@/components/BrowserIcons'
import FeedbackModal from '@/components/FeedbackModal'

const eyebrow: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 13px' }
const fieldLabel: React.CSSProperties = { fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11.5, color: 'var(--ink-2)', margin: '0 0 6px' }
const cardStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 16, marginBottom: 13 }

export default function AccountPage() {
  const { t } = useTranslation()
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState(profile?.username ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showHowTo, setShowHowTo] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [ent, setEnt] = useState<Entitlements | null>(null)
  useEffect(() => { getMyEntitlements().then(setEnt).catch(() => {}) }, [])
  const premium = isPremiumUser(ent)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    const v = validateUsername(username)
    if (!v.ok) { setMessage({ type: 'error', text: t('setup.' + v.error) }); return }
    setSaving(true); setMessage(null)
    const { error } = await updateProfile(user.id, { username: v.value })
    setSaving(false)
    if (!error) setUsername(v.value)
    setMessage(error
      ? { type: 'error', text: (error as { code?: string }).code === '23505' ? t('setup.taken') : t('account.saveError') }
      : { type: 'success', text: t('account.saved') }
    )
  }

  async function handleSignOut() { await signOut(); navigate('/auth') }

  // Smazání účtu — vyžaduje napsat potvrzovací slovo (jazykově nezávisle)
  const [delOpen, setDelOpen] = useState(false)
  const [delText, setDelText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const DELETE_WORDS = ['smazat', 'delete', 'löschen', 'loschen']
  const canDelete = DELETE_WORDS.includes(delText.trim().toLowerCase())
  async function handleDelete() {
    if (!canDelete || deleting) return
    setDeleting(true)
    const { error } = await deleteMyAccount()
    if (error) { setDeleting(false); setMessage({ type: 'error', text: t('account.deleteError') }); return }
    window.location.assign('/')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--paper-200)' }}>
      <DesktopSidebar/>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 'var(--safe-top)', paddingBottom: 'var(--nav-space)' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 18px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '4px 0 18px' }}>
          <button onClick={() => navigate('/menu')} aria-label={t('common.back')} style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
            background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
          }}>←</button>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 25, color: 'var(--ink)', margin: 0, letterSpacing: '-0.01em' }}>{t('account.title')}</h1>
        </div>

        {/* Profil */}
        <form onSubmit={handleSave} style={cardStyle}>
          <p style={eyebrow}>{t('account.profile')}</p>
          <p style={fieldLabel}>{t('auth.email')}</p>
          <input value={user?.email ?? ''} disabled style={{
            width: '100%', boxSizing: 'border-box', background: 'var(--paper-200)', border: '1px solid var(--line)', borderRadius: 11,
            padding: '11px 13px', fontFamily: 'var(--font-sans)', fontSize: 12.5, color: 'var(--ink-3)', marginBottom: 14,
          }}/>
          <p style={fieldLabel}>{t('account.username')}</p>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder={t('account.usernamePlaceholder')} maxLength={USERNAME_MAX} style={{
            width: '100%', boxSizing: 'border-box', background: 'var(--surface)', border: '1px solid var(--line-strong)', borderRadius: 11,
            padding: '11px 13px', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 16,
          }}/>
          {message && (
            <div style={{ fontSize: 12.5, marginBottom: 12, color: message.type === 'error' ? 'var(--danger)' : 'var(--success-deep, #3f7a4d)' }}>{message.text}</div>
          )}
          <button type="submit" disabled={saving} style={{
            width: '100%', background: 'var(--ink)', color: 'var(--paper-50)', border: 'none', borderRadius: 13,
            padding: 13, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {saving && <span className="spinner" style={{ width: 15, height: 15 }}/>}
            {saving ? t('account.saving') : t('common.save')}
          </button>
        </form>

        {/* Předplatné */}
        <button onClick={() => navigate('/premium')} style={{ ...cardStyle, width: '100%', textAlign: 'left', cursor: 'pointer' }}>
          <p style={eyebrow}>{t('account.subscription')}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <span style={{ fontSize: 22 }}>{premium ? '⭐' : '✦'}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>
                {premium ? t('account.planPremium') : t('account.planFree')}
              </span>
              <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 11.5, color: premium ? 'var(--ink-3)' : 'var(--accent)', marginTop: 2 }}>
                {premium ? t('account.manageSub') : t('account.upgradeSub')}
              </span>
            </span>
            <span style={{ fontSize: 18, color: 'var(--ink-3)' }}>›</span>
          </div>
        </button>

        {/* Vzhled */}
        <div style={cardStyle}>
          <p style={eyebrow}>{t('account.appearance')}</p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 13, color: 'var(--ink)' }}>{t('account.themeLabel')}</span>
            <ThemeToggle/>
          </div>
        </div>

        {/* Nápověda */}
        <button onClick={() => setShowHowTo(true)} style={{ ...cardStyle, width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13 }}>
          <span style={{ fontSize: 22 }}>🎓</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{t('menu.htHow')}</span>
            <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{t('menu.htHowSub')}</span>
          </span>
          <span style={{ fontSize: 18, color: 'var(--ink-3)' }}>›</span>
        </button>

        {/* Nahlásit chybu / zpětná vazba */}
        <button onClick={() => setShowFeedback(true)} style={{ ...cardStyle, width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13 }}>
          <span style={{ fontSize: 22 }}>🐞</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{t('feedback.title')}</span>
            <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{t('feedback.accountSub')}</span>
          </span>
          <span style={{ fontSize: 18, color: 'var(--ink-3)' }}>›</span>
        </button>

        {/* Přidat na plochu — skryté, když už aplikace běží nainstalovaná */}
        {!isStandalone() && (
          <button onClick={() => setShowInstall(true)} style={{ ...cardStyle, width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13 }}>
            <span style={{ display: 'flex', color: 'var(--accent)' }}><DownloadIcon size={22}/></span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{t('common.instTile')}</span>
              <span style={{ display: 'block', fontFamily: 'var(--font-sans)', fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{t('common.instTileSub')}</span>
            </span>
            <span style={{ fontSize: 18, color: 'var(--ink-3)' }}>›</span>
          </button>
        )}

        {/* Relace */}
        <div style={cardStyle}>
          <p style={eyebrow}>{t('account.session')}</p>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, lineHeight: 1.4, color: 'var(--ink-2)', margin: '0 0 12px' }}>
            {t('account.loggedInAs')} <strong style={{ color: 'var(--ink)' }}>{user?.email}</strong>
          </p>
          <button onClick={handleSignOut} style={{
            width: '100%', background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 12,
            padding: 11, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>{t('account.signOut')}</button>
        </div>

        {/* Smazání účtu (nebezpečná zóna) */}
        <div style={{ ...cardStyle, borderColor: 'rgba(200,60,50,0.35)' }}>
          <p style={{ ...eyebrow, color: '#c0392b' }}>{t('account.deleteTitle')}</p>
          {!delOpen ? (
            <button onClick={() => setDelOpen(true)} style={{
              width: '100%', background: 'transparent', border: '1px solid #c0392b', color: '#c0392b', borderRadius: 12,
              padding: 11, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>{t('account.deleteTitle')}</button>
          ) : (
            <>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-2)', margin: '0 0 12px' }}>
                ⚠️ {t('account.deleteDanger')}
              </p>
              <label style={fieldLabel}>{t('account.deleteConfirmLabel', { word: t('account.deleteWord') })}</label>
              <input className="input" value={delText} onChange={e => setDelText(e.target.value)} placeholder={t('account.deleteWord')} autoFocus style={{ marginBottom: 12 }}/>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setDelOpen(false); setDelText('') }} style={{
                  flex: 1, background: 'transparent', border: '1px solid var(--line-strong)', color: 'var(--ink-2)', borderRadius: 12,
                  padding: 11, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}>{t('common.cancel')}</button>
                <button onClick={handleDelete} disabled={!canDelete || deleting} style={{
                  flex: 1, background: canDelete ? '#c0392b' : 'var(--paper-300)', border: 'none',
                  color: canDelete ? '#fff' : 'var(--ink-3)', borderRadius: 12,
                  padding: 11, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13,
                  cursor: canDelete && !deleting ? 'pointer' : 'default',
                }}>{deleting ? '…' : t('account.deleteBtn')}</button>
              </div>
            </>
          )}
        </div>
      </div>
      </div>
      <MobileNav active="profile"/>
      {showHowTo && <HowToPlay onClose={() => setShowHowTo(false)}/>}
      {showInstall && <InstallGuide onClose={() => setShowInstall(false)}/>}
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)}/>}
    </div>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { playAsGuest, updateProfile, track } from '@/lib/supabase'
import { validateUsername, USERNAME_MAX } from '@/lib/username'
import { CAPTCHA_ENABLED } from '@/lib/turnstile'
import Turnstile from '@/components/Turnstile'
import BackButton from '@/components/BackButton'

// Vytvoření host účtu (bez registrace). Účet vzniká AŽ TADY, při odeslání
// přezdívky — proto je tu viditelná CAPTCHA (chrání anonymní sign-in).
export default function GuestSetupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Když anonymní účet už vznikl, ale uložení jména selhalo (obsazené) —
  // při dalším pokusu se už znovu nepřihlašujeme (a captcha není potřeba).
  const [guestId, setGuestId] = useState<string | null>(null)
  const [captcha, setCaptcha] = useState<string | null>(CAPTCHA_ENABLED ? null : '')
  const [captchaKey, setCaptchaKey] = useState(0)
  const resetCaptcha = () => { if (CAPTCHA_ENABLED) { setCaptcha(null); setCaptchaKey(k => k + 1) } }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = validateUsername(name)
    if (!v.ok) { setError(t('setup.' + v.error)); return }
    setSaving(true); setError(null)

    let uid = guestId
    if (!uid) {
      if (CAPTCHA_ENABLED && !captcha) { setSaving(false); setError(t('auth.captchaWait')); return }
      const res = await playAsGuest(captcha || undefined)
      if (res.error || !res.userId) {
        setSaving(false); resetCaptcha()
        setError(t('auth.errGeneric'))
        return
      }
      uid = res.userId
      setGuestId(uid)
    }

    const { error: err } = await updateProfile(uid, { username: v.value })
    if (err) {
      setSaving(false)
      setError((err as { code?: string }).code === '23505' ? t('setup.taken') : t('setup.error'))
      return
    }
    track('sign_up', { converted: false, guest: true }, uid)
    // Plný reload → AuthProvider načte profil čerstvě z DB (s přezdívkou),
    // žádný závod s auth-listenerem, který by jinak ukázal UsernameSetup.
    window.location.assign('/menu')
  }

  async function goBack() {
    navigate('/', { replace: true })
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-200)', padding: 24 }}>
      <div className="card" style={{ width: '100%', maxWidth: 420, padding: 32 }}>
        <BackButton onClick={goBack} label={t('common.back')} style={{ marginBottom: 18 }} />
        <div style={{ fontSize: 36, marginBottom: 10 }}>👋</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{t('setup.title')}</h1>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', margin: '0 0 22px' }}>{t('setup.sub')}</p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input
            className="input" value={name} onChange={e => setName(e.target.value)}
            placeholder={t('setup.placeholder')} maxLength={USERNAME_MAX} autoFocus
          />
          <Turnstile key={captchaKey} onToken={setCaptcha} theme="light" />
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-accent" type="submit" disabled={saving || name.trim().length < 3}>
            {saving ? <span className="spinner" style={{ width: 16, height: 16 }}/> : null}
            {t('setup.confirm')}
          </button>
        </form>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 16,
          background: 'var(--paper-200)', border: '1px solid var(--line)', borderRadius: 12, padding: '11px 13px',
        }}>
          <span style={{ flexShrink: 0, fontSize: 14, marginTop: 1 }}>ⓘ</span>
          <span style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-3)' }}>{t('setup.guestNote')}</span>
        </div>
      </div>
    </div>
  )
}

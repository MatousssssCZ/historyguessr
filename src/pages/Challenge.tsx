import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { playAsGuest, assignGuestUsername, getEventsByIds, transformedImageUrl, track } from '@/lib/supabase'
import { CAPTCHA_ENABLED } from '@/lib/turnstile'
import Turnstile from '@/components/Turnstile'
import type { Event } from '@/types/database'

// Příjem výzvy: přehraje jednu konkrétní událost. Hráč hraje automaticky —
// jako přihlášený (pamatuje-li si prohlížeč session), jinak se vytvoří host.
export default function ChallengePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { eventId } = useParams<{ eventId: string }>()
  const [sp] = useSearchParams()
  const target = Math.max(0, Math.min(1000, parseInt(sp.get('s') || '0', 10) || 0))
  const by = (sp.get('by') || '').slice(0, 24)
  const { user, loading } = useAuth()

  const [event, setEvent] = useState<Event | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [captcha, setCaptcha] = useState<string | null>(CAPTCHA_ENABLED ? null : '')
  const guestStarted = useRef(false)

  // Načti událost výzvy
  useEffect(() => {
    if (!eventId) { setNotFound(true); return }
    getEventsByIds([eventId])
      .then(evs => { if (evs.length === 0) setNotFound(true); else setEvent(evs[0]) })
      .catch(() => setNotFound(true))
  }, [eventId])

  // Auth: přihlášený hraje jako on; jinak vytvoř hosta (po captcha, je-li zapnutá)
  useEffect(() => {
    if (loading || user || guestStarted.current || captcha === null) return
    guestStarted.current = true
    ;(async () => {
      const res = await playAsGuest(captcha || undefined)
      if (res.error || !res.userId) { guestStarted.current = false; return }
      await assignGuestUsername(res.userId).catch(() => {})
      track('sign_up', { converted: false, guest: true, challenge: true }, res.userId)
    })()
  }, [loading, user, captcha])

  function accept() {
    if (!event || !user) return
    navigate('/game', { state: { events: [event], rounds: 1, challenge: target > 0 ? { target, by } : undefined } })
  }

  const ready = !!event && !!user

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-200)', padding: 24 }}>
      {CAPTCHA_ENABLED && !user && <Turnstile onToken={setCaptcha} onError={() => setCaptcha('')} appearance="interaction-only" theme="light"/>}
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 22, overflow: 'hidden', boxShadow: 'var(--shadow-xl)' }}>
        {/* Hero — ilustrace události, ale bez prozrazení názvu (výzva = hádej sám) */}
        <div style={{ position: 'relative', height: 150, background: 'linear-gradient(155deg,#8a6f50,#2a1f17)' }}>
          {event?.event_image_url && <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${transformedImageUrl(event.event_image_url, { width: 800, quality: 60 })})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(2px)' }}/>}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(20,16,10,.25), rgba(20,16,10,.7))' }}/>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 22px 16px', color: '#fff' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#E8C88A' }}>
              {by ? t('challenge.kickerBy', { by }) : t('challenge.kicker')}
            </div>
          </div>
        </div>

        <div style={{ padding: '22px 24px 24px', textAlign: 'center' }}>
          {notFound ? (
            <>
              <p style={{ fontSize: 15, color: 'var(--ink-2)', margin: '4px 0 18px' }}>{t('challenge.notFound')}</p>
              <button className="btn btn-ghost" onClick={() => navigate('/')}>{t('common.back')}</button>
            </>
          ) : (
            <>
              {target > 0 ? (
                <>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{t('challenge.beat', { score: target.toLocaleString('cs-CZ') })}</div>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '6px 0 20px', lineHeight: 1.5 }}>{t('challenge.sub')}</p>
                </>
              ) : (
                <>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, color: 'var(--ink)' }}>{t('challenge.plainTitle')}</div>
                  <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '6px 0 20px', lineHeight: 1.5 }}>{t('challenge.sub')}</p>
                </>
              )}
              <button className="btn btn-accent" disabled={!ready} onClick={accept} style={{ width: '100%', padding: '15px 0', fontSize: 16, borderRadius: 14 }}>
                {ready
                  ? <>{t('challenge.accept')} <span style={{ marginLeft: 6 }}>→</span></>
                  : <><span className="spinner" style={{ width: 15, height: 15 }}/> {t('challenge.preparing')}</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

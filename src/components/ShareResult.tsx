import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { renderDailyShareCard, type ShareCardData } from '@/lib/shareCard'

export interface ShareResultProps {
  data: Omit<ShareCardData, 'labels'>
  /** Text pro sdílení bez obrázku (schránka / fallback). */
  shareText: string
  onClose: () => void
}

/**
 * Modal se sdílením výsledku denní výzvy: náhled vygenerované karty a tři cesty
 * ven — nativní sdílení (mobil), stažení PNG (desktop) a zkopírování textu.
 */
export default function ShareResult({ data, shareText, onClose }: ShareResultProps) {
  const { t } = useTranslation()
  const [url, setUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    let objectUrl: string | null = null
    renderDailyShareCard({
      ...data,
      labels: {
        eyebrow: t('menu.dailyMobile'),
        place: t('common.place'),
        year: t('common.year'),
        better: data.betterThan != null ? t('daily.shareBetter', { p: data.betterThan }) : '',
        cta: t('daily.shareCta'),
        site: 'historyguessr.vercel.app',
      },
    }).then(b => {
      if (!alive) return
      objectUrl = URL.createObjectURL(b)
      setBlob(b); setUrl(objectUrl)
    }).catch(() => { if (alive) setErr(t('daily.shareFailed')) })
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [])

  const file = blob ? new File([blob], 'historyguessr.png', { type: 'image/png' }) : null
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })

  async function nativeShare() {
    if (!file) return
    try { await navigator.share({ files: [file], text: shareText }) }
    catch { /* uživatel zrušil — nic nehlásíme */ }
  }
  function download() {
    if (!url) return
    const a = document.createElement('a')
    a.href = url; a.download = 'historyguessr.png'
    a.click()
  }
  async function copyText() {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    } catch { setErr(t('daily.shareFailed')) }
  }

  const btn: React.CSSProperties = {
    flex: 1, minWidth: 140, borderRadius: 13, padding: '13px 16px', cursor: 'pointer',
    fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14,
  }

  return (
    <div onClick={onClose} style={{
      // z-index nad Leafletem (ovládací prvky mapy mají 1000), jinak prosvítají skrz
      position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(20,15,10,0.62)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--paper-50)', borderRadius: 24, padding: '20px 20px 18px', width: '100%', maxWidth: 420,
        maxHeight: '92dvh', overflowY: 'auto', boxShadow: 'var(--shadow-xl)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0, color: 'var(--ink)' }}>{t('daily.shareTitle')}</h3>
          <button onClick={onClose} aria-label={t('common.close')} style={{
            width: 30, height: 30, borderRadius: '50%', background: 'var(--paper-200)', border: 'none',
            cursor: 'pointer', color: 'var(--ink-3)', fontSize: 13,
          }}>✕</button>
        </div>

        {/* Náhled karty */}
        <div style={{
          borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', marginBottom: 10,
          aspectRatio: '1080 / 1350', background: '#241A11',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {url
            ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}/>
            : <span style={{ fontSize: 13, color: 'rgba(245,241,232,0.6)' }}>{t('daily.shareRendering')}</span>}
        </div>

        <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: '0 0 14px', textAlign: 'center' }}>
          {t('daily.shareNoSpoiler')}
        </p>

        {err && <div className="alert alert-error" style={{ marginBottom: 12 }}>⚠ {err}</div>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
          {canShareFile && (
            <button onClick={nativeShare} disabled={!blob}
              style={{ ...btn, background: 'var(--accent)', color: '#fff', border: 'none' }}>
              {t('daily.shareBtn')}
            </button>
          )}
          <button onClick={download} disabled={!url}
            style={{ ...btn, background: canShareFile ? 'var(--paper-200)' : 'var(--accent)', color: canShareFile ? 'var(--ink)' : '#fff', border: canShareFile ? '1px solid var(--line)' : 'none' }}>
            {t('daily.shareDownload')}
          </button>
          <button onClick={copyText}
            style={{ ...btn, background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--line-strong)' }}>
            {copied ? t('daily.shareCopied') : t('daily.shareCopy')}
          </button>
        </div>
      </div>
    </div>
  )
}

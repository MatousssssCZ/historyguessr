import { useEffect, useRef, useState } from 'react'
import { currentLocale } from '@/i18n'
import { useTranslation } from 'react-i18next'
import { eventTitle, eventDescription } from '@/lib/eventLocale'
import { GuessMap, ResultMap } from '@/components/GameMap'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useGame, type GameOptions } from '@/hooks/useGame'
import { formatYear, formatDistance } from '@/lib/scoring'
import { addEventRating, startCampaignAttempt, getEventsByIds } from '@/lib/supabase'
import { XP_BONUS_GAME } from '@/lib/leveling'
import GameEvaluation from '@/components/GameEvaluation'
import CompassLoader from '@/components/CompassLoader'
import { panoramaHfov } from '@/lib/panorama'
import { starThresholds, maxScoreFor } from '@/lib/campaignLogic'
import ControlDock from '@/components/GameControls'
import type { Event, RoundResult, CampaignReward, RewardRarity } from '@/types/database'

/** Podbarvení artefaktu podle vzácnosti. */
const RARITY_BG: Record<RewardRarity, string> = {
  common: 'rgba(246,240,230,0.12)',
  rare: 'rgba(122,168,204,0.28)',
  epic: 'rgba(168,122,204,0.28)',
  legendary: 'rgba(245,206,139,0.32)',
}

declare const pannellum: {
  viewer: (container: string | HTMLElement, config: object) => { destroy: () => void }
}

export default function GamePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const options = (location.state as GameOptions | null) ?? undefined
  const {
    state, currentEvent, lastRound, canSubmit,
    startGame, resumeGame, setGuessLocation, setGuessYear, submitRound, nextRound, resetGame, roundsCount
  } = useGame(user?.id)
  const [confirmQuit, setConfirmQuit] = useState(false)

  useEffect(() => {
    if (state.phase !== 'idle') return
    // Pokračování v rozehrané hře; když se nepodaří, spusť normálně
    if (options?.resume) { if (!resumeGame()) startGame() }
    else startGame(options)
  }, [])

  if (state.phase === 'loading') return <LoadingScreen/>
  if (state.error) return <ErrorScreen msg={state.error} onRetry={() => startGame(options)}/>
  // Zopakování KAMPANĚ musí projít serverem (nový pokus = nová výprava),
  // nesmí se jen lokálně restartovat s vyčerpaným attemptem.
  async function retryCampaign() {
    const campaignId = state.campaignId
    if (!campaignId) return
    try {
      const { attemptId, eventIds } = await startCampaignAttempt(campaignId)
      const evs = await getEventsByIds(eventIds)
      resetGame()
      await startGame({
        events: evs, attemptId, campaignId,
        campaignTitle: state.campaignTitle ?? undefined, rounds: evs.length,
      })
    } catch {
      // Došly výpravy / ztracený přístup → zpět na kampaně, kde je upsell
      navigate('/campaigns')
    }
  }

  if (state.phase === 'finished') return (
    <FinishedScreen
      totalScore={state.totalScore}
      rounds={state.rounds.length}
      roundResults={state.rounds}
      events={state.events}
      userId={user?.id}
      campaignStars={state.campaignStars}
      campaignTitle={state.campaignTitle}
      campaignRewards={state.campaignRewards}
      onCampaigns={state.campaignId ? () => navigate('/campaigns') : undefined}
      onPlayAgain={state.campaignId ? retryCampaign : () => { resetGame(); startGame(options) }}
      onMenu={() => navigate('/menu')}
    />
  )
  if (!currentEvent) return <LoadingScreen/>

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0d0906', position: 'relative', overflow: 'hidden' }}>
      {/* HUD — plovoucí skleněné pilulky nad panoramatem */}
      <div style={{
        position: 'absolute', top: 'calc(env(safe-area-inset-top,0px) + 12px)', left: 0, right: 0, zIndex: 25,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', pointerEvents: 'none',
      }}>
        {/* ✕ Skončit */}
        <button onClick={() => setConfirmQuit(true)} aria-label={t('game.quit')} style={{
          pointerEvents: 'auto', width: 38, height: 38, borderRadius: '50%', cursor: 'pointer',
          background: 'rgba(246,240,230,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.5)',
          color: '#26211C', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
        {/* Kolo / mód */}
        <div style={{
          pointerEvents: 'auto', textAlign: 'center', borderRadius: 16, padding: '6px 16px',
          background: 'rgba(246,240,230,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.5)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: '#26211C', letterSpacing: '0.05em' }}>
            {String(state.currentRound + 1).padStart(2, '0')} / {String(roundsCount).padStart(2, '0')}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, letterSpacing: '0.12em', color: '#8C8175', marginTop: 1 }}>{t('pregame.mode')}</div>
        </div>
        {/* Skóre */}
        <div style={{
          pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 5, height: 38, borderRadius: 20, padding: '0 13px',
          background: 'rgba(246,240,230,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.5)',
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: '#26211C',
        }}>★ {state.totalScore.toLocaleString(currentLocale())}</div>
      </div>

      {/* Potvrzení ukončení hry */}
      {confirmQuit && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(13,9,6,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 18, padding: 28, maxWidth: 380, width: '100%', boxShadow: 'var(--shadow-xl)', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 21, marginBottom: 8 }}>{t('game.quitConfirmTitle')}</div>
            <p style={{ fontSize: 14, color: 'var(--ink-2)', margin: '0 0 22px', lineHeight: 1.5 }}>{t('game.quitConfirmBody')}</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setConfirmQuit(false)} style={{ flex: 1, background: 'var(--paper-200)', border: '1px solid var(--line)', borderRadius: 10, padding: '12px 0', fontSize: 14, fontWeight: 500, color: 'var(--ink)', cursor: 'pointer' }}>{t('game.quitCancel')}</button>
              <button onClick={() => { resetGame(); navigate('/menu') }} style={{ flex: 1, background: '#c0392b', border: 'none', borderRadius: 10, padding: '12px 0', fontSize: 14, fontWeight: 500, color: '#fff', cursor: 'pointer' }}>{t('game.quitConfirm')}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, position: 'relative' }}>
        {state.phase === 'playing' && <PanoramaViewer url={currentEvent.panorama_url} preview={currentEvent.preview_url}/>}
        {/* Skrytý viewer pro prefetch dalšího kola — Pannellum skutečně načte obrázek */}
        {state.phase === 'playing' && state.events[state.currentRound + 1]?.panorama_url &&
          state.events[state.currentRound + 1].panorama_url !== 'pending' && (
          <div style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden', top: 0, left: 0 }}>
            <PanoramaViewer url={state.events[state.currentRound + 1].panorama_url}/>
          </div>
        )}

        {/* Název — výrazný overlay vlevo nahoře, pluje nad mapou i panelem roku */}
        {state.phase === 'playing' && (
          <div style={{
            position: 'absolute', top: 'calc(env(safe-area-inset-top,0px) + 62px)', left: 16, zIndex: 45,
            maxWidth: 'min(400px, 58vw)', pointerEvents: 'none',
          }}>
            <div style={{
              background: 'rgba(13,9,6,0.6)',
              backdropFilter: 'blur(14px)',
              border: '1px solid rgba(245,241,232,0.12)',
              borderRadius: 12, padding: '10px 16px',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                letterSpacing: '0.18em', color: 'var(--accent)',
                textTransform: 'uppercase', marginBottom: 5,
              }}>{t('game.histEvent')}</div>
              <div style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(15px, 2.2vw, 22px)',
                color: 'var(--on-dark)',
                letterSpacing: '-0.01em', lineHeight: 1.2,
              }}>
                {eventTitle(currentEvent)}
              </div>
            </div>
          </div>
        )}

        {state.phase === 'playing' && (
          <GuessPanel
            guessLat={state.guessLat}
            guessLng={state.guessLng}
            guessYear={state.guessYear}
            guessYearSet={state.guessYearSet}
            canSubmit={canSubmit}
            onLocationChange={setGuessLocation}
            onYearChange={setGuessYear}
            onSubmit={submitRound}
          />
        )}
      </div>

      {/* RoundResult — jako sibling HUDu, pokrývá celou obrazovku */}
      {state.phase === 'round_result' && lastRound && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 100,
        }}>
          <RoundResult
            event={currentEvent}
            round={lastRound}
            onNext={nextRound}
            isLast={state.currentRound === roundsCount - 1}
          />
        </div>
      )}
    </div>
  )
}

// ── Panorama viewer ───────────────────────────────────────
export function PanoramaViewer({ url, preview }: { url: string; preview?: string | null }) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<{ destroy: () => void } | null>(null)
  const loadedRef = useRef(false)
  const [error, setError] = useState<'loading' | 'failed' | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!containerRef.current || !url || url === 'pending') {
      setError('failed')
      return
    }
    setError('loading')
    loadedRef.current = false
    if (viewerRef.current) { viewerRef.current.destroy(); viewerRef.current = null }

    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      const viewer = pannellum.viewer(containerRef.current, {
        type: 'equirectangular',
        panorama: url,
        autoLoad: true,
        showControls: false,
        mouseZoom: true,
        hfov: panoramaHfov(),
        maxHfov: panoramaHfov(),
        pitch: 0,
        yaw: 0,
        ...(preview ? { preview } : {}),
      })

      ;(viewer as unknown as { on: (e: string, cb: () => void) => void })
        .on?.('error', () => { if (!loadedRef.current) setError('failed') })

      // Timeout — pokud se panorama nenačte (ref, ne stale state)
      timeout = setTimeout(() => { if (!loadedRef.current) setError('failed') }, 20000)

      ;(viewer as unknown as { on: (e: string, cb: () => void) => void })
        .on?.('load', () => { loadedRef.current = true; setError(null); if (timeout) clearTimeout(timeout) })

      viewerRef.current = viewer
    } catch (e) {
      console.error('[Panorama] Init error:', e)
      setError('failed')
    }
    return () => {
      if (timeout) clearTimeout(timeout)
      viewerRef.current?.destroy()
      viewerRef.current = null
    }
  }, [url, preview, reloadKey])

  // Návrat do appky (např. po přepnutí aplikací) — když se nestihlo načíst,
  // zkus to znovu místo zaseknutého loadingu.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && !loadedRef.current) setReloadKey(k => k + 1)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const retry = () => setReloadKey(k => k + 1)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }}/>
      <FullscreenButton/>

      {/* Loading overlay — sépiový „hledající kompas" */}
      {error === 'loading' && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 4,
          background: 'radial-gradient(circle at 50% 42%, #3a2a1d 0%, var(--sepia-900) 70%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 20, animation: 'fadeIn 250ms ease',
        }}>
          <CompassLoader size={76}/>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: 'var(--feature-fg)', margin: 0, animation: 'textPulse 1.6s ease-in-out infinite',
          }}>
            {t('game.loadingPanorama')}
          </p>
        </div>
      )}

      {/* Fallback overlay — chyba i zaseknuté načítání */}
      {error === 'failed' && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'var(--sepia-900)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 14, padding: 32, zIndex: 5,
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(245,241,232,0.3)" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'rgba(245,241,232,0.6)', margin: 0, textAlign: 'center' }}>
            {t('game.panoramaUnavailable')}
          </p>
          <button onClick={retry} style={{
            background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10,
            padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
          }}>{t('game.panoramaRetry')}</button>
        </div>
      )}
    </div>
  )
}

// ── Fullscreen button ────────────────────────────────────
function FullscreenButton() {
  const [isFs, setIsFs] = useState(false)

  async function toggle() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {})
      setIsFs(true)
    } else {
      await document.exitFullscreen().catch(() => {})
      setIsFs(false)
    }
  }

  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  return (
    <button
      onClick={toggle}
      style={{
        position: 'absolute', top: 12, right: 12,
        background: 'rgba(13,9,6,0.55)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(245,241,232,0.15)',
        borderRadius: 8, padding: '7px 10px',
        color: 'rgba(245,241,232,0.8)', cursor: 'pointer',
        fontSize: 16, lineHeight: 1, zIndex: 5,
        transition: 'background 160ms',
      }}
      title={isFs ? 'Ukončit fullscreen' : 'Fullscreen'}
    >
      {isFs ? '⛶' : '⛶'}
    </button>
  )
}

// ── Guess panel — GeoGuessr styl ─────────────────────────

export function GuessPanel({ guessLat, guessLng, guessYear, guessYearSet, canSubmit, onLocationChange, onYearChange, onSubmit }: {
  guessLat: number | null; guessLng: number | null; guessYear: number
  guessYearSet: boolean
  canSubmit: boolean; onLocationChange: (lat: number, lng: number) => void
  onYearChange: (y: number) => void; onSubmit: () => void
}) {
  const { t } = useTranslation()
  const [mapExpanded, setMapExpanded] = useState(false)
  const [yearExpanded, setYearExpanded] = useState(false)
  const isMobile = window.innerWidth <= 640

  const missingLocation = guessLat === null
  const missingYear = !canSubmit && !missingLocation
  const submitLabel = missingLocation && missingYear
    ? t('game.submitBoth')
    : missingLocation ? t('game.submitPlace')
    : missingYear ? t('game.submitYear')
    : t('game.submit')

  const mapPin = guessLat !== null
    ? `${guessLat.toFixed(1)}°${guessLat >= 0 ? 'N' : 'S'} ${guessLng?.toFixed(1)}°${(guessLng ?? 0) >= 0 ? 'E' : 'W'}`
    : null

  if (!isMobile) {
    // Desktop — stejný vzor jako mobil: dvě dlaždice (dole vpravo),
    // klik rozbalí mapu (~95 %) nebo kompaktní okno roku
    return (
      <>
        {/* Rozbalená mapa — přes ~95 % obrazovky */}
        {mapExpanded && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(13,9,6,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'relative', width: '95%', height: '95%', borderRadius: 14, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <GuessMap guessLat={guessLat} guessLng={guessLng} onGuess={onLocationChange}/>
                <button
                  onClick={() => setMapExpanded(false)}
                  aria-label={t('game.shrinkMap')}
                  style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, width: 40, height: 40, borderRadius: '50%', background: 'rgba(13,9,6,0.72)', backdropFilter: 'blur(8px)', border: '1px solid rgba(245,241,232,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, lineHeight: 1, color: 'rgba(245,241,232,0.95)', cursor: 'pointer' }}
                >×</button>
              </div>
              <div style={{ background: 'rgba(245,241,232,0.97)', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTop: '0.5px solid var(--line)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{mapPin ? `${mapPin} ✓` : t('game.clickMap')}</span>
                <button
                  onClick={() => setMapExpanded(false)}
                  style={{ background: guessLat !== null ? 'var(--accent)' : 'var(--paper-400)', border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 14, fontWeight: 500, color: guessLat !== null ? '#fff' : 'var(--ink-3)', cursor: 'pointer' }}
                >
                  {guessLat !== null ? t('game.confirmPlace') : t('game.pickPlace')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rozbalený rok — kompaktní centrované okno */}
        {yearExpanded && (
          <div onClick={() => setYearExpanded(false)} style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(13,9,6,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: 460, maxWidth: '90%', background: 'var(--paper-50)', borderRadius: 16, boxShadow: '0 24px 60px rgba(0,0,0,0.45)', padding: 16 }}>
              <YearPicker value={guessYear} onChange={onYearChange}/>
              <button
                onClick={() => setYearExpanded(false)}
                style={{ marginTop: 12, width: '100%', background: 'var(--accent)', border: 'none', borderRadius: 10, padding: '12px 0', fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 500, color: '#fff', cursor: 'pointer' }}
              >
                {t('game.confirmYear')}
              </button>
            </div>
          </div>
        )}

        {/* Základ — dock (dvě svislé dlaždice + odeslat) */}
        {!mapExpanded && !yearExpanded && (
          <ControlDock set={guessLat !== null} guessYear={guessYear} guessYearSet={guessYearSet}
            canSubmit={canSubmit} submitLabel={submitLabel}
            onMap={() => setMapExpanded(true)} onYear={() => setYearExpanded(true)} onSubmit={onSubmit}/>
        )}
      </>
    )
  }

  // ── MOBIL: GeoGuessr styl ─────────────────────────────
  return (
    <>
      {/* Rozbalená mapa — fullscreen přes celý telefon */}
      {mapExpanded && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          display: 'flex', flexDirection: 'column', background: '#0d0906',
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <GuessMap guessLat={guessLat} guessLng={guessLng} onGuess={(lat, lng) => { onLocationChange(lat, lng) }}/>
            {/* Křížek — zavřít fullscreen mapu */}
            <button
              onClick={() => setMapExpanded(false)}
              aria-label={t('game.shrinkMap')}
              style={{
                position: 'absolute', top: 'calc(10px + env(safe-area-inset-top,0px))', right: 10, zIndex: 10,
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(13,9,6,0.72)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(245,241,232,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, lineHeight: 1, color: 'rgba(245,241,232,0.95)', cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
          {/* Potvrzení místa */}
          <div style={{
            background: 'rgba(245,241,232,0.97)',
            padding: '12px 16px',
            paddingBottom: 'max(12px, calc(env(safe-area-inset-bottom) + 8px))',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, borderTop: '0.5px solid var(--line)',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
              {mapPin ? `${mapPin} ✓` : t('game.clickMap')}
            </span>
            <button
              onClick={() => setMapExpanded(false)}
              style={{
                background: guessLat !== null ? 'var(--accent)' : 'var(--paper-400)',
                border: 'none', borderRadius: 9, padding: '10px 20px',
                fontSize: 14, fontWeight: 500,
                color: guessLat !== null ? '#fff' : 'var(--ink-3)',
                cursor: 'pointer',
              }}
            >
              {guessLat !== null ? t('game.confirmPlace') : t('game.pickPlace')}
            </button>
          </div>
        </div>
      )}

      {/* Rozbalený rok */}
      {yearExpanded && (
        <div
          onClick={() => setYearExpanded(false)}
          style={{
            position: 'absolute', inset: 0, zIndex: 30,
            background: 'rgba(13,9,6,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              background: 'var(--paper-50)',
              borderRadius: '20px 20px 0 0',
              padding: '14px 16px',
              paddingBottom: 'max(14px, calc(env(safe-area-inset-bottom) + 12px))',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.35)',
            }}>
            <YearPicker value={guessYear} onChange={onYearChange}/>
            <button
              onClick={() => setYearExpanded(false)}
              style={{
                marginTop: 10, width: '100%',
                background: 'var(--accent)', border: 'none', borderRadius: 10,
                padding: '11px 0', fontSize: 15, fontWeight: 500, color: '#fff', cursor: 'pointer',
              }}
            >
              {t('game.confirmYear')}
            </button>
          </div>
        </div>
      )}

      {/* Kompaktní UI — dock (2 svislé dlaždice + odeslat) */}
      {!mapExpanded && !yearExpanded && (
        <ControlDock set={guessLat !== null} guessYear={guessYear} guessYearSet={guessYearSet}
          canSubmit={canSubmit} submitLabel={submitLabel}
          onMap={() => setMapExpanded(true)} onYear={() => setYearExpanded(true)} onSubmit={onSubmit}/>
      )}
    </>
  )
}

// ── Year picker — barevný slider + numerický input ───────
export function YearPicker({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  const { t } = useTranslation()
  const MIN = -3000; const MAX = 2025
  const TOTAL = MAX - MIN  // 5025
  const pct = ((value - MIN) / TOTAL) * 100
  const zeroPct = ((0 - MIN) / TOTAL) * 100  // 59.7%

  // Lokální koncept psaní — umožní začít znakem „−" i prázdné pole
  const [draft, setDraft] = useState<string | null>(null)

  function step(d: number) {
    let next = value + d
    if (next === 0) next = d > 0 ? 1 : -1
    onChange(Math.max(MIN, Math.min(MAX, next)))
  }

  function handleInput(raw: string) {
    // Povol mezistavy: prázdno a samotné „−"
    if (raw === '' || raw === '-') { setDraft(raw); return }
    if (!/^-?\d+$/.test(raw)) return  // jen čísla a volitelný mínus
    setDraft(raw)
    const n = parseInt(raw, 10)
    if (isNaN(n)) return
    const clamped = Math.max(MIN, Math.min(MAX, n))
    onChange(clamped === 0 ? -1 : clamped)
  }

  const inputValue = draft !== null ? draft : (value === 0 ? '' : String(value))

  const stepBtnStyle: React.CSSProperties = {
    flex: '0 0 44px', padding: '9px 0', borderRadius: 9,
    border: '0.5px solid var(--line-strong)', background: 'var(--paper-100)',
    fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 500,
    color: 'var(--ink)', cursor: 'pointer',
  }

  const thumbColor = value < 0 ? '#7aa8cc' : '#d97757'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Barevný slider */}
      <div>
        <div style={{ position: 'relative', height: 48, marginBottom: 4, touchAction: 'none' }}>
          {/* Pozadí stopy */}
          <div style={{ position: 'absolute', top: 21, left: 0, right: 0, height: 6, borderRadius: 999, overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${zeroPct}%`, background: 'linear-gradient(90deg, #5a8fb5, #9bbdd4)' }}/>
            <div style={{ flex: 1, background: 'linear-gradient(90deg, #e8b49a, #d97757)' }}/>
          </div>
          {/* Nulová svislá čára */}
          <div style={{
            position: 'absolute', top: 15, left: `${zeroPct}%`,
            width: 2, height: 18,
            background: 'rgba(42,31,23,0.3)',
            transform: 'translateX(-50%)',
            borderRadius: 1,
            pointerEvents: 'none',
          }}/>
          {/* Custom thumb — větší pro snadné chycení palcem */}
          <div style={{
            position: 'absolute', top: 9,
            left: `${pct}%`,
            transform: 'translateX(-50%)',
            width: 30, height: 30, borderRadius: '50%',
            background: 'var(--paper-50)',
            border: `3px solid ${thumbColor}`,
            boxShadow: `0 0 0 4px ${value < 0 ? 'rgba(90,143,181,0.2)' : 'rgba(217,119,87,0.2)'}`,
            pointerEvents: 'none',
            transition: 'border-color 200ms',
          }}/>
          {/* Invisible range input — velké dotykové pole + bez posunu stránky */}
          <input
            type="range" min={MIN} max={MAX} value={value}
            step={1}
            onChange={e => {
              let v = parseInt(e.target.value)
              if (v === 0) v = -1
              onChange(v)
            }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: 48, opacity: 0, cursor: 'pointer', margin: 0, touchAction: 'none' }}
          />
        </div>
        {/* Popisky */}
        <div style={{ position: 'relative', height: 16 }}>
          <span style={{ position: 'absolute', left: 0, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#7aa8cc' }}>{t('game.bcAxis')}</span>
          <span style={{ position: 'absolute', left: `${zeroPct}%`, transform: 'translateX(-50%)', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>0</span>
          <span style={{ position: 'absolute', right: 0, fontSize: 10, fontFamily: 'var(--font-mono)', color: '#d97757' }}>2025</span>
        </div>
      </div>

      {/* Ovládací řádek (návrh A) — steppery kolem pole pro přesný rok */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 6 }}>
        <button onClick={() => step(-10)} style={stepBtnStyle}>−10</button>
        <button onClick={() => step(-1)} style={stepBtnStyle}>−1</button>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          border: '1px solid var(--line-strong)', borderRadius: 9, background: 'var(--surface)',
        }}>
          <input
            type="text"
            inputMode="text"
            pattern="-?[0-9]*"
            value={inputValue}
            onChange={e => handleInput(e.target.value)}
            onBlur={() => setDraft(null)}
            placeholder={t('game.yearInput')}
            style={{
              width: 78, textAlign: 'right', border: 'none', background: 'transparent',
              fontFamily: 'var(--font-mono)', fontSize: 17, color: 'var(--ink)',
              outline: 'none', padding: '9px 0',
            }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', color: 'var(--ink-3)', textTransform: 'uppercase' }}>
            {value < 0 ? t('game.bcShort') : t('game.adShort')}
          </span>
        </div>
        <button onClick={() => step(1)} style={stepBtnStyle}>+1</button>
        <button onClick={() => step(10)} style={stepBtnStyle}>+10</button>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--ink-3)', textTransform: 'uppercase', textAlign: 'center' }}>
        {t('game.yearHint')}
      </div>
    </div>
  )
}

// ── Round result overlay ──────────────────────────────────
function RoundResult({ event, round, onNext, isLast }: {
  event: Event; round: ReturnType<typeof useGame>['lastRound']
  onNext: () => void; isLast: boolean
}) {
  const { t } = useTranslation()
  // Hooky musí být volané bezpodmínečně a ve stejném pořadí — early return až za nimi.
  const [tab, setTab] = useState<'score' | 'info'>('score')
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 640)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  if (!round) return null

  const yearDiffLabel = round.year_diff === 0 ? t('game.exactTip') : t('game.yearOff', { n: round.year_diff })
  const locPct = Math.round(round.location_score / 5)
  const yrPct = Math.round(round.year_score / 5)

  const nextBtn = (
    <button
      className="btn btn-accent"
      style={{ width: '100%', fontSize: 15, padding: '13px 0' }}
      onClick={onNext}
    >
      {isLast ? t('game.showTotal') : t('game.nextRound')}
    </button>
  )

  if (isMobile) {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(13,9,6,0.88)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'stretch',
        paddingTop: 'calc(var(--safe-top) + 48px)',
        zIndex: 20,
      }}>
        <div style={{
          background: 'var(--paper-50)',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', flex: 1, minHeight: 0,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
        }}>
          {/* Header — název + skóre */}
          <div style={{ padding: '12px 14px 10px', borderBottom: '0.5px solid var(--line)', flexShrink: 0 }}>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>{t('game.resultRound')}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, letterSpacing: '-0.01em', flex: 1, lineHeight: 1.2 }}>{eventTitle(event)}</div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--accent)', letterSpacing: '-0.03em', lineHeight: 1 }}>{round.round_score.toLocaleString(currentLocale())}<span style={{ fontSize: 15, marginLeft: 3 }}>{t('common.pts')}</span></div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>{t('game.outOf1000')}</div>
              </div>
            </div>
          </div>

          {/* Tab přepínač */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '0.5px solid var(--line)', flexShrink: 0 }}>
            {([['score', '🏆', t('game.tabScore')], ['info', '📖', t('game.tabInfo')]] as const).map(([key, icon, label]) => (
              <button key={key} onClick={() => setTab(key)}
                style={{ position: 'relative', padding: '9px 0', border: 'none', borderBottom: tab === key ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', fontSize: 12, fontWeight: tab === key ? 600 : 400, color: tab === key ? 'var(--accent)' : 'var(--ink-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <span style={{ fontSize: 13 }}>{icon}</span>{label}
                {key === 'info' && tab !== 'info' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }}/>}
              </button>
            ))}
          </div>

          {/* Obsah — bez scrollu, pevné výšky */}
          {tab === 'score' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
              {/* Mapa — roztažená přes dostupný prostor */}
              <div style={{ flex: 1, minHeight: 180, overflow: 'hidden', position: 'relative' }}>
                <ResultMap guessLat={round.guess_lat} guessLng={round.guess_lng} truthLat={event.lat} truthLng={event.lng} radiusKm={event.location_radius_km ?? 0}/>
              </div>
              {/* Skóre karty */}
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <ScoreCard label={t('game.location')} score={round.location_score} pct={locPct} sub={formatDistance(round.distance_km)}/>
                  <ScoreCard label={t('game.year')} score={round.year_score} pct={yrPct} sub={yearDiffLabel} highlight={round.year_diff === 0}/>
                </div>
                <div style={{ background: 'var(--paper-200)', borderRadius: 9, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div className="eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>{t('game.correctYear')}</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500 }}>{formatYear(event.year)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>{t('game.yourGuess')}</div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 500 }}>{formatYear(round.guess_year)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'info' && (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <InfoContent event={event}/>
            </div>
          )}

          {/* Tlačítko dole */}
          <div style={{ padding: `10px 14px`, paddingBottom: 'max(12px, env(safe-area-inset-bottom))', borderTop: '0.5px solid var(--line)', flexShrink: 0 }}>
            {nextBtn}
          </div>
        </div>
      </div>
    )
  }

  // Desktop — 2 sloupce
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,9,6,0.92)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: 20 }}>
      <div style={{ background: 'var(--paper-50)', borderRadius: 20, maxWidth: 860, width: '100%', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', maxHeight: 'calc(100dvh - 40px)' }}>
        {/* Levý — mapa + skóre */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)', overflow: 'auto' }}>
          <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
            <div className="eyebrow" style={{ marginBottom: 3 }}>{t('game.resultRound')}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, margin: 0 }}>{eventTitle(event)}</h2>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--accent)', letterSpacing: '-0.02em', lineHeight: 1 }}>{round.round_score.toLocaleString(currentLocale())}<span style={{ fontSize: 16, marginLeft: 3 }}>{t('common.pts')}</span></div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{t('game.outOf1000pts')}</div>
              </div>
            </div>
          </div>
          <div style={{ borderBottom: '1px solid var(--line)' }}>
            <ResultMap guessLat={round.guess_lat} guessLng={round.guess_lng} truthLat={event.lat} truthLng={event.lng} radiusKm={event.location_radius_km ?? 0}/>
          </div>
          <div style={{ padding: '16px 24px', flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <ScoreCard label={t('game.location')} score={round.location_score} pct={locPct} sub={formatDistance(round.distance_km)}/>
              <ScoreCard label={t('game.year')} score={round.year_score} pct={yrPct} sub={yearDiffLabel} highlight={round.year_diff === 0}/>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--ink-3)', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <span>{t('game.correctYearInline')} <strong style={{ color: 'var(--ink)' }}>{formatYear(event.year)}</strong></span>
              <span>{t('game.yourGuessInline')} <strong style={{ color: 'var(--ink)' }}>{formatYear(round.guess_year)}</strong></span>
            </div>
          </div>
          <div style={{ padding: '12px 24px 16px', borderTop: '1px solid var(--line)' }}>{nextBtn}</div>
        </div>
        {/* Pravý — info */}
        <div style={{ overflow: 'auto' }}><InfoContent event={event}/></div>
      </div>
    </div>
  )
}

// ── Score karta ───────────────────────────────────────────
function ScoreCard({ label, score, pct, sub, highlight }: { label: string; score: number; pct: number; sub: string; highlight?: boolean }) {
  const { t } = useTranslation()
  return (
    <div style={{ background: 'var(--paper-200)', borderRadius: 12, padding: '12px 14px' }}>
      <div className="eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 8 }}>
        {score.toLocaleString(currentLocale())}<span style={{ fontSize: 13, marginLeft: 2, color: 'var(--ink-3)' }}>{t('common.pts')}</span>
      </div>
      <div style={{ height: 3, background: 'rgba(42,31,23,0.12)', borderRadius: 999, overflow: 'hidden', marginBottom: 5 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: highlight ? '#1d6b3a' : 'var(--accent)', borderRadius: 999 }}/>
      </div>
      <div style={{ fontSize: 11, color: highlight ? '#1d6b3a' : 'var(--ink-3)' }}>{sub}</div>
    </div>
  )
}

// ── Sdílený obsah info ────────────────────────────────────
export function InfoContent({ event }: { event: Event }) {
  const { t } = useTranslation()

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {event.event_image_url && (
        <img src={event.event_image_url} alt={eventTitle(event)} style={{ width: '100%', height: 200, objectFit: 'cover', flexShrink: 0 }}/>
      )}
      <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 12, borderLeft: '3px solid var(--accent)' }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600 }}>📖 {t('game.aboutEvent')}</p>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 25, margin: 0, letterSpacing: '-0.01em', lineHeight: 1.15 }}>{eventTitle(event)}</h3>
        {event.description && (
          <p style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.75, margin: 0 }}>{eventDescription(event)}</p>
        )}
        {event.category && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', background: 'var(--paper-200)', padding: '3px 10px', borderRadius: 999, alignSelf: 'flex-start' }}>
            {event.category}
          </span>
        )}
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 4 }}>
          <StarRating eventId={event.id}/>
        </div>
      </div>
    </div>
  )
}

// ── Star rating ──────────────────────────────────────────
function StarRating({ eventId }: { eventId: string }) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState(0)
  const [hover, setHover] = useState(0)
  const [sent, setSent] = useState(false)

  async function handleRate(rating: number) {
    if (sent) return
    setSelected(rating)
    setSent(true)
    await addEventRating(eventId, rating)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '14px 0 4px' }}>
      <div className="eyebrow" style={{ fontSize: 9 }}>{t('game.ratePanorama')}</div>
      {sent ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1,2,3,4,5].map(i => (
              <span key={i} style={{ fontSize: 22, color: i <= selected ? '#d97757' : 'var(--line-strong)' }}>★</span>
            ))}
          </div>
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('game.thanks')}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 4 }}>
          {[1,2,3,4,5].map(i => (
            <button
              key={i}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              onClick={() => handleRate(i)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 28, padding: '2px 4px',
                color: i <= (hover || selected) ? '#d97757' : 'var(--paper-300)',
                transition: 'color 100ms, transform 100ms',
                transform: i <= hover ? 'scale(1.2)' : 'scale(1)',
                lineHeight: 1,
              }}
            >
              ★
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Helper komponenty ─────────────────────────────────────

// ── Loading / Error / Finished screens ───────────────────
function LoadingScreen() {
  const { t } = useTranslation()

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, background: '#0d0906' }}>
      <CompassLoader size={72}/>
      <p style={{ color: 'var(--paper-300)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.16em' }}>{t('game.loading')}</p>
    </div>
  )
}

function ErrorScreen({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  const { t } = useTranslation()

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32, background: '#0d0906' }}>
      <p style={{ color: 'var(--on-dark)', fontSize: 16 }}>{msg}</p>
      <button className="btn btn-accent" onClick={onRetry}>{t('game.retry')}</button>
    </div>
  )
}

function FinishedScreen({ totalScore, rounds, roundResults, events, userId, campaignStars, campaignTitle, campaignRewards, onCampaigns, onPlayAgain, onMenu }: {
  totalScore: number; rounds: number; roundResults: RoundResult[]; events: Event[]
  userId?: string; campaignStars?: number | null; campaignTitle?: string | null
  campaignRewards?: CampaignReward[]
  onCampaigns?: () => void; onPlayAgain: () => void; onMenu: () => void
}) {
  const { t } = useTranslation()
  const pct = Math.round((totalScore / (rounds * 1000)) * 100)
  const gainedXp = totalScore + XP_BONUS_GAME
  const isCampaign = !!onCampaigns

  // Kolik ≥950 zásahů přibylo touto hrou po kategoriích
  const catById = new Map(events.map(e => [e.id, e.category]))
  const gameHits: Record<string, number> = {}
  for (const r of roundResults) {
    if ((r.round_score ?? 0) >= 950) {
      const cat = catById.get(r.event_id)
      if (cat) gameHits[cat] = (gameHits[cat] ?? 0) + 1
    }
  }

  // ── Výsledek KAMPANĚ — tmavá „síň slávy" s hvězdami ──
  if (isCampaign) {
    const stars = campaignStars ?? 0
    const maxScore = maxScoreFor(rounds)
    const [t1, t2, t3] = starThresholds(rounds)
    const nextThreshold = stars === 0 ? t1 : stars === 1 ? t2 : stars === 2 ? t3 : null
    const toNext = nextThreshold ? nextThreshold - totalScore : 0

    return (
      <div style={{
        minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 22px', background: 'radial-gradient(circle at 50% 32%, #2e2519 0%, #17120c 70%)',
      }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
            color: '#f5ce8b', margin: '0 0 20px',
          }}>Kampaň dokončena</p>

          {/* Hvězdy */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 18 }}>
            {[0, 1, 2].map(i => {
              const on = stars > i
              return (
                <span key={i} style={{
                  fontSize: 52, lineHeight: 1,
                  color: on ? '#f5ce8b' : 'transparent',
                  WebkitTextStroke: on ? '0' : '2px rgba(245,206,139,0.35)',
                  filter: on ? 'drop-shadow(0 4px 14px rgba(245,206,139,0.55))' : 'none',
                }}>★</span>
              )
            })}
          </div>

          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: '#f6f0e6', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
            {campaignTitle}
          </h1>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, marginBottom: 22 }}>
            <span style={{ color: '#d97757' }}>{totalScore.toLocaleString(currentLocale())}</span>
            <span style={{ color: 'rgba(246,240,230,0.45)' }}> / {maxScore.toLocaleString(currentLocale())} b.</span>
          </div>

          {/* Kolik chybí do další hvězdy */}
          {nextThreshold && toNext > 0 && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 22,
              background: 'rgba(246,240,230,0.06)', border: '1px solid rgba(246,240,230,0.14)',
              borderRadius: 999, padding: '9px 16px', color: 'rgba(246,240,230,0.85)', fontSize: 13,
            }}>
              <span style={{ color: '#f5ce8b' }}>★</span>
              Ještě {toNext.toLocaleString(currentLocale())} b. do {stars + 1}. hvězdy
            </div>
          )}

          {/* Nově získané artefakty */}
          {campaignRewards && campaignRewards.length > 0 && (
            <div style={{
              background: 'rgba(245,206,139,0.09)', border: '1px solid rgba(245,206,139,0.28)',
              borderRadius: 16, padding: 14, marginBottom: 20, textAlign: 'left',
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: '#f5ce8b', marginBottom: 10,
              }}>{campaignRewards.length === 1 ? 'Nový artefakt' : 'Nové artefakty'}</div>
              {campaignRewards.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '5px 0' }}>
                  <span style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0, fontSize: 19,
                    background: RARITY_BG[r.rarity] ?? 'rgba(246,240,230,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundImage: r.icon_url ? `url(${r.icon_url})` : undefined,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                  }}>{r.icon_url ? '' : '🏺'}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 15, color: '#f6f0e6' }}>{r.name}</div>
                    {r.description && (
                      <div style={{ fontSize: 11.5, color: 'rgba(246,240,230,0.55)', marginTop: 1 }}>{r.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-accent" style={{ width: '100%', padding: 15, fontSize: 15.5 }} onClick={onCampaigns}>
            Zpět na kampaně
          </button>
          <button onClick={onPlayAgain} style={{
            background: 'none', border: 'none', cursor: 'pointer', marginTop: 14, padding: 6,
            color: 'rgba(246,240,230,0.5)', fontSize: 13.5,
          }}>Zkusit znovu na lepší skóre</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 22px', background: 'var(--paper-100)' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <p className="eyebrow" style={{ marginBottom: 12, textAlign: 'center' }}>{t('game.gameOver')}</p>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 68, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--accent)', textAlign: 'center' }}>
          {totalScore.toLocaleString(currentLocale())}
        </div>
        <p style={{ color: 'var(--ink-3)', margin: '6px 0 22px', fontFamily: 'var(--font-mono)', fontSize: 13, textAlign: 'center' }}>
          {t('game.accuracy', { pct })}
        </p>

        <GameEvaluation userId={userId} gainedXp={gainedXp} gameHits={gameHits}/>

        <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onMenu}>{t('game.menu')}</button>
          <button className="btn btn-accent" style={{ flex: 1 }} onClick={onPlayAgain}>{t('game.playAgain')}</button>
        </div>
      </div>
    </div>
  )
}

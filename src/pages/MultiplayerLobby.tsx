import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  createRoom, getRoom, getRoomByCode, joinRoom, leaveRoom, abandonRoom,
  getPlayers, startGame, subscribeToRoom, countMatchingEvents, getRoomPanoramas,
} from '@/lib/multiplayer'
import { preloadImage } from '@/lib/preload'
import { maintainMultiplayer } from '@/lib/supabase'
import type { MultiplayerRoom, MultiplayerPlayer, RoomSettings } from '@/lib/multiplayer'
import YearRange from '@/components/YearRange'
import { useIsMobile } from '@/hooks/useIsMobile'

const DEFAULT_SETTINGS: RoomSettings = {
  rounds: 5, time_limit: 60, categories: [], year_from: -3000, year_to: 2025, mode: 'classic',
}

const CATEGORIES = [
  { id: 'war', label: '⚔ Války' },
  { id: 'moments', label: '📜 Historické okamžiky' },
  { id: 'places', label: '🧭 Objevy míst' },
  { id: 'inventions', label: '💡 Vynálezy' },
  { id: 'art', label: '🎨 Umění' },
  { id: 'sports', label: '🏅 Sportovní okamžiky' },
  { id: 'mysteries', label: '🔮 Záhady a legendy' },
  { id: 'disasters', label: '🌋 Katastrofy' },
]

type Screen = 'menu' | 'join_code' | 'lobby'

export default function MultiplayerLobbyPage() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [screen, setScreen] = useState<Screen>('menu')
  const [room, setRoom] = useState<MultiplayerRoom | null>(null)
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([])
  const [settings, setSettings] = useState<RoomSettings>(DEFAULT_SETTINGS)
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matchingEvents, setMatchingEvents] = useState<number | null>(null)
  const isMobile = useIsMobile()
  const unsubRef = useRef<(() => void) | null>(null)
  // Když přecházíme do hry, NESMÍME hráče odhlásit z místnosti (unmount lobby)
  const enteringGameRef = useRef(false)

  const isHost = room?.host_id === user?.id
  const username = profile?.username ?? t('lobby.defaultPlayer')
  // Min. počet událostí: BR potřebuje aspoň 2, klasika počet kol
  const minEvents = settings.mode === 'battle_royale' ? 2 : settings.rounds

  // Pokud přišel s kódem v URL
  useEffect(() => {
    const code = searchParams.get('code')
    if (code) { setJoinCode(code); setScreen('join_code') }
  }, [])

  // Úklid MP místností — nespoléhá na pg_cron (viz migrace 038). Throttlováno na 10 min.
  useEffect(() => { maintainMultiplayer() }, [])

  // Počet odpovídajících událostí
  useEffect(() => {
    const t = setTimeout(async () => {
      const count = await countMatchingEvents(settings)
      setMatchingEvents(count)
    }, 400)
    return () => clearTimeout(t)
  }, [settings.categories, settings.year_from, settings.year_to])

  // Cleanup při odchodu
  useEffect(() => {
    return () => {
      unsubRef.current?.()
      if (room && user && !isHost && !enteringGameRef.current) leaveRoom(room.id, user.id)
    }
  }, [room, user, isHost])

  // Pojistka proti nespolehlivému Realtime: v lobby pravidelně přečti seznam
  // hráčů i stav místnosti, aby hostitel viděl nově připojené a aby všichni
  // přešli do hry i bez doručené realtime události o startu.
  useEffect(() => {
    if (screen !== 'lobby' || !room) return
    let alive = true
    const roomId = room.id
    const refetch = async () => {
      const [ps, r] = await Promise.all([getPlayers(roomId), getRoom(roomId)])
      if (!alive) return
      setPlayers(ps)
      if (r) {
        setRoom(r)
        if (r.status === 'playing') { enteringGameRef.current = true; navigate(`/multiplayer/game/${roomId}`) }
      }
    }
    refetch()
    const iv = setInterval(refetch, 2000)
    return () => { alive = false; clearInterval(iv) }
  }, [screen, room?.id])

  function subscribeToRoomUpdates(roomId: string) {
    unsubRef.current?.()
    unsubRef.current = subscribeToRoom(
      roomId,
      (updatedRoom) => {
        setRoom(updatedRoom)
        // Hra začala → přejdi do herní stránky
        if (updatedRoom.status === 'playing') {
          enteringGameRef.current = true
          navigate(`/multiplayer/game/${updatedRoom.id}`)
        }
      },
      (updatedPlayers) => setPlayers(updatedPlayers),
      () => {},
    )
  }

  async function handleCreate() {
    if (!user) return
    setLoading(true); setError(null)
    const { room: newRoom, error: err } = await createRoom(user.id, username, settings)
    if (err || !newRoom) { setError(err?.message ?? 'Chyba'); setLoading(false); return }
    setRoom(newRoom)
    const initialPlayers = await getPlayers(newRoom.id)
    setPlayers(initialPlayers)
    subscribeToRoomUpdates(newRoom.id)
    setScreen('lobby')
    setLoading(false)
  }

  async function handleJoin() {
    if (!user || !joinCode.trim()) return
    setLoading(true); setError(null)
    const foundRoom = await getRoomByCode(joinCode.trim())
    if (!foundRoom) { setError(t('lobby.errNotFound')); setLoading(false); return }
    if (foundRoom.status !== 'waiting') { setError(t('lobby.errInProgress')); setLoading(false); return }
    const currentPlayers = await getPlayers(foundRoom.id)
    if (currentPlayers.length >= 12) { setError(t('lobby.errFull')); setLoading(false); return }

    const { error: err } = await joinRoom(foundRoom.id, user.id, username)
    if (err) { setError(err.message); setLoading(false); return }

    setRoom(foundRoom)
    const updatedPlayers = await getPlayers(foundRoom.id)
    setPlayers(updatedPlayers)
    subscribeToRoomUpdates(foundRoom.id)
    setScreen('lobby')
    setLoading(false)
  }

  async function handleStart() {
    if (!room || !isHost) return
    setLoading(true); setError(null)
    const { error: err } = await startGame(room)
    if (err) { setError(err.message); setLoading(false); return }
    setLoading(false)
    // Náskok: začni stahovat panorama 1. kola ještě před přechodem do hry
    getRoomPanoramas(room.id).then(panos => preloadImage(panos.find(p => p.round_number === 1)?.panorama_url)).catch(() => {})
    // Naviguj rovnou — nespoléhej na realtime událost (ta nemusí dorazit).
    // Ostatní hráči přejdou přes realtime, případně přes polling stavu místnosti.
    enteringGameRef.current = true
    navigate(`/multiplayer/game/${room.id}`)
  }

  function handleSettingChange<K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  // Odchod z lobby — host navíc místnost ukončí, ať nezůstane osiřelá
  async function handleLeave() {
    if (room && user) {
      if (isHost) await abandonRoom(room.id)
      await leaveRoom(room.id, user.id)
    }
    navigate('/menu')
  }

  function toggleCategory(id: string) {
    setSettings(prev => ({
      ...prev,
      categories: prev.categories.includes(id)
        ? prev.categories.filter(c => c !== id)
        : [...prev.categories, id],
    }))
  }

  // ── Menu (vstup) ──────────────────────────────────────
  if (screen === 'menu') {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', paddingTop: 'var(--safe-top)', paddingBottom: 'max(24px, var(--safe-bottom))' }}>
        <div style={{ maxWidth: 460, margin: '0 auto', padding: '16px 18px' }}>
          <MpBack onClick={() => navigate('/menu')} label={t('daily.menu')}/>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', color: 'var(--accent-deep)', textTransform: 'uppercase', margin: '18px 0 8px' }}>{t('menu.multiplayer')}</p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, color: 'var(--ink)', margin: '0 0 26px', letterSpacing: '-0.02em', lineHeight: 1.05 }}>{t('menu.multiplayerSub2')}</h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={handleCreate} disabled={loading} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: 17, cursor: 'pointer', textAlign: 'left', width: '100%',
              background: 'rgba(217,119,87,0.09)', border: '1px solid var(--accent)', borderRadius: 18,
            }}>
              <span style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 23, color: '#fff', background: 'linear-gradient(150deg,#d97757,#b85a3e)' }}>＋</span>
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{t('lobby.create')}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{t('lobby.createSub')}</div>
              </div>
            </button>

            <button onClick={() => setScreen('join_code')} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: 17, cursor: 'pointer', textAlign: 'left', width: '100%',
              background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18,
            }}>
              <span style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'var(--accent)', background: 'var(--paper-300)' }}>🔗</span>
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 16, color: 'var(--ink)' }}>{t('lobby.join')}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{t('lobby.joinSub')}</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Zadání kódu ────────────────────────────────────────
  if (screen === 'join_code') {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', paddingTop: 'var(--safe-top)', paddingBottom: 'max(24px, var(--safe-bottom))' }}>
        <div style={{ maxWidth: 400, margin: '0 auto', padding: '16px 18px' }}>
          <MpBack onClick={() => setScreen('menu')} label={t('lobby.back')}/>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 27, color: 'var(--ink)', margin: '18px 0 6px', letterSpacing: '-0.01em' }}>{t('lobby.joinTitle')}</h2>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '0 0 24px' }}>{t('lobby.joinHint')}</p>

          {/* 5-box kód */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 9, justifyContent: 'center' }}>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  width: 46, height: 58, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--surface)', fontFamily: 'var(--font-mono)', fontSize: 24, color: 'var(--ink)',
                  border: `2px solid ${i === joinCode.length ? 'var(--accent)' : 'var(--line-strong)'}`,
                }}>{joinCode[i] ?? ''}</div>
              ))}
            </div>
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
              maxLength={5} autoFocus inputMode="text" aria-label={t('lobby.codePlaceholder')}
              onKeyDown={e => e.key === 'Enter' && joinCode.length === 5 && handleJoin()}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'text', border: 'none', background: 'transparent' }}
            />
          </div>
          <p style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--ink-3)', margin: '0 0 18px' }}>{t('lobby.codePlaceholder')}</p>

          {error && <p style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>⚠ {error}</p>}

          <button disabled={joinCode.length !== 5 || loading} onClick={handleJoin} style={{
            width: '100%', padding: 14, borderRadius: 14, border: 'none', cursor: 'pointer',
            background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15,
            opacity: joinCode.length !== 5 || loading ? 0.55 : 1,
          }}>
            {loading ? t('lobby.joining') : t('lobby.joinBtn')}
          </button>
        </div>
      </div>
    )
  }

  // ── Lobby ──────────────────────────────────────────────

  // ── Sdílené komponenty ─────────────────────────────────
  const PlayerList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {players.map(p => {
        const me = p.user_id === user?.id
        let hash = 0; for (let i = 0; i < p.username.length; i++) hash = (hash * 31 + p.username.charCodeAt(i)) >>> 0
        const hue = hash % 360
        return (
          <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 14, background: me ? 'rgba(217,119,87,0.07)' : 'var(--surface)', border: `1px solid ${me ? 'var(--accent)' : 'var(--line)'}` }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: `linear-gradient(150deg, hsl(${hue} 35% 78%), hsl(${hue} 40% 62%))`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: `hsl(${hue} 45% 30%)`, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14 }}>
              {p.username[0].toUpperCase()}
            </div>
            <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-sans)', fontWeight: me ? 600 : 500, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {p.username}
              {me && <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 6 }}>{t('lobby.you')}</span>}
            </span>
            {p.is_host
              ? <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', background: 'rgba(217,119,87,0.12)', color: 'var(--accent-deep)', padding: '3px 9px', borderRadius: 999 }}>{t('lobby.host')}</span>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--success, #5c9468)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            }
          </div>
        )
      })}
    </div>
  )

  // Segmentovaný přepínač (počet kol, časový limit) — sladěný s „Klasickou hrou"
  const Segmented = <T extends number>({ value, options, onChange }: {
    value: T; options: readonly { v: T; label: string }[]; onChange: (v: T) => void
  }) => (
    <div style={{ display: 'flex', background: 'var(--paper-200)', borderRadius: 12, padding: 4, gap: 4 }}>
      {options.map(o => {
        const on = value === o.v
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            flex: 1, border: 'none', padding: '9px 0', borderRadius: 9, cursor: 'pointer',
            fontFamily: 'var(--font-serif)', fontSize: 15,
            background: on ? 'var(--paper-50)' : 'transparent',
            color: on ? 'var(--ink)' : 'var(--ink-2)', fontWeight: on ? 500 : 400,
            boxShadow: on ? '0 1px 4px rgba(42,31,23,0.08)' : 'none',
          }}>{o.label}</button>
        )
      })}
    </div>
  )

  const SettingsPanel = () => {
    const isBR = settings.mode === 'battle_royale'
    return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Herní režim — výrazný výběr karet */}
      <div>
        <MpLabel>{t('lobby.modeLabel')}</MpLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <ModeCard
            icon="🏛" title={t('lobby.modeClassic')} desc={t('lobby.modeClassicDesc')}
            on={!isBR} onClick={() => handleSettingChange('mode', 'classic')}/>
          <ModeCard
            icon="⚔" title={t('lobby.modeBR')} desc={t('lobby.brHint')}
            on={isBR} onClick={() => handleSettingChange('mode', 'battle_royale')}/>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isBR ? '1fr' : '1fr 1fr', gap: 18 }}>
        {!isBR && (
        <div>
          <MpLabel>{t('pregame.rounds')}</MpLabel>
          <Segmented value={settings.rounds}
            options={[{ v: 3, label: '3' }, { v: 5, label: '5' }, { v: 10, label: '10' }]}
            onChange={v => handleSettingChange('rounds', v)}/>
        </div>
        )}
        <div>
          <MpLabel>{t('lobby.timeLabel')}</MpLabel>
          <Segmented value={settings.time_limit}
            options={[{ v: 30, label: '30s' }, { v: 60, label: '60s' }, { v: 90, label: '90s' }, { v: 120, label: '120s' }]}
            onChange={v => handleSettingChange('time_limit', v)}/>
        </div>
      </div>

      <div>
        <MpLabel>{t('lobby.categoriesLabel')}</MpLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map(cat => {
            const on = settings.categories.includes(cat.id)
            return (
              <button key={cat.id} onClick={() => toggleCategory(cat.id)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 999,
                fontSize: 13, cursor: 'pointer',
                border: `1px solid ${on ? 'var(--accent)' : 'var(--line-strong)'}`,
                background: on ? 'var(--accent)' : 'transparent',
                color: on ? '#fff' : 'var(--ink-2)',
              }}>{t('cat.' + cat.id)}</button>
            )
          })}
        </div>
      </div>

      <div>
        <MpLabel>{t('lobby.yearSpread')}</MpLabel>
        <YearRange
          from={settings.year_from}
          to={settings.year_to}
          onFrom={v => handleSettingChange('year_from', v)}
          onTo={v => handleSettingChange('year_to', v)}
        />
        {matchingEvents !== null && (
          <p style={{ fontSize: 12, color: matchingEvents >= minEvents ? 'var(--ink-3)' : 'var(--danger)', margin: '8px 0 0', fontFamily: 'var(--font-mono)' }}>
            {matchingEvents >= minEvents ? '✓' : '⚠'} {t('lobby.matching', { count: matchingEvents })}
            {matchingEvents < minEvents && t('lobby.minRounds', { min: minEvents })}
          </p>
        )}
      </div>
    </div>
    )
  }

  const StartButton = () => isHost ? (
    <button className="btn btn-accent" style={{ width: '100%', fontSize: 15, padding: '14px' }}
      disabled={loading || players.length < 1 || (matchingEvents !== null && matchingEvents < minEvents)}
      onClick={handleStart}>
      {loading ? t('lobby.starting') : t('lobby.startGame', { count: players.length })}
    </button>
  ) : (
    <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)', padding: '10px 0' }}>
      {t('lobby.waiting')}
    </div>
  )

  // ── Desktop — kartový layout (sladěno s „Klasickou hrou") ──
  if (!isMobile) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', paddingTop: 'var(--safe-top)', paddingBottom: 'max(24px, var(--safe-bottom))' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 32px 0' }}>
          {/* Hlavička */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
            <MpBack onClick={handleLeave} label={t('lobby.leave')}/>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent-deep)', marginBottom: 3 }}>{t('menu.multiplayer')}</div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 34, color: 'var(--ink)', letterSpacing: '-0.015em', margin: 0, lineHeight: 1 }}>{t('lobby.customize')}</h1>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.55fr) minmax(340px,1fr)', gap: 24, alignItems: 'start' }}>
            {/* Levý sloupec — nastavení */}
            <div>
              <MpCard>
                {isHost ? SettingsPanel() : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 16 }}>
                    <span className="spinner"/>
                    <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>{t('lobby.hostSetsUp')}</p>
                  </div>
                )}
                {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}
              </MpCard>
            </div>

            {/* Pravý sloupec — kód + hráči + start (sticky) */}
            <div style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Kód místnosti */}
              <MpCard>
                <MpLabel>{t('lobby.roomCode')}</MpLabel>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 44, fontWeight: 700, letterSpacing: '0.18em', color: 'var(--ink)', lineHeight: 1, marginBottom: 14 }}>
                  {room?.code}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(room?.code ?? '')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--paper-200)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '8px 16px', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  {t('lobby.copy')}
                </button>
              </MpCard>

              {/* Hráči */}
              <MpCard>
                <MpLabel>Hráči · {players.length} / 12</MpLabel>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}><PlayerList/></div>
              </MpCard>

              <StartButton/>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Mobil — původní layout ────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'calc(14px + env(safe-area-inset-top,0px))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <MpBack onClick={handleLeave} label={t('lobby.leave')}/>
          <div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.16em', color: 'var(--accent-deep)', textTransform: 'uppercase', margin: '0 0 2px' }}>{t('lobby.roomCode')}</p>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--ink)' }}>{room?.code}</span>
          </div>
        </div>
        <button onClick={() => navigator.clipboard.writeText(room?.code ?? '')} style={{ background: 'var(--paper-200)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '8px 14px', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer' }}>{t('lobby.copy')}</button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', maxWidth: 640, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: 0 }}>Hráči ({players.length} / 12)</p>
          </div>
          <div style={{ padding: '8px 12px' }}><PlayerList/></div>
        </div>
        {isHost && <div className="card" style={{ padding: '16px' }}><p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 14px' }}>{t('lobby.gameSettings')}</p>{SettingsPanel()}</div>}
        {!isHost && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--ink-3)', fontSize: 14 }}>{t('lobby.hostSetsUp')}</div>}
        {error && <div className="alert alert-error">{error}</div>}
      </div>

      <div style={{ padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--line)' }}>
        <StartButton/>
      </div>
    </div>
  )
}

function MpBack({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} aria-label={label} style={{
      width: 36, height: 36, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
      background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
    }}>←</button>
  )
}

// ── Sladěno s „Klasickou hrou" ────────────────────────────
function MpCard({ children, padding = 20 }: { children: React.ReactNode; padding?: number }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding, overflow: 'hidden' }}>
      {children}
    </div>
  )
}

function MpLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 10 }}>
      {children}
    </div>
  )
}

function ModeCard({ icon, title, desc, on, onClick }: { icon: string; title: string; desc: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left', cursor: 'pointer', padding: '14px 15px', borderRadius: 14,
      border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line-strong)'}`,
      background: on ? 'rgba(217,119,87,0.08)' : 'var(--surface)',
      display: 'flex', flexDirection: 'column', gap: 6, transition: 'border-color 150ms, background 150ms',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)', fontWeight: 500 }}>{title}</span>
        {on && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 15 }}>✓</span>}
      </div>
      <span style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>{desc}</span>
    </button>
  )
}

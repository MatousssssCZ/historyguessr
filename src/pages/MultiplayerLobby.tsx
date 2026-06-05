import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  createRoom, getRoomByCode, joinRoom, leaveRoom,
  getPlayers, startGame, subscribeToRoom, countMatchingEvents,
} from '@/lib/multiplayer'
import type { MultiplayerRoom, MultiplayerPlayer, RoomSettings } from '@/lib/multiplayer'
import BackButton from '@/components/BackButton'
import YearRange from '@/components/YearRange'

const DEFAULT_SETTINGS: RoomSettings = {
  rounds: 5, time_limit: 60, categories: [], year_from: -3000, year_to: 2025,
}

const CATEGORIES = [
  { id: 'war', label: '⚔ Bitvy' },
  { id: 'culture', label: '🏛 Kultura' },
  { id: 'science', label: '🔬 Věda' },
  { id: 'politics', label: '🏛 Politika' },
  { id: 'religion', label: '✝ Náboženství' },
  { id: 'exploration', label: '🧭 Objevy' },
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
  const unsubRef = useRef<(() => void) | null>(null)

  const isHost = room?.host_id === user?.id
  const username = profile?.username ?? t('lobby.defaultPlayer')

  // Pokud přišel s kódem v URL
  useEffect(() => {
    const code = searchParams.get('code')
    if (code) { setJoinCode(code); setScreen('join_code') }
  }, [])

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
      if (room && user && !isHost) leaveRoom(room.id, user.id)
    }
  }, [room, user, isHost])

  // Pojistka proti nespolehlivému Realtime: v lobby pravidelně přečti seznam
  // hráčů, aby hostitel viděl nově připojené i bez doručené realtime události.
  useEffect(() => {
    if (screen !== 'lobby' || !room) return
    let alive = true
    const refetch = async () => {
      const ps = await getPlayers(room.id)
      if (alive) setPlayers(ps)
    }
    refetch()
    const iv = setInterval(refetch, 2500)
    return () => { alive = false; clearInterval(iv) }
  }, [screen, room])

  function subscribeToRoomUpdates(roomId: string) {
    unsubRef.current?.()
    unsubRef.current = subscribeToRoom(
      roomId,
      (updatedRoom) => {
        setRoom(updatedRoom)
        // Hra začala → přejdi do herní stránky
        if (updatedRoom.status === 'playing') {
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
    // Navigace proběhne přes subscribeToRoom callback
  }

  function handleSettingChange<K extends keyof RoomSettings>(key: K, value: RoomSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  function toggleCategory(id: string) {
    setSettings(prev => ({
      ...prev,
      categories: prev.categories.includes(id)
        ? prev.categories.filter(c => c !== id)
        : [...prev.categories, id],
    }))
  }

  // ── Menu ──────────────────────────────────────────────
  if (screen === 'menu') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--feature-bg)', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, margin: '0 auto', width: '100%' }}>
          <div style={{ marginBottom: 24 }}>
            <BackButton onClick={() => navigate('/menu')} label={t('daily.menu')} />
          </div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8 }}>{t('menu.multiplayer')}</p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--feature-fg)', margin: '0 0 32px', letterSpacing: '-0.02em' }}>{t('menu.multiplayerSub2')}</h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={handleCreate}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', background: 'rgba(217,119,87,0.1)', border: '1px solid rgba(217,119,87,0.25)', borderRadius: 16, cursor: 'pointer', textAlign: 'left', width: '100%' }}
            >
              <span style={{ fontSize: 28 }}>🎮</span>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--feature-fg)', lineHeight: 1 }}>{t('lobby.create')}</div>
                <div style={{ fontSize: 12, color: 'var(--feature-fg3)', marginTop: 4 }}>{t('lobby.createSub')}</div>
              </div>
            </button>

            <button
              onClick={() => setScreen('join_code')}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid var(--feature-line)', borderRadius: 16, cursor: 'pointer', textAlign: 'left', width: '100%' }}
            >
              <span style={{ fontSize: 28 }}>🔗</span>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--feature-fg)', lineHeight: 1 }}>{t('lobby.join')}</div>
                <div style={{ fontSize: 12, color: 'var(--feature-fg3)', marginTop: 4 }}>{t('lobby.joinSub')}</div>
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
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--feature-bg)', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 400, margin: '0 auto', width: '100%' }}>
          <div style={{ marginBottom: 24 }}>
            <BackButton onClick={() => setScreen('menu')} label={t('lobby.back')} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--feature-fg)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>{t('lobby.joinTitle')}</h2>
          <p style={{ fontSize: 14, color: 'var(--feature-fg3)', margin: '0 0 28px' }}>{t('lobby.joinHint')}</p>

          <input
            className="input"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 5))}
            placeholder={t('lobby.codePlaceholder')}
            maxLength={5}
            style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 28, letterSpacing: '0.3em', marginBottom: 12, background: 'var(--feature-chip)', color: 'var(--feature-fg)', border: '1px solid rgba(255,255,255,0.15)', padding: '16px' }}
            onKeyDown={e => e.key === 'Enter' && joinCode.length === 5 && handleJoin()}
          />

          {error && <p style={{ fontSize: 13, color: '#e74c3c', marginBottom: 12 }}>⚠ {error}</p>}

          <button
            className="btn btn-accent"
            style={{ width: '100%', padding: '14px', fontSize: 15 }}
            disabled={joinCode.length !== 5 || loading}
            onClick={handleJoin}
          >
            {loading ? t('lobby.joining') : t('lobby.joinBtn')}
          </button>
        </div>
      </div>
    )
  }

  // ── Lobby ──────────────────────────────────────────────
  const isMobile = window.innerWidth < 768

  // ── Sdílené komponenty ─────────────────────────────────
  const PlayerList = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {players.map(p => (
        <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 9, background: p.user_id === user?.id ? 'rgba(217,119,87,0.06)' : 'rgba(255,255,255,0.04)' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.is_host ? 'rgba(217,119,87,0.2)' : 'var(--feature-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: p.is_host ? 'var(--accent-soft)' : 'var(--feature-fg2)', flexShrink: 0 }}>
            {p.username[0].toUpperCase()}
          </div>
          <span style={{ flex: 1, fontSize: 14, color: 'var(--feature-fg)', fontWeight: p.user_id === user?.id ? 500 : 400 }}>
            {p.username}
            {p.user_id === user?.id && <span style={{ fontSize: 10, color: 'var(--feature-fg3)', marginLeft: 6 }}>{t('lobby.you')}</span>}
          </span>
          {p.is_host
            ? <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', background: 'rgba(217,119,87,0.15)', color: 'var(--accent-soft)', padding: '2px 8px', borderRadius: 999, border: '0.5px solid rgba(217,119,87,0.3)' }}>{t('lobby.host')}</span>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#27ae60" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          }
        </div>
      ))}
    </div>
  )

  const SettingsPanel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label className="label">{t('pregame.rounds')}</label>
          <select className="input" style={{ padding: '8px 12px' }} value={settings.rounds} onChange={e => handleSettingChange('rounds', Number(e.target.value))}>
            <option value={3}>{t('lobby.rounds3')}</option>
            <option value={5}>{t('lobby.rounds5')}</option>
            <option value={10}>{t('lobby.rounds10')}</option>
          </select>
        </div>
        <div>
          <label className="label">{t('lobby.timeLabel')}</label>
          <select className="input" style={{ padding: '8px 12px' }} value={settings.time_limit} onChange={e => handleSettingChange('time_limit', Number(e.target.value))}>
            <option value={30}>{t('lobby.sec30')}</option>
            <option value={60}>{t('lobby.sec60')}</option>
            <option value={90}>{t('lobby.sec90')}</option>
            <option value={120}>{t('lobby.sec120')}</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">{t('lobby.categoriesLabel')}</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {CATEGORIES.map(cat => {
            const active = settings.categories.includes(cat.id)
            return (
              <button key={cat.id} onClick={() => toggleCategory(cat.id)}
                style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: active ? '1px solid rgba(217,119,87,0.4)' : '0.5px solid var(--line-strong)', background: active ? 'rgba(217,119,87,0.1)' : 'var(--paper-100)', color: active ? 'var(--accent-deep)' : 'var(--ink-3)', transition: 'all 150ms' }}>
                {t('cat.' + cat.id)}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <label className="label">{t('lobby.yearSpread')}</label>
        <YearRange
          from={settings.year_from}
          to={settings.year_to}
          onFrom={v => handleSettingChange('year_from', v)}
          onTo={v => handleSettingChange('year_to', v)}
        />
        {matchingEvents !== null && (
          <p style={{ fontSize: 12, color: matchingEvents >= settings.rounds ? 'var(--ink-3)' : '#c0392b', margin: '6px 0 0', fontFamily: 'var(--font-mono)' }}>
            {matchingEvents >= settings.rounds ? '✓' : '⚠'} {t('lobby.matching', { count: matchingEvents })}
            {matchingEvents < settings.rounds && t('lobby.minRounds', { min: settings.rounds })}
          </p>
        )}
      </div>
    </div>
  )

  const StartButton = () => isHost ? (
    <button className="btn btn-accent" style={{ width: '100%', fontSize: 15, padding: '14px' }}
      disabled={loading || players.length < 1 || (matchingEvents !== null && matchingEvents < settings.rounds)}
      onClick={handleStart}>
      {loading ? t('lobby.starting') : t('lobby.startGame', { count: players.length })}
    </button>
  ) : (
    <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)', padding: '10px 0' }}>
      {t('lobby.waiting')}
    </div>
  )

  // ── Desktop — split layout ────────────────────────────
  if (!isMobile) {
    return (
      <div style={{ height: '100dvh', display: 'grid', gridTemplateColumns: '420px 1fr', background: 'var(--feature-bg)', overflow: 'hidden' }}>

        {/* Levá — tmavá: kód + hráči */}
        <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--feature-chip)', position: 'relative', overflow: 'hidden' }}>
          {/* Dekorativní pozadí */}
          <svg style={{ position: 'absolute', inset: 0, opacity: 0.04, pointerEvents: 'none' }} width="100%" height="100%">
            <defs><pattern id="mp-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M 36 0 L 0 0 0 36" fill="none" stroke="#f5f1e8" strokeWidth="0.5"/></pattern></defs>
            <rect width="100%" height="100%" fill="url(#mp-grid)"/>
          </svg>
          <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,119,87,0.08) 0%, transparent 70%)', pointerEvents: 'none' }}/>

          {/* Kód místnosti */}
          <div style={{ padding: '40px 36px 32px', position: 'relative' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 10px' }}>{t('lobby.roomCode')}</p>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 52, fontWeight: 700, letterSpacing: '0.22em', color: 'var(--feature-fg)', lineHeight: 1, marginBottom: 16 }}>
              {room?.code}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(room?.code ?? '')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--feature-chip)', border: '0.5px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '7px 16px', fontSize: 12, color: 'var(--feature-fg2)', cursor: 'pointer', transition: 'all 160ms' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--feature-line)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--feature-chip)')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Kopírovat kód
            </button>
          </div>

          {/* Hráči */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 36px', position: 'relative' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--feature-fg3)', textTransform: 'uppercase', margin: '0 0 10px' }}>
              Hráči {players.length} / 12
            </p>
            <PlayerList/>
          </div>

          {/* Odejít */}
          <div style={{ padding: '24px 36px', position: 'relative' }}>
            <BackButton
              onClick={async () => { if (room && user) await leaveRoom(room.id, user.id); navigate('/menu') }}
              label={t('lobby.leave')}
            />
          </div>
        </div>

        {/* Pravá — světlá: nastavení + start */}
        <div style={{ background: 'var(--paper-100)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '40px 48px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.16em', color: 'var(--ink-3)', textTransform: 'uppercase', margin: '0 0 4px' }}>{t('lobby.gameSettings')}</p>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, margin: '0 0 32px', letterSpacing: '-0.01em' }}>{t('lobby.customize')}</h2>
            {isHost ? SettingsPanel() : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 16 }}>
                <span className="spinner"/>
                <p style={{ color: 'var(--ink-3)', fontSize: 14 }}>{t('lobby.hostSetsUp')}</p>
              </div>
            )}
            {error && <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>}
          </div>
          <div style={{ padding: '24px 48px', borderTop: '1px solid var(--line)' }}>
            <StartButton/>
          </div>
        </div>
      </div>
    )
  }

  // ── Mobil — původní layout ────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'var(--feature-bg)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'calc(14px + env(safe-area-inset-top,0px))' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 2px' }}>{t('lobby.roomCode')}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 600, letterSpacing: '0.2em', color: 'var(--feature-fg)' }}>{room?.code}</span>
            <button onClick={() => navigator.clipboard.writeText(room?.code ?? '')} style={{ background: 'var(--feature-line)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--feature-fg2)', cursor: 'pointer' }}>{t('lobby.copy')}</button>
          </div>
        </div>
        <BackButton onClick={async () => { if (room && user) await leaveRoom(room.id, user.id); navigate('/menu') }} label={t('lobby.leave')} />
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

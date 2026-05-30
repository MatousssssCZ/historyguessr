import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  createRoom, getRoomByCode, joinRoom, leaveRoom,
  getPlayers, startGame, subscribeToRoom, countMatchingEvents,
} from '@/lib/multiplayer'
import type { MultiplayerRoom, MultiplayerPlayer, RoomSettings } from '@/lib/multiplayer'

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
  const username = profile?.username ?? 'Hráč'

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
    if (!foundRoom) { setError('Místnost nenalezena. Zkontroluj kód.'); setLoading(false); return }
    if (foundRoom.status !== 'waiting') { setError('Tato hra již probíhá nebo skončila.'); setLoading(false); return }
    const currentPlayers = await getPlayers(foundRoom.id)
    if (currentPlayers.length >= 12) { setError('Místnost je plná (max 12 hráčů).'); setLoading(false); return }

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
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--sepia-900)', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 420, margin: '0 auto', width: '100%' }}>
          <button onClick={() => navigate('/menu')} style={{ background: 'none', border: 'none', color: 'rgba(245,241,232,0.4)', cursor: 'pointer', fontSize: 13, marginBottom: 24, padding: 0 }}>← Menu</button>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.18em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8 }}>Více hráčů</p>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 36, color: 'var(--paper-50)', margin: '0 0 32px', letterSpacing: '-0.02em' }}>Zahraj si s přáteli</h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={handleCreate}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', background: 'rgba(217,119,87,0.1)', border: '1px solid rgba(217,119,87,0.25)', borderRadius: 16, cursor: 'pointer', textAlign: 'left', width: '100%' }}
            >
              <span style={{ fontSize: 28 }}>🎮</span>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--paper-50)', lineHeight: 1 }}>Založit hru</div>
                <div style={{ fontSize: 12, color: 'rgba(245,241,232,0.4)', marginTop: 4 }}>Vytvoř místnost a pozvi přátele</div>
              </div>
            </button>

            <button
              onClick={() => setScreen('join_code')}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 16, cursor: 'pointer', textAlign: 'left', width: '100%' }}
            >
              <span style={{ fontSize: 28 }}>🔗</span>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--paper-50)', lineHeight: 1 }}>Připojit se</div>
                <div style={{ fontSize: 12, color: 'rgba(245,241,232,0.4)', marginTop: 4 }}>Zadej pětimístný kód</div>
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
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--sepia-900)', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 400, margin: '0 auto', width: '100%' }}>
          <button onClick={() => setScreen('menu')} style={{ background: 'none', border: 'none', color: 'rgba(245,241,232,0.4)', cursor: 'pointer', fontSize: 13, marginBottom: 24, padding: 0 }}>← Zpět</button>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 28, color: 'var(--paper-50)', margin: '0 0 8px', letterSpacing: '-0.02em' }}>Připojit se do hry</h2>
          <p style={{ fontSize: 14, color: 'rgba(245,241,232,0.4)', margin: '0 0 28px' }}>Zadej pětimístný kód od přítele.</p>

          <input
            className="input"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 5))}
            placeholder="NAPŘ. A7K3P"
            maxLength={5}
            style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 28, letterSpacing: '0.3em', marginBottom: 12, background: 'rgba(255,255,255,0.06)', color: 'var(--paper-50)', border: '1px solid rgba(255,255,255,0.15)', padding: '16px' }}
            onKeyDown={e => e.key === 'Enter' && joinCode.length === 5 && handleJoin()}
          />

          {error && <p style={{ fontSize: 13, color: '#e74c3c', marginBottom: 12 }}>⚠ {error}</p>}

          <button
            className="btn btn-accent"
            style={{ width: '100%', padding: '14px', fontSize: 15 }}
            disabled={joinCode.length !== 5 || loading}
            onClick={handleJoin}
          >
            {loading ? 'Připojuji…' : 'Připojit se →'}
          </button>
        </div>
      </div>
    )
  }

  // ── Lobby ──────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ background: 'var(--sepia-900)', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'calc(14px + env(safe-area-inset-top,0px))' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.18em', color: 'var(--accent)', textTransform: 'uppercase', margin: '0 0 2px' }}>Kód místnosti</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 600, letterSpacing: '0.2em', color: 'var(--paper-50)' }}>{room?.code}</span>
            <button
              onClick={() => navigator.clipboard.writeText(room?.code ?? '')}
              style={{ background: 'rgba(255,255,255,0.08)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'rgba(245,241,232,0.6)', cursor: 'pointer' }}
            >
              Kopírovat
            </button>
          </div>
        </div>
        <button
          onClick={async () => { if (room && user) await leaveRoom(room.id, user.id); navigate('/menu') }}
          style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '7px 14px', fontSize: 13, color: 'rgba(245,241,232,0.5)', cursor: 'pointer' }}
        >
          Odejít
        </button>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', maxWidth: 640, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Hráči */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: 0 }}>Hráči ({players.length} / 12)</p>
          </div>
          <div style={{ padding: '8px 0' }}>
            {players.map(p => (
              <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', background: p.user_id === user?.id ? 'rgba(217,119,87,0.05)' : 'transparent' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: p.is_host ? 'rgba(217,119,87,0.15)' : 'var(--paper-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: p.is_host ? 'var(--accent-deep)' : 'var(--ink-2)' }}>
                  {p.username[0].toUpperCase()}
                </div>
                <span style={{ flex: 1, fontSize: 14, fontWeight: p.user_id === user?.id ? 500 : 400 }}>
                  {p.username}
                  {p.user_id === user?.id && <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 6 }}>ty</span>}
                </span>
                {p.is_host
                  ? <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(217,119,87,0.1)', color: 'var(--accent-deep)', padding: '2px 8px', borderRadius: 999, border: '0.5px solid rgba(217,119,87,0.25)' }}>hostitel</span>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#27ae60" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                }
              </div>
            ))}
          </div>
        </div>

        {/* Nastavení (jen host) */}
        {isHost && (
          <div className="card" style={{ padding: '16px' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 14px' }}>Nastavení hry</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label className="label">Počet kol</label>
                <select className="input" style={{ padding: '8px 12px' }} value={settings.rounds} onChange={e => handleSettingChange('rounds', Number(e.target.value))}>
                  <option value={3}>3 kola</option>
                  <option value={5}>5 kol</option>
                  <option value={10}>10 kol</option>
                </select>
              </div>
              <div>
                <label className="label">Čas na kolo</label>
                <select className="input" style={{ padding: '8px 12px' }} value={settings.time_limit} onChange={e => handleSettingChange('time_limit', Number(e.target.value))}>
                  <option value={30}>30 sekund</option>
                  <option value={60}>60 sekund</option>
                  <option value={90}>90 sekund</option>
                  <option value={120}>120 sekund</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="label">Kategorie (prázdno = vše)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CATEGORIES.map(cat => {
                  const active = settings.categories.includes(cat.id)
                  return (
                    <button key={cat.id} onClick={() => toggleCategory(cat.id)}
                      style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer', border: active ? '1px solid rgba(217,119,87,0.4)' : '0.5px solid var(--line-strong)', background: active ? 'rgba(217,119,87,0.1)' : 'var(--paper-100)', color: active ? 'var(--accent-deep)' : 'var(--ink-3)', transition: 'all 150ms' }}
                    >
                      {cat.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="label">Věkový rozptyl událostí</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="number" className="input" value={settings.year_from} onChange={e => handleSettingChange('year_from', Number(e.target.value))} style={{ width: 90, padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 13 }}/>
                <span style={{ color: 'var(--ink-3)' }}>–</span>
                <input type="number" className="input" value={settings.year_to} onChange={e => handleSettingChange('year_to', Number(e.target.value))} style={{ width: 90, padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 13 }}/>
              </div>
              {matchingEvents !== null && (
                <p style={{ fontSize: 12, color: matchingEvents >= settings.rounds ? 'var(--ink-3)' : '#c0392b', margin: '6px 0 0', fontFamily: 'var(--font-mono)' }}>
                  {matchingEvents >= settings.rounds ? '✓' : '⚠'} {matchingEvents} událostí odpovídá kritériím
                  {matchingEvents < settings.rounds && ` (potřebuješ min. ${settings.rounds})`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Info pro hráče */}
        {!isHost && (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--ink-3)', fontSize: 14 }}>
            Hostitel nastavuje hru…
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--line)' }}>
        {isHost ? (
          <button
            className="btn btn-accent"
            style={{ width: '100%', fontSize: 15, padding: '14px' }}
            disabled={loading || players.length < 1 || (matchingEvents !== null && matchingEvents < settings.rounds)}
            onClick={handleStart}
          >
            {loading ? 'Spouštím…' : `Spustit hru (${players.length} hráč${players.length === 1 ? '' : players.length < 5 ? 'i' : 'ů'}) →`}
          </button>
        ) : (
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)', padding: '10px 0' }}>
            Čekáme až hostitel spustí hru…
          </div>
        )}
      </div>
    </div>
  )
}

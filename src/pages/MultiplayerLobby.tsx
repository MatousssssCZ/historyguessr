import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  createRoom, getRoom, getRoomByCode, joinRoom, leaveRoom,
  getPlayers, startGame, subscribeToRoom, countMatchingEvents, getRoomPanoramas, updateRoomSettings,
  kickPlayer, setReady, leaveMultiplayerRoom,
} from '@/lib/multiplayer'
import { getFriendsForInvite, sendGameInvite, type FriendInvite } from '@/lib/invites'
import { preloadImage } from '@/lib/preload'
import { maintainMultiplayer } from '@/lib/supabase'
import type { MultiplayerRoom, MultiplayerPlayer, RoomSettings } from '@/lib/multiplayer'
import YearRange from '@/components/YearRange'
import { SettingSection, SubLabel, Segmented, CategoryChips, EventCountPill } from '@/components/GameSettings'
import { useIsMobile } from '@/hooks/useIsMobile'
import { PageHeader } from '@/components/ui/Page'
import Icon from '@/components/Icon'

const DEFAULT_SETTINGS: RoomSettings = {
  rounds: 5, time_limit: 60, categories: [], year_from: -3000, year_to: 2025, mode: 'classic',
}

type Screen = 'menu' | 'join_code' | 'lobby'

// Rovnost pro polling — aby se stav neaktualizoval (a hlavička neproblikávala),
// když se z DB vrátí totožná data.
function sameRoom(a: MultiplayerRoom | null, b: MultiplayerRoom): boolean {
  return !!a && a.id === b.id && a.code === b.code && a.status === b.status
    && a.current_round === b.current_round && a.updated_at === b.updated_at
}
function samePlayers(a: MultiplayerPlayer[], b: MultiplayerPlayer[]): boolean {
  if (a.length !== b.length) return false
  return a.every((p, i) => {
    const q = b[i]
    return q && p.user_id === q.user_id && p.total_score === q.total_score
      && p.is_host === q.is_host && p.ready === q.ready && p.username === q.username
  })
}

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
  const [inviteCopied, setInviteCopied] = useState(false)
  const [tab, setTab] = useState<'settings' | 'lobby'>('settings')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [inviteFriends, setInviteFriends] = useState<FriendInvite[]>([])

  // Pozvánka do místnosti — odkaz s předvyplněným kódem (?code=), přes Web Share
  // API nebo do schránky (fallback).
  async function shareInvite() {
    const code = room?.code
    if (!code) return
    const url = `${location.origin}/multiplayer/lobby?code=${code}`
    const text = t('lobby.inviteText', { code })
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> }
    if (nav.share) {
      try { await nav.share({ title: 'HistoryGuesser', text, url }) } catch { /* zrušeno uživatelem */ }
    } else {
      try { await navigator.clipboard.writeText(`${text}\n${url}`); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2000) } catch { /* ignore */ }
    }
  }
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

  // Aktuální hodnoty pro cleanup při ODMOUNTOVÁNÍ (viz efekt „leave on unmount").
  // Bez refů by cleanup běžel při každé změně room/isHost a odhlásil hráče z místnosti.
  const roomRef = useRef(room); roomRef.current = room
  const isHostRef = useRef(isHost); isHostRef.current = isHost
  const userRef = useRef(user); userRef.current = user

  // Pozvánka z odkazu (?code=): předvyplň kód a rovnou se připoj (auto-join),
  // ať příjemce skončí přímo v lobby. Když selže (plná/rozjetá), zůstane na
  // obrazovce s kódem + chybou.
  const autoJoinRef = useRef(false)
  const sawSelfRef = useRef(false)   // viděl jsem se v seznamu? (detekce vyhození)
  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) return
    setJoinCode(code)
    setScreen('join_code')
    if (user && !autoJoinRef.current) { autoJoinRef.current = true; handleJoin(code) }
  }, [user])

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

  // Host: ulož změny nastavení do místnosti (debounce) → použije je start hry
  // a přes realtime je uvidí i připojení hráči.
  useEffect(() => {
    if (!isHost || !room || screen !== 'lobby') return
    const tmr = setTimeout(() => { updateRoomSettings(room.id, settings).catch(() => {}) }, 400)
    return () => clearTimeout(tmr)
  }, [settings, isHost, room?.id, screen])

  // Cleanup při odchodu
  // Leave místnosti JEN při skutečném odmountování (odchod z lobby), ne při každé
  // změně room/isHost. Aktuální hodnoty přes refy. (Bez [] deps to vyhazovalo
  // připojené hráče při každém realtime/poll updatu místnosti.)
  useEffect(() => {
    return () => {
      unsubRef.current?.()
      const r = roomRef.current
      if (r && userRef.current && !isHostRef.current && !enteringGameRef.current) leaveRoom(r.id, userRef.current.id)
    }
  }, [])

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
      // Aktualizuj stav jen při reálné změně — jinak polling každé 2 s
      // zbytečně překresluje hlavičku (kód místnosti pak problikává).
      setPlayers(prev => samePlayers(prev, ps) ? prev : ps)
      // Vyhození: byl jsem v seznamu a už nejsem → zpět do menu
      if (user && ps.some(p => p.user_id === user.id)) sawSelfRef.current = true
      else if (sawSelfRef.current && !enteringGameRef.current) { enteringGameRef.current = true; navigate('/menu'); return }
      if (r) {
        setRoom(prev => sameRoom(prev, r) ? prev : r)
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

  async function handleJoin(codeArg?: string) {
    const code = (typeof codeArg === 'string' ? codeArg : joinCode).trim()
    if (!user || !code) return
    setLoading(true); setError(null)
    const foundRoom = await getRoomByCode(code)
    if (!foundRoom) { setError(t('lobby.errNotFound')); setLoading(false); return }
    if (foundRoom.status !== 'waiting') { setError(t('lobby.errInProgress')); setLoading(false); return }
    const currentPlayers = await getPlayers(foundRoom.id)
    if (currentPlayers.length >= 12) { setError(t('lobby.errFull')); setLoading(false); return }

    const { error: err } = await joinRoom(foundRoom.id, user.id, username)
    if (err) {
      const m = err.message || ''
      setError(m.includes('room_full') ? t('lobby.errFull')
        : m.includes('room_not_open') ? t('lobby.errInProgress')
        : t('lobby.errJoin'))
      setLoading(false); return
    }

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

  // Odchod z lobby — hostitelství přejde na dalšího (leave_multiplayer_room),
  // ať místnost nezůstane osiřelá. enteringGameRef zabrání dvojímu leave z unmountu.
  const copyText = async (txt: string) => {
    if (!txt) return
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { /* ignore */ }
  }

  function handleLeave() { setConfirmLeave(true) }
  async function doLeave() {
    setConfirmLeave(false)
    if (room && user) { enteringGameRef.current = true; await leaveMultiplayerRoom(room.id).catch(() => {}) }
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
          <PageHeader eyebrow={t('menu.multiplayer')} title={t('menu.multiplayerSub2')} onBack={() => navigate('/menu')}/>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button onClick={handleCreate} disabled={loading} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: 17, cursor: 'pointer', textAlign: 'left', width: '100%',
              background: 'rgba(217,119,87,0.09)', border: '1px solid var(--accent)', borderRadius: 18,
            }}>
              <span style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: 'linear-gradient(150deg,#d97757,#b85a3e)' }}><Icon name="plus" size={24}/></span>
              <div>
                <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{t('lobby.create')}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3 }}>{t('lobby.createSub')}</div>
              </div>
            </button>

            <button onClick={() => setScreen('join_code')} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: 17, cursor: 'pointer', textAlign: 'left', width: '100%',
              background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18,
            }}>
              <span style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', background: 'var(--paper-300)' }}><Icon name="link" size={22}/></span>
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

          <button disabled={joinCode.length !== 5 || loading} onClick={() => handleJoin()} style={{
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
  // Elegantní ukazatel kapacity místnosti (max 12 hráčů).
  const CapacityHeader = () => {
    const n = players.length
    const full = n >= 12
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{t('lobby.playersTitle')}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: full ? 'var(--accent-deep)' : 'var(--ink-2)' }}>
            <span style={{ fontWeight: 700, color: full ? 'var(--accent)' : 'var(--ink)' }}>{n}</span> / 12{full && ` · ${t('lobby.full')}`}
          </span>
        </div>
        <div style={{ height: 4, borderRadius: 999, background: 'var(--paper-300)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, (n / 12) * 100)}%`, borderRadius: 999, background: full ? 'var(--accent)' : 'var(--ink-3)', transition: 'width 200ms' }}/>
        </div>
      </div>
    )
  }

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
              : (<>
                  {p.ready && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--success-deep, #3f7a4d)', background: 'rgba(76,122,80,.14)', padding: '4px 9px', borderRadius: 999 }}>✓ {t('lobby.ready')}</span>}
                  {isHost && !me && (
                    <button onClick={() => room && kickPlayer(room.id, p.user_id)} aria-label="×" style={{ width: 26, height: 26, flexShrink: 0, borderRadius: '50%', border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--danger, #c0392b)', cursor: 'pointer', fontSize: 15, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  )}
                </>)
            }
          </div>
        )
      })}
    </div>
  )

  const SettingsPanel = () => {
    const isBR = settings.mode === 'battle_royale'
    return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Herní režim — výrazný výběr karet */}
      <SettingSection label={t('lobby.modeLabel')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <ModeCard
            icon={<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9 12 4l9 5"/><path d="M4 9h16"/><path d="M6 9v8M10 9v8M14 9v8M18 9v8"/><path d="M3 20h18"/></svg>}
            title={t('lobby.modeClassic')} desc={t('lobby.modeClassicDesc')}
            on={!isBR} onClick={() => handleSettingChange('mode', 'classic')}/>
          <ModeCard
            icon={<Icon name="swords" size={19}/>}
            title={t('lobby.modeBR')} desc={t('lobby.brHint')}
            on={isBR} onClick={() => handleSettingChange('mode', 'battle_royale')}/>
        </div>
      </SettingSection>

      {/* BR: hraje se do posledního — počet kol se nenastavuje */}
      {isBR && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 13px', borderRadius: 12, background: 'rgba(217,119,87,0.09)', fontSize: 12.5, color: 'var(--accent-deep)' }}>
          <Icon name="bug" size={15}/> {t('lobby.brNote')}
        </div>
      )}

      {/* Počet kol + čas na kolo — každé přes celý řádek */}
      <SettingSection>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!isBR && (
            <div>
              <SubLabel>{t('pregame.rounds')}</SubLabel>
              <Segmented value={settings.rounds}
                options={[{ v: 3, label: '3' }, { v: 5, label: '5' }, { v: 10, label: '10' }]}
                onChange={v => handleSettingChange('rounds', v)}/>
            </div>
          )}
          <div>
            <SubLabel>{t('lobby.timeLabel')}</SubLabel>
            <Segmented value={settings.time_limit}
              options={[{ v: 30, label: '30s' }, { v: 60, label: '60s' }, { v: 90, label: '90s' }, { v: 120, label: '120s' }]}
              onChange={v => handleSettingChange('time_limit', v)}/>
          </div>
        </div>
      </SettingSection>

      <SettingSection label={t('lobby.categoriesLabel')}>
        <CategoryChips selected={settings.categories} onToggle={toggleCategory}/>
      </SettingSection>

      <SettingSection label={t('lobby.yearSpread')}>
        <YearRange
          from={settings.year_from}
          to={settings.year_to}
          onFrom={v => handleSettingChange('year_from', v)}
          onTo={v => handleSettingChange('year_to', v)}
        />
        {matchingEvents !== null && (
          <EventCountPill ok={matchingEvents >= minEvents}>
            {matchingEvents >= minEvents ? '✓' : '⚠'} {t('lobby.matching', { count: matchingEvents })}
            {matchingEvents < minEvents ? t('lobby.minRounds', { min: minEvents }) : ''}
          </EventCountPill>
        )}
      </SettingSection>
    </div>
    )
  }

  const StartButton = () => {
    if (isHost) {
      const others = players.filter(p => !p.is_host)
      const readyCount = others.filter(p => p.ready).length
      return (
        <>
          {others.length > 0 && <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.06em', color: readyCount === others.length ? 'var(--success-deep, #3f7a4d)' : 'var(--ink-3)', marginBottom: 8 }}>{t('lobby.readyCount', { ready: readyCount, total: others.length })}</div>}
          <button className="btn btn-accent" style={{ width: '100%', fontSize: 15, padding: '14px' }}
            disabled={loading || players.length < 1 || (matchingEvents !== null && matchingEvents < minEvents)}
            onClick={handleStart}>
            {loading ? t('lobby.starting') : t('lobby.startGame', { count: players.length })}
          </button>
        </>
      )
    }
    const myReady = !!players.find(p => p.user_id === user?.id)?.ready
    return (
      <button onClick={() => room && setReady(room.id, !myReady)} style={{
        width: '100%', padding: 14, borderRadius: 14, cursor: 'pointer',
        border: myReady ? '0' : '1.5px solid var(--accent)',
        background: myReady ? 'var(--success, #5c9468)' : 'transparent',
        color: myReady ? '#fff' : 'var(--accent)',
        fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 15,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}>{myReady ? <>✓ {t('lobby.ready')}</> : t('lobby.notReady')}</button>
    )
  }

  const openInvite = async () => {
    setInviteOpen(true)
    if (room) { try { setInviteFriends(await getFriendsForInvite(room.id)) } catch { setInviteFriends([]) } }
  }
  const invitePozvat = async (friendId: string) => {
    if (!room) return
    setInviteFriends(prev => prev.map(f => f.id === friendId ? { ...f, state: 'pending' } : f))
    const { error } = await sendGameInvite(room.id, friendId)
    if (error) setInviteFriends(prev => prev.map(f => f.id === friendId ? { ...f, state: 'none' } : f))
  }

  const sheetRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 12px', borderRadius: 13, background: 'var(--paper-200)', border: 'none', cursor: 'pointer', textAlign: 'left', marginBottom: 8 }
  const inviteSheet = inviteOpen ? (
    <div style={{ position: 'fixed', inset: 0, zIndex: 8000, background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
      {/* Hlavička přes celou šířku + zavírací křížek */}
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 'calc(env(safe-area-inset-top,0px) + 14px) 18px 12px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)' }}>{t('lobby.sheetTitle')}</div>
        <button onClick={() => setInviteOpen(false)} aria-label={t('common.close')} style={{ width: 36, height: 36, flexShrink: 0, borderRadius: '50%', border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px calc(18px + env(safe-area-inset-bottom,0px))', maxWidth: 480, width: '100%', margin: '0 auto' }}>

        <button onClick={() => { shareInvite() }} style={sheetRow}>
          <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg></span>
          <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{t('lobby.invite')}</span>
        </button>
        <button onClick={() => copyText(room?.code ?? '')} style={{ ...sheetRow, marginBottom: 16 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'var(--paper-300)', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>
          <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13.5, color: 'var(--ink)' }}>{t('lobby.copyCode')} <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}>{room?.code}</span></span>
        </button>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.14em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>{t('lobby.friendsLabel')}</div>
        {inviteFriends.length === 0 && <div style={{ fontSize: 13, color: 'var(--ink-3)', padding: '6px 2px' }}>{t('lobby.noFriends')}</div>}
        {inviteFriends.map(f => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 2px' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'var(--paper-300)', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12 }}>{f.username.charAt(0).toUpperCase()}</div>
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.username}</span>
            {f.state === 'in_room'
              ? <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{t('lobby.inRoom')}</span>
              : f.state === 'pending'
                ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: 'var(--success-deep, #3f7a4d)', background: 'rgba(76,122,80,.14)', padding: '5px 11px', borderRadius: 999 }}>✓ {t('lobby.invited')}</span>
                : <button onClick={() => invitePozvat(f.id)} style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 0, padding: '6px 14px', borderRadius: 999, cursor: 'pointer' }}>{t('lobby.pozvat')}</button>}
          </div>
        ))}
      </div>
    </div>
  ) : null

  // Toast po zkopírování
  const copyToast = (
    <div aria-live="polite" style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(env(safe-area-inset-bottom,0px) + 22px)', zIndex: 9000, display: 'flex', justifyContent: 'center', pointerEvents: 'none', opacity: copied ? 1 : 0, transform: copied ? 'translateY(0)' : 'translateY(8px)', transition: 'opacity 180ms, transform 180ms' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--sepia-900, #2a1f17)', color: '#FBF7F0', padding: '10px 16px', borderRadius: 999, fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, boxShadow: '0 6px 20px rgba(20,17,13,.35)' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5 10 17.5 19 7"/></svg>
        {t('lobby.copied')}
      </div>
    </div>
  )

  // Potvrzení opuštění lobby / hry
  const leaveConfirm = confirmLeave ? (
    <div onClick={() => setConfirmLeave(false)} style={{ position: 'fixed', inset: 0, zIndex: 9100, background: 'rgba(20,17,13,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 360, background: 'var(--surface)', borderRadius: 20, padding: '22px 22px 18px', boxShadow: '0 12px 40px rgba(20,17,13,.4)' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 21, color: 'var(--ink)', marginBottom: 8 }}>{t(room?.status === 'playing' ? 'lobby.leaveGameConfirm' : 'lobby.leaveLobbyConfirm')}</div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 20 }}>{t('lobby.leaveConfirmDesc')}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setConfirmLeave(false)} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>{t('lobby.stay')}</button>
          <button onClick={doLeave} style={{ flex: 1, padding: 12, borderRadius: 12, border: 0, background: 'var(--danger, #c0392b)', color: '#fff', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>{t('lobby.leaveBtn')}</button>
        </div>
      </div>
    </div>
  ) : null

  const overlays = <>{inviteSheet}{copyToast}{leaveConfirm}</>

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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    onClick={() => copyText(room?.code ?? '')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--paper-200)', border: '1px solid var(--line-strong)', borderRadius: 10, padding: '8px 16px', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    {t('lobby.copy')}
                  </button>
                  <button
                    onClick={openInvite}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 10, padding: '8px 16px', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12, color: '#fff', cursor: 'pointer' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
                    {inviteCopied ? t('lobby.inviteCopied') : t('lobby.invite')}
                  </button>
                </div>
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
        {overlays}
      </div>
    )
  }

  // ── Mobil — přepínač Nastavení hry / Lobby ────────────
  // Read-only souhrn nastavení pro připojené hráče (bere aktuální nastavení místnosti)
  const rs = room?.settings ?? settings
  const isBRs = rs.mode === 'battle_royale'
  const settingsSummary = [
    isBRs ? t('lobby.modeBR') : t('lobby.modeClassic'),
    isBRs ? null : `${t('pregame.rounds')}: ${rs.rounds}`,
    `${t('lobby.timeLabel')}: ${rs.time_limit} s`,
    `${t('lobby.categoriesLabel')}: ${rs.categories?.length ? rs.categories.length : t('lobby.catsAll')}`,
  ].filter(Boolean).join(' · ')
  const tabBtn = (key: 'settings' | 'lobby', label: React.ReactNode) => {
    const on = tab === key
    return (
      <button onClick={() => setTab(key)} style={{
        flex: 1, padding: '10px 0', border: 0, borderRadius: 9, cursor: 'pointer',
        fontFamily: 'var(--font-sans)', fontWeight: on ? 700 : 600, fontSize: 12.5,
        background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)',
        boxShadow: on ? '0 1px 4px rgba(60,45,30,.18)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>{label}</button>
    )
  }
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--paper-200)', display: 'flex', flexDirection: 'column' }}>
      {/* Tmavá hlavička */}
      <header style={{ background: '#1C1813', color: '#FBF7F0', padding: '12px 16px', paddingTop: 'calc(12px + env(safe-area-inset-top,0px))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <button onClick={handleLeave} aria-label={t('lobby.leave')} style={{ width: 32, height: 32, flexShrink: 0, borderRadius: '50%', border: '1px solid rgba(251,247,240,.25)', background: 'transparent', color: '#FBF7F0', cursor: 'pointer', fontSize: 16 }}>←</button>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.18em', color: '#E9A183', textTransform: 'uppercase', margin: '0 0 1px' }}>{t('lobby.roomCode')}</p>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, letterSpacing: '0.2em' }}>{room?.code}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
          <button onClick={() => copyText(room?.code ?? '')} aria-label={t('lobby.copy')} style={{ width: 34, height: 34, borderRadius: 10, border: 0, background: 'rgba(251,247,240,.1)', color: '#FBF7F0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button onClick={openInvite} style={{ background: 'var(--accent)', border: 0, borderRadius: 10, padding: '0 14px', height: 34, display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12, color: '#fff', cursor: 'pointer' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
            {inviteCopied ? t('lobby.inviteCopied') : t('lobby.invite')}
          </button>
        </div>
      </header>

      {/* Přepínač Nastavení / Lobby */}
      <div style={{ maxWidth: 640, margin: '0 auto', width: '100%', padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--paper-300)', borderRadius: 12 }}>
          {tabBtn('settings', t('lobby.gameSettings'))}
          {tabBtn('lobby', <>{t('lobby.tabLobby')} <span style={{ background: 'var(--accent)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 999 }}>{players.length}</span></>)}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', maxWidth: 640, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {tab === 'settings' ? (
          isHost ? SettingsPanel() : (
            <div className="card" style={{ padding: '16px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '0 0 12px' }}>{t('lobby.gameSettings')}</p>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink-2)', margin: 0 }}>{settingsSummary}</p>
              <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: '12px 0 0' }}>{t('lobby.hostSetsUp')}</p>
            </div>
          )
        ) : (
          <>
            <CapacityHeader/>
            <PlayerList/>
            {players.length < 12 && (
              <button onClick={openInvite} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 13, border: '1.5px dashed var(--line-strong)', borderRadius: 14, background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                <Icon name="friends" size={16}/> {t('lobby.invite')}
              </button>
            )}
          </>
        )}
        {error && <div className="alert alert-error">{error}</div>}
      </div>

      <div style={{ padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', background: 'var(--surface)', borderTop: '1px solid var(--line)' }}>
        <StartButton/>
      </div>
      {overlays}
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

function ModeCard({ icon, title, desc, on, onClick }: { icon: React.ReactNode; title: string; desc: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      textAlign: 'left', cursor: 'pointer', padding: '14px 15px', borderRadius: 14,
      border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line-strong)'}`,
      background: on ? 'rgba(217,119,87,0.08)' : 'var(--surface)',
      display: 'flex', flexDirection: 'column', gap: 6, transition: 'border-color 150ms, background 150ms',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'flex', color: on ? 'var(--accent)' : 'var(--ink-2)' }}>{icon}</span>
        <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, color: 'var(--ink)', fontWeight: 500 }}>{title}</span>
        {on && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 15 }}>✓</span>}
      </div>
      <span style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>{desc}</span>
    </button>
  )
}

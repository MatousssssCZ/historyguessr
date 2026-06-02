import { supabase, addXp } from '@/lib/supabase'
import type { Event } from '@/types/database'

// ── Typy ─────────────────────────────────────────────────

export interface RoomSettings {
  rounds: number
  time_limit: number
  categories: string[]
  year_from: number
  year_to: number
}

export interface MultiplayerRoom {
  id: string
  code: string
  host_id: string
  status: 'waiting' | 'playing' | 'finished'
  current_round: number
  settings: RoomSettings
  created_at: string
  updated_at: string
}

export interface MultiplayerPlayer {
  room_id: string
  user_id: string
  username: string
  total_score: number
  is_host: boolean
  joined_at: string
}

export interface MultiplayerRound {
  room_id: string
  round_number: number
  event_id: string
  started_at: string | null
  events?: Event
}

export interface MultiplayerAnswer {
  room_id: string
  round_number: number
  user_id: string
  guess_lat: number
  guess_lng: number
  guess_year: number
  location_score: number
  year_score: number
  round_score: number
  submitted_at: string
  profiles?: { username: string | null }
}

// ── Generování kódu ───────────────────────────────────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode(): string {
  let code = ''
  const buf = new Uint8Array(5)
  crypto.getRandomValues(buf)
  for (const b of buf) code += CODE_CHARS[b % CODE_CHARS.length]
  return code
}

// ── Room CRUD ─────────────────────────────────────────────

export async function createRoom(
  userId: string,
  username: string,
  settings: RoomSettings,
): Promise<{ room: MultiplayerRoom | null; error: Error | null }> {
  // Zkus až 5x vygenerovat unikátní kód
  for (let i = 0; i < 5; i++) {
    const code = generateCode()
    const { data, error } = await supabase
      .from('multiplayer_rooms')
      .insert({ code, host_id: userId, settings })
      .select()
      .single()

    if (!error && data) {
      // Přidej hostitele jako hráče
      await supabase.from('multiplayer_players').insert({
        room_id: data.id, user_id: userId, username, is_host: true,
      })
      return { room: data as MultiplayerRoom, error: null }
    }
    // Kód byl obsazený — zkus znovu
    if (error?.code !== '23505') return { room: null, error: error as Error }
  }
  return { room: null, error: new Error('Nepodařilo se vygenerovat kód místnosti') }
}

export async function getRoomByCode(code: string): Promise<MultiplayerRoom | null> {
  const { data } = await supabase
    .from('multiplayer_rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()
  return data ?? null
}

export async function joinRoom(
  roomId: string,
  userId: string,
  username: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('multiplayer_players').upsert({
    room_id: roomId, user_id: userId, username, is_host: false,
  })
  return { error: error as Error | null }
}

export async function leaveRoom(roomId: string, userId: string) {
  await supabase.from('multiplayer_players')
    .delete().eq('room_id', roomId).eq('user_id', userId)
}

export async function getPlayers(roomId: string): Promise<MultiplayerPlayer[]> {
  const { data } = await supabase
    .from('multiplayer_players')
    .select('*')
    .eq('room_id', roomId)
    .order('joined_at')
  return (data ?? []) as MultiplayerPlayer[]
}

export async function countMatchingEvents(
  settings: Pick<RoomSettings, 'categories' | 'year_from' | 'year_to'>,
): Promise<number> {
  let q = supabase.from('events').select('id', { count: 'exact', head: true }).eq('published', true)
  if (settings.categories.length > 0) q = q.in('category', settings.categories)
  q = q.gte('year', settings.year_from).lte('year', settings.year_to)
  const { count } = await q
  return count ?? 0
}

// ── Herní flow ────────────────────────────────────────────

export async function startGame(
  room: MultiplayerRoom,
): Promise<{ error: Error | null }> {
  const { settings } = room
  const COUNTDOWN_MS = 3000

  // Načti náhodné události podle nastavení
  let q = supabase.from('events').select('id').eq('published', true)
  if (settings.categories.length > 0) q = q.in('category', settings.categories)
  q = q.gte('year', settings.year_from).lte('year', settings.year_to).limit(settings.rounds * 6)
  const { data: eventsData } = await q
  if (!eventsData || eventsData.length < settings.rounds) {
    return { error: new Error('Není dostatek událostí pro daná kritéria') }
  }

  // Fisher-Yates shuffle
  const pool = [...eventsData]
  for (let i = pool.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1); crypto.getRandomValues(buf)
    const j = buf[0] % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const selected = pool.slice(0, settings.rounds)

  // Vytvoř záznamy kol
  const startedAt = new Date(Date.now() + COUNTDOWN_MS).toISOString()
  const rounds = selected.map((e, i) => ({
    room_id: room.id,
    round_number: i + 1,
    event_id: e.id,
    started_at: i === 0 ? startedAt : null, // první kolo začne za 3s, ostatní se nastaví postupně
  }))

  const { error: roundsError } = await supabase.from('multiplayer_rounds').insert(rounds)
  if (roundsError) return { error: roundsError as Error }

  // Spusť hru
  const { error } = await supabase
    .from('multiplayer_rooms')
    .update({ status: 'playing', current_round: 1, updated_at: new Date().toISOString() })
    .eq('id', room.id)

  return { error: error as Error | null }
}

export async function getRound(
  roomId: string,
  roundNumber: number,
): Promise<MultiplayerRound | null> {
  const { data } = await supabase
    .from('multiplayer_rounds')
    .select('*, events(*)')
    .eq('room_id', roomId)
    .eq('round_number', roundNumber)
    .single()
  return data ?? null
}

export async function startNextRound(
  roomId: string,
  nextRoundNumber: number,
  totalRounds: number,
): Promise<{ error: Error | null }> {
  const COUNTDOWN_MS = 3000

  if (nextRoundNumber > totalRounds) {
    // Konec hry
    const { error } = await supabase
      .from('multiplayer_rooms')
      .update({ status: 'finished', updated_at: new Date().toISOString() })
      .eq('id', roomId)
    return { error: error as Error | null }
  }

  // Nastav started_at pro další kolo
  const startedAt = new Date(Date.now() + COUNTDOWN_MS).toISOString()
  await supabase
    .from('multiplayer_rounds')
    .update({ started_at: startedAt })
    .eq('room_id', roomId)
    .eq('round_number', nextRoundNumber)

  // Aktualizuj current_round
  const { error } = await supabase
    .from('multiplayer_rooms')
    .update({ current_round: nextRoundNumber, updated_at: new Date().toISOString() })
    .eq('id', roomId)

  return { error: error as Error | null }
}

/**
 * Časově řízený, idempotentní posun kola — může volat kterýkoli hráč.
 * Primárně přes RPC (zámek řádku v DB). Když RPC ještě není nasazená,
 * spadne to na starou host-only logiku jako pojistka.
 */
export async function advanceRound(
  roomId: string,
  expectedRound: number,
  totalRounds: number,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc('advance_multiplayer_round', {
    p_room_id: roomId,
    p_expected_round: expectedRound,
  })
  if (error) {
    // Fallback (RPC chybí) — staré chování přes přímý zápis
    return startNextRound(roomId, expectedRound + 1, totalRounds)
  }
  return { error: null }
}

// ── Odpovědi ──────────────────────────────────────────────

export async function submitAnswer(
  roomId: string,
  roundNumber: number,
  userId: string,
  answer: {
    guess_lat: number; guess_lng: number; guess_year: number
    location_score: number; year_score: number; round_score: number
  },
): Promise<{ error: Error | null }> {
  // Ulož odpověď
  const { error } = await supabase.from('multiplayer_answers').upsert({
    room_id: roomId, round_number: roundNumber, user_id: userId, ...answer,
  })
  if (error) return { error: error as Error }

  // Aktualizuj celkové skóre hráče — atomicky přes RPC
  const { error: rpcError } = await supabase.rpc('increment_multiplayer_score', {
    p_room_id: roomId, p_user_id: userId, p_score: answer.round_score,
  })

  // Fallback pokud RPC v DB neexistuje — read-modify-write (přičti, ne přepiš)
  if (rpcError) {
    const { data: player } = await supabase
      .from('multiplayer_players')
      .select('total_score')
      .eq('room_id', roomId).eq('user_id', userId)
      .single()

    await supabase.from('multiplayer_players')
      .update({ total_score: (player?.total_score ?? 0) + answer.round_score })
      .eq('room_id', roomId).eq('user_id', userId)
  }

  // XP za kolo v multiplayeru
  await addXp(userId, answer.round_score)

  return { error: null }
}

export async function updatePlayerTotalScore(
  roomId: string,
  userId: string,
  addScore: number,
) {
  const { data: player } = await supabase
    .from('multiplayer_players')
    .select('total_score')
    .eq('room_id', roomId).eq('user_id', userId)
    .single()
  if (!player) return
  await supabase.from('multiplayer_players')
    .update({ total_score: (player.total_score ?? 0) + addScore })
    .eq('room_id', roomId).eq('user_id', userId)
}

export async function getRoundAnswers(
  roomId: string,
  roundNumber: number,
): Promise<MultiplayerAnswer[]> {
  const { data } = await supabase
    .from('multiplayer_answers')
    .select('*, profiles(username)')
    .eq('room_id', roomId)
    .eq('round_number', roundNumber)
    .order('round_score', { ascending: false })
  return (data ?? []) as MultiplayerAnswer[]
}

// ── Realtime subscription ────────────────────────────────

export function subscribeToRoom(
  roomId: string,
  onRoomChange: (room: MultiplayerRoom) => void,
  onPlayersChange: (players: MultiplayerPlayer[]) => void,
  onAnswersChange: () => void,
) {
  const channel = supabase.channel(`mp:${roomId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'multiplayer_rooms',
      filter: `id=eq.${roomId}`,
    }, payload => {
      if (payload.new) onRoomChange(payload.new as MultiplayerRoom)
    })
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'multiplayer_players',
      filter: `room_id=eq.${roomId}`,
    }, async () => {
      const players = await getPlayers(roomId)
      onPlayersChange(players)
    })
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'multiplayer_answers',
      filter: `room_id=eq.${roomId}`,
    }, () => {
      onAnswersChange()
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

import { supabase, getFriends } from '@/lib/supabase'

export interface GameInvite {
  id: string
  room_id: string
  room_code: string
  from_user_id: string
  from_username: string
  to_user_id: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  created_at: string
  expires_at: string
}

export type InviteState = 'none' | 'pending' | 'in_room'
export interface FriendInvite { id: string; username: string; state: InviteState }

/** Přátelé + jejich stav vůči místnosti (pozván / v místnosti / lze pozvat). */
export async function getFriendsForInvite(roomId: string): Promise<FriendInvite[]> {
  const [friends, playersRes, sentRes] = await Promise.all([
    getFriends(),
    supabase.from('multiplayer_players').select('user_id').eq('room_id', roomId),
    supabase.from('game_invites').select('to_user_id').eq('room_id', roomId).eq('status', 'pending'),
  ])
  const inRoom = new Set((playersRes.data ?? []).map(r => (r as { user_id: string }).user_id))
  const invited = new Set((sentRes.data ?? []).map(r => (r as { to_user_id: string }).to_user_id))
  return friends.map(f => ({
    id: f.id,
    username: f.username ?? '?',
    state: inRoom.has(f.id) ? 'in_room' : invited.has(f.id) ? 'pending' : 'none' as InviteState,
  }))
}

/** Pošle pozvánku příteli (server ověří přátelství, anti-spam). */
export async function sendGameInvite(roomId: string, toUserId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('send_game_invite', { p_room_id: roomId, p_to: toUserId })
  return { error: error ? (error.message || 'error') : null }
}

/** Příjemce přijme / odmítne pozvánku. */
export async function respondInvite(inviteId: string, accept: boolean): Promise<void> {
  await supabase.rpc('respond_game_invite', { p_invite: inviteId, p_accept: accept })
}

/** Ztlumí pozvánky od daného odesílatele. */
export async function muteInviter(fromUserId: string): Promise<void> {
  const { data } = await supabase.auth.getUser()
  const me = data.user?.id
  if (!me) return
  await supabase.from('invite_mutes').upsert({ muter_id: me, muted_id: fromUserId })
}

/** Čekající pozvánky pro mě (nevypršené). Filtruje jen PŘÍCHOZÍ (to_user_id = já) —
 *  RLS totiž povoluje číst i vlastní odeslané (from_user_id), ty ale banner ukazovat nesmí. */
export async function getPendingInvites(): Promise<GameInvite[]> {
  const { data: auth } = await supabase.auth.getUser()
  const me = auth.user?.id
  if (!me) return []
  const { data } = await supabase
    .from('game_invites')
    .select('*')
    .eq('to_user_id', me)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  return (data ?? []) as GameInvite[]
}

/** Realtime: nová příchozí pozvánka pro daného uživatele. Vrací odhlašovací fn. */
export function subscribeIncomingInvites(userId: string, onInvite: (inv: GameInvite) => void): () => void {
  const channel = supabase
    .channel(`invites:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'game_invites',
      filter: `to_user_id=eq.${userId}`,
    }, payload => {
      const inv = payload.new as GameInvite
      if (inv.status === 'pending') onInvite(inv)
    })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}

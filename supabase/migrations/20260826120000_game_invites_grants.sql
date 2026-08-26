-- Oprava: pozvánky do MP nedorazily příjemci.
-- Tabulky game_invites / invite_mutes měly RLS politiky i Realtime, ale chyběl
-- table-level GRANT roli authenticated. Insert pozvánky běží přes SECURITY DEFINER
-- (funguje), ale příjemce čte pozvánky přímo (getPendingInvites) i přes Realtime
-- pod rolí authenticated → bez GRANTu „permission denied" → notifikace nedorazí.
-- Idempotentní.

-- Čtení vlastních pozvánek (RLS dál omezuje na to_user_id/from_user_id = auth.uid()).
-- UPDATE kvůli RLS politice „gi: recipient responds" (odpověď příjemce).
grant select, update on public.game_invites to authenticated;

-- invite_mutes: klient zapisuje ztlumení přímo (muteInviter → upsert), RLS drží
-- řádky na muter_id = auth.uid().
grant select, insert, update, delete on public.invite_mutes to authenticated;

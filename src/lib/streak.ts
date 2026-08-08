import { localDateISO } from './supabase'

/** Aktuální série denních výzev (počet po sobě jdoucích dní končící dneškem;
 *  když dnešek ještě nehrál, počítá se série končící včerejškem). Shodné s Menu. */
export function computeDailyStreak(played: Set<string>): number {
  let streak = 0
  const d = new Date()
  if (!played.has(localDateISO(d))) d.setDate(d.getDate() - 1)
  while (played.has(localDateISO(d))) { streak++; d.setDate(d.getDate() - 1) }
  return streak
}

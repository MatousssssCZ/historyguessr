// Výzva kamarádovi: odkaz na konkrétní událost (1 kolo) se skóre k poražení.
// Skóre i jméno jsou zakódované v URL — žádný backend.

export function buildChallengeUrl(eventId: string, score: number, by?: string | null, opts?: { daily?: boolean }): string {
  const p = new URLSearchParams()
  p.set('s', String(Math.max(0, Math.min(1000, Math.round(score)))))
  if (by) p.set('by', by.slice(0, 24))
  if (opts?.daily) p.set('daily', '1')  // příjemce míří do denní výzvy (ne standalone kolo)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://historyguesser.net'
  return `${origin}/vyzva/${eventId}?${p.toString()}`
}

/** Sdílej výzvu (Web Share API, jinak zkopíruj do schránky). Vrací 'shared' | 'copied' | 'failed'. */
export async function shareChallenge(url: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) { await navigator.share({ text: `${text} ${url}` }); return 'shared' }
  } catch { /* uživatel zrušil / nepodporováno → fallback */ }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}

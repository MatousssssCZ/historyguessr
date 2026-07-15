// Ukládání rozehrané solo hry do localStorage — umožní „Pokračovat ve hře".
// Platí 1 hodinu; multiplayer/daily/kampaně se neukládají.
import type { Event, RoundResult } from '@/types/database'

export interface ResumeState {
  events: Event[]
  rounds: RoundResult[]      // dokončená kola
  totalScore: number
  totalRounds: number
  sessionId: string | null
  savedAt: number
}

const KEY = (uid: string) => `hg_resume_${uid}`
export const RESUME_TTL = 3600_000 // 1 hodina

export function saveResume(userId: string, s: ResumeState) {
  try { localStorage.setItem(KEY(userId), JSON.stringify(s)) } catch { /* ignore */ }
}

export function loadResume(userId: string): ResumeState | null {
  try {
    const raw = localStorage.getItem(KEY(userId))
    if (!raw) return null
    const s = JSON.parse(raw) as ResumeState
    if (!s || !Array.isArray(s.events) || !Array.isArray(s.rounds)) { clearResume(userId); return null }
    // Prošlé nebo už dohrané → zahoď
    if (Date.now() - s.savedAt > RESUME_TTL || s.rounds.length >= s.totalRounds) { clearResume(userId); return null }
    return s
  } catch { return null }
}

export function clearResume(userId: string) {
  try { localStorage.removeItem(KEY(userId)) } catch { /* ignore */ }
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { currentLocale } from '@/i18n'
import { getProfile, getCategoryHits } from '@/lib/supabase'
import { levelFromXp } from '@/lib/leveling'
import { ACHIEVEMENTS } from '@/lib/achievements'

interface UnlockedTier { catIcon: string; catLabel: string; icon: string; name: string }

/**
 * Vyhodnocení po hře: získané XP, postup v levelu a nově odemčené achievementy.
 * `gameHits` = počet kol se skóre ≥950 v této hře po kategoriích (id → počet).
 * Odvozuje stav před/po z aktuálního XP v DB (= už po připsání) mínus `gainedXp`.
 */
export default function GameEvaluation({ userId, gainedXp, gameHits }: {
  userId?: string; gainedXp: number; gameHits: Record<string, number>
}) {
  const { t } = useTranslation()
  const [xpAfter, setXpAfter] = useState<number | null>(null)
  const [unlocked, setUnlocked] = useState<UnlockedTier[]>([])

  useEffect(() => {
    if (!userId) return
    let alive = true
    Promise.all([getProfile(userId), getCategoryHits(userId)]).then(([prof, afterHits]) => {
      if (!alive) return
      setXpAfter(prof.data?.xp ?? gainedXp)
      const newly: UnlockedTier[] = []
      for (const cat of ACHIEVEMENTS) {
        const after = afterHits[cat.id] ?? 0
        const before = after - (gameHits[cat.id] ?? 0)
        if (after === before) continue
        for (const tier of cat.tiers) {
          if (before < tier.count && tier.count <= after) {
            newly.push({ catIcon: cat.icon, catLabel: cat.label, icon: tier.icon, name: tier.name })
          }
        }
      }
      setUnlocked(newly)
    }).catch(() => {})
    return () => { alive = false }
  }, [userId])

  const before = xpAfter != null ? xpAfter - gainedXp : null
  const lvlBefore = before != null ? levelFromXp(before) : null
  const lvlAfter = xpAfter != null ? levelFromXp(xpAfter) : null
  const leveledUp = lvlBefore && lvlAfter && lvlAfter.level > lvlBefore.level

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* XP / level */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15 }}>
            {t('menu.level')} {lvlAfter?.level ?? lvlBefore?.level ?? '—'}
            {leveledUp && <span style={{ color: 'var(--accent)', fontSize: 12, marginLeft: 8 }}>{t('game.levelUp')}</span>}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--accent-deep)' }}>+{gainedXp.toLocaleString(currentLocale())} XP</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--paper-300)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.round((lvlAfter?.pct ?? 0) * 100)}%`, background: 'linear-gradient(90deg, #d97757, #e89a82)', transition: 'width 700ms ease' }}/>
        </div>
        {lvlAfter && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 5, textAlign: 'right' }}>
            {lvlAfter.into.toLocaleString(currentLocale())} / {lvlAfter.need.toLocaleString(currentLocale())} XP
          </div>
        )}
      </div>

      {/* Odemčené achievementy */}
      {unlocked.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>{t('game.newAchievements')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unlocked.map((u, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 22, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: 'rgba(217,119,87,0.1)' }}>{u.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{u.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>{u.catIcon} {u.catLabel}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--accent)' }}>✓</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

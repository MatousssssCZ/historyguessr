import { useTilt } from '@/hooks/useTilt'
import { type Rarity } from '@/lib/relics'

// Ražený kovový odznak relikvie: kruhová „mince" v barvě dle vzácnosti
// (common = měď, rare = stříbro, epic = zlato, legendary = zlato + holo),
// uvnitř vyražená silueta relikvie. Lesk reaguje na náklon telefonu / pohyb kurzoru.

type Metal = { rim: string; face: string; faceLo: string; engrave: string; emboss: string; glow: string }
const METAL: Record<Rarity, Metal> = {
  // common → měď
  common:    { rim: '#7a4a1e', face: '#c9884f', faceLo: '#9a5f2c', engrave: '#5f3915', emboss: '#e6a86b', glow: 'rgba(184,115,51,.55)' },
  // rare → stříbro
  rare:      { rim: '#7d828c', face: '#d6dae1', faceLo: '#a7adb8', engrave: '#6b7079', emboss: '#f4f6fa', glow: 'rgba(180,188,200,.6)' },
  // epic → zlato
  epic:      { rim: '#9a7a1e', face: '#e3c356', faceLo: '#b8952b', engrave: '#846313', emboss: '#f7e48f', glow: 'rgba(212,175,55,.6)' },
  // legendary → zlato + holo
  legendary: { rim: '#9a7a1e', face: '#e8cb63', faceLo: '#bd9a2e', engrave: '#8a6812', emboss: '#faec9b', glow: 'rgba(212,175,55,.7)' },
}

export default function RelicBadge({ rarity, silhouetteUrl, iconUrl, size = 56, name, dim }: {
  rarity: Rarity | null
  silhouetteUrl?: string | null
  iconUrl?: string | null   // fallback, když silueta chybí
  size?: number
  name?: string
  dim?: boolean   // zamčená/neupevněná — zešedne
}) {
  const tilt = useTilt()
  const metal = METAL[rarity ?? 'common']
  const legendary = rarity === 'legendary'
  const rim = Math.max(2, Math.round(size * 0.06))
  const shX = tilt.x, shY = tilt.y
  const sil = silhouetteUrl || iconUrl || null

  const faceGrad = dim
    ? 'linear-gradient(145deg,#cdc7bd,#b3ada3)'
    : `linear-gradient(${140 + shX * 24}deg, ${metal.emboss} 0%, ${metal.face} 42%, ${metal.faceLo} 100%)`

  const silLayer = (color: string, dx = 0, dy = 0): React.CSSProperties => ({
    position: 'absolute', inset: '50%', width: '58%', height: '58%',
    transform: `translate(-50%,-50%) translate(${dx}px,${dy}px)`,
    background: color,
    WebkitMaskImage: `url(${sil})`, maskImage: `url(${sil})`,
    WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center', maskPosition: 'center',
    WebkitMaskSize: 'contain', maskSize: 'contain',
    pointerEvents: 'none',
  })

  return (
    <div title={name} style={{
      width: size, height: size, flex: 'none', borderRadius: '50%', padding: rim,
      background: dim ? '#b9b3a9' : `linear-gradient(145deg, ${metal.emboss}, ${metal.rim})`,
      boxShadow: dim ? 'none' : legendary ? `0 0 18px -2px rgba(180,120,220,.6), 0 6px 16px -8px ${metal.glow}` : `0 6px 16px -8px ${metal.glow}, inset 0 0 0 1px rgba(255,255,255,.15)`,
      position: 'relative',
    }}>
      {/* legendary: rotující duhový prstenec kolem mince */}
      {legendary && !dim && (
        <div aria-hidden style={{
          position: 'absolute', inset: -1, borderRadius: '50%', pointerEvents: 'none',
          background: 'conic-gradient(from 0deg, #ff5f6d, #ffd36e, #47e0a0, #4ea0e0, #a06ad0, #ff5f6d)',
          animation: 'holoRim 6s linear infinite', filter: 'saturate(1.3)', zIndex: 0,
        }}/>
      )}
      <div style={{
        width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', position: 'relative', zIndex: 1,
        background: faceGrad, boxShadow: 'inset 0 1px 2px rgba(255,255,255,.35), inset 0 -2px 5px rgba(0,0,0,.28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {sil ? (
          <>
            {/* emboss: světlý posun + vyražení + stín */}
            {!dim && <div aria-hidden style={silLayer(`${metal.emboss}cc`, -0.5, -0.5)}/>}
            <div aria-hidden style={silLayer(dim ? 'rgba(90,84,76,.55)' : metal.engrave)}/>
            {!dim && <div aria-hidden style={silLayer('rgba(0,0,0,.18)', 0.6, 0.7)}/>}
          </>
        ) : (
          <span style={{ fontSize: Math.round(size * 0.4), color: dim ? 'rgba(31,27,22,.3)' : metal.engrave }}>🏺</span>
        )}

        {/* lesk přejíždějící po minci dle náklonu */}
        {!dim && (
          <div aria-hidden style={{
            position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none', mixBlendMode: 'soft-light',
            background: `linear-gradient(${105 + shX * 45}deg, transparent 30%, rgba(255,255,255,${legendary ? 0.7 : 0.5}) ${46 + shY * 7}%, transparent 62%)`,
          }}/>
        )}
        {legendary && !dim && (
          <>
            {/* stálý holografický přeliv — animovaný i bez náklonu, navíc reaguje na náklon */}
            <div aria-hidden style={{
              position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none', mixBlendMode: 'screen', opacity: 0.8,
              background: 'linear-gradient(115deg, rgba(255,0,128,.7), rgba(0,200,255,.7), rgba(120,255,120,.7), rgba(255,220,0,.7), rgba(180,80,255,.7), rgba(255,0,128,.7))',
              backgroundSize: '300% 100%',
              backgroundPosition: `${50 + shX * 50}% 50%`,
              animation: 'holoShift 4s linear infinite',
            }}/>
            {/* ostrý duhový pruh přes střed */}
            <div aria-hidden style={{
              position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none', mixBlendMode: 'color-dodge', opacity: 0.6,
              background: `linear-gradient(${100 + shX * 40}deg, transparent 38%, rgba(120,220,255,.9) ${47 + shY * 8}%, rgba(255,140,220,.9) ${53 + shY * 8}%, transparent 62%)`,
            }}/>
          </>
        )}
      </div>
    </div>
  )
}

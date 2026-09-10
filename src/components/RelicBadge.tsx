import { useTilt } from '@/hooks/useTilt'
import { RARITY_META, type Rarity } from '@/lib/relics'

// Kruhový odznak relikvie: okraj dle vzácnosti (legendary = duhový),
// uvnitř AI ikona, a holografický lesk reagující na náklon telefonu / pohyb kurzoru.
export default function RelicBadge({ rarity, iconUrl, size = 56, name, dim }: {
  rarity: Rarity | null
  iconUrl?: string | null
  size?: number
  name?: string
  dim?: boolean   // zamčená/neupevněná — zešedne
}) {
  const tilt = useTilt()
  const tone = rarity ? RARITY_META[rarity].tone : '#8A7E6C'
  const legendary = rarity === 'legendary'
  const bw = Math.max(2, Math.round(size * 0.055))
  const shX = tilt.x, shY = tilt.y

  const ring: string = legendary
    ? `conic-gradient(from ${shX * 60}deg, #ff5f6d, #ffd36e, #47e0a0, #4ea0e0, #a06ad0, #ff5f6d)`
    : `linear-gradient(${135 + shX * 30}deg, ${tone}, ${tone}aa)`

  return (
    <div style={{
      width: size, height: size, flex: 'none', borderRadius: '50%', padding: bw,
      background: dim ? 'var(--line-strong, #cbb)' : ring,
      boxShadow: dim ? 'none' : legendary ? '0 0 16px -3px rgba(160,120,210,.65)' : `0 6px 16px -9px ${tone}`,
      position: 'relative',
    }}>
      <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#241d16', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {iconUrl
          ? <img src={iconUrl} alt={name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: dim ? 'grayscale(1) opacity(.5)' : 'none' }}/>
          : <span style={{ fontSize: Math.round(size * 0.4), color: dim ? 'rgba(31,27,22,.3)' : tone }}>🏺</span>}
        {!dim && (
          <div aria-hidden style={{
            position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none', mixBlendMode: 'overlay',
            background: `linear-gradient(${105 + shX * 40}deg, transparent 32%, rgba(255,255,255,${legendary ? 0.55 : 0.3}) ${47 + shY * 6}%, transparent 64%)`,
          }}/>
        )}
        {legendary && !dim && (
          <div aria-hidden style={{
            position: 'absolute', inset: 0, borderRadius: '50%', pointerEvents: 'none', mixBlendMode: 'color-dodge', opacity: 0.5,
            background: 'linear-gradient(115deg, rgba(255,0,128,.5), rgba(0,200,255,.5), rgba(120,255,120,.5), rgba(255,200,0,.5))',
            backgroundSize: '260% 260%', backgroundPosition: `${50 + shX * 40}% ${50 + shY * 40}%`,
          }}/>
        )}
      </div>
    </div>
  )
}

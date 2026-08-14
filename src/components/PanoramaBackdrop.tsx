import { useEffect, useState } from 'react'
import { getRandomPanoramas, transformedImageUrl } from '@/lib/supabase'

// Ambientní pozadí přihlašovací obrazovky: 5 náhodných panoramat se pomalu
// posouvá horizontálně (CSS pan, směr se střídá) a cross-fade mezi nimi.
// Lehčí a spolehlivější než 5 WebGL vieweru; neruší formulář (pointerEvents: none).
export default function PanoramaBackdrop() {
  const [urls, setUrls] = useState<string[]>([])
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    let alive = true
    getRandomPanoramas(5).then(list => {
      if (!alive) return
      const disp = list.map(u => transformedImageUrl(u, { width: 2560, quality: 68 }))
      setUrls(disp)
      disp.forEach(u => { const img = new Image(); img.src = u })  // přednačti do mezipaměti
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (urls.length < 2) return
    const id = setInterval(() => setIdx(i => (i + 1) % urls.length), 10000)
    return () => clearInterval(id)
  }, [urls])

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#161009', pointerEvents: 'none' }}>
      {urls.map((u, i) => (
        <div key={u} style={{ position: 'absolute', inset: 0, opacity: i === idx ? 1 : 0, transition: 'opacity 1.8s ease-in-out' }}>
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '-7%', width: '114%',
            backgroundImage: `url(${u})`, backgroundSize: 'auto 118%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center',
            animation: `hgPan ${18 + (i % 3) * 3}s ease-in-out infinite alternate`,
          }}/>
        </div>
      ))}
    </div>
  )
}

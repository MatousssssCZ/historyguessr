// Po `vite build` vygeneruje jazykové varianty dist/en/index.html a
// dist/de/index.html z dist/index.html (česká verze). Každá má lokalizovaný
// <html lang>, <title>, meta description, canonical, og/twitter, og:locale,
// JSON-LD i <noscript> — kvůli tomu, aby Google ukazoval správný jazyk ve
// výsledcích. Vzájemné hreflang odkazy jsou už v index.html (stejné pro všechny).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')
const BASE = 'https://historyguesser.net'

const L = {
  en: {
    lang: 'en',
    path: '/en',
    ogLocale: 'en_US',
    title: 'Historyguesser — GeoGuessr for history: guess the place and year',
    description: 'Historyguesser is an educational game like GeoGuessr, but for history. You stand in a 360° panorama of a historical place and guess where in the world the event happened and in what year. Free, in English, Czech and German.',
    ogDescription: 'You see a 360° panorama of a historical place. Can you guess where in the world it is and what year the event happened?',
    jsonldDescription: 'An educational geolocation game like GeoGuessr, but for history. The player sees a 360° panorama of a historical place and guesses where in the world the event happened and in what year.',
    faq: [
      ['What is Historyguesser?', 'Historyguesser is an educational game inspired by GeoGuessr, but focused on history. You stand in a 360° panorama of a historical place and guess where in the world the event happened and in what year.'],
      ['Is Historyguesser free?', 'Yes, you can play for free. An optional Premium subscription (CZK 99/month) adds ad-free play, all campaigns and advanced features.'],
      ['How do you play Historyguesser?', 'You look around a 360° panorama, tap the map to set the place and use a slider to guess the year. The closer to the real place and year, the more points.'],
      ['How is it different from GeoGuessr?', 'Besides the place, you also guess the year the historical event happened. The panoramas capture historical moments and the game is educational.'],
      ['What languages is Historyguesser in?', 'Historyguesser is available in Czech, English and German.'],
    ],
    noscript: `<main style="max-width:720px;margin:0 auto;padding:32px 20px;font-family:sans-serif;line-height:1.6;color:#26211C">
          <h1>Historyguesser — GeoGuessr for history</h1>
          <p>Historyguesser is an educational geolocation game inspired by GeoGuessr, but focused on history. You stand in a 360° panorama of a historical place and guess <strong>where in the world</strong> the event happened and <strong>in what year</strong>. The closer to the real place and year, the more points.</p>
          <h2>How to play</h2>
          <ol>
            <li>Look around the 360° panorama for clues — architecture, nature, clothing.</li>
            <li>Tap the map to set where in the world the event happened.</li>
            <li>Use the slider to guess the year. Earn points, levels and badges.</li>
          </ol>
          <h2>Game modes</h2>
          <p>Solo game, the daily "This day in history" challenge, historical campaigns and multiplayer for up to 12 players.</p>
          <h2>FAQ</h2>
          <p><strong>Is it free?</strong> Yes, playing is free. Optional Premium (CZK 99/month) adds ad-free play and advanced features.</p>
          <p><strong>What languages?</strong> Czech, English and German.</p>
          <p><strong>How is it different from GeoGuessr?</strong> Besides the place, you also guess the year of the historical event — the game is educational.</p>
          <p>Playing requires a browser with JavaScript. Open <a href="https://historyguesser.net/en">historyguesser.net</a>.</p>
        </main>`,
  },
  de: {
    lang: 'de',
    path: '/de',
    ogLocale: 'de_DE',
    title: 'Historyguesser — GeoGuessr für Geschichte: errate Ort und Jahr',
    description: 'Historyguesser ist ein Lernspiel wie GeoGuessr, aber für Geschichte. Du stehst in einem 360°-Panorama eines historischen Ortes und errätst, wo auf der Welt das Ereignis geschah und in welchem Jahr. Kostenlos, auf Deutsch, Englisch und Tschechisch.',
    ogDescription: 'Du siehst ein 360°-Panorama eines historischen Ortes. Errätst du, wo auf der Welt es ist und in welchem Jahr das Ereignis geschah?',
    jsonldDescription: 'Ein Lern- und Geolokationsspiel wie GeoGuessr, aber für Geschichte. Der Spieler sieht ein 360°-Panorama eines historischen Ortes und errät, wo auf der Welt das Ereignis geschah und in welchem Jahr.',
    faq: [
      ['Was ist Historyguesser?', 'Historyguesser ist ein Lernspiel, inspiriert von GeoGuessr, aber mit Fokus auf Geschichte. Du stehst in einem 360°-Panorama eines historischen Ortes und errätst, wo auf der Welt das Ereignis geschah und in welchem Jahr.'],
      ['Ist Historyguesser kostenlos?', 'Ja, du kannst kostenlos spielen. Ein optionales Premium-Abo (99 CZK/Monat) bietet werbefreies Spielen, alle Kampagnen und erweiterte Funktionen.'],
      ['Wie spielt man Historyguesser?', 'Du siehst dich im 360°-Panorama um, tippst auf die Karte für den Ort und stellst mit einem Regler das Jahr ein. Je näher am echten Ort und Jahr, desto mehr Punkte.'],
      ['Wie unterscheidet es sich von GeoGuessr?', 'Neben dem Ort errätst du auch das Jahr des historischen Ereignisses. Die Panoramen zeigen historische Momente und das Spiel ist lehrreich.'],
      ['In welchen Sprachen gibt es Historyguesser?', 'Historyguesser ist auf Tschechisch, Englisch und Deutsch verfügbar.'],
    ],
    noscript: `<main style="max-width:720px;margin:0 auto;padding:32px 20px;font-family:sans-serif;line-height:1.6;color:#26211C">
          <h1>Historyguesser — GeoGuessr für Geschichte</h1>
          <p>Historyguesser ist ein Geolokations-Lernspiel, inspiriert von GeoGuessr, aber mit Fokus auf Geschichte. Du stehst in einem 360°-Panorama eines historischen Ortes und errätst, <strong>wo auf der Welt</strong> das Ereignis geschah und <strong>in welchem Jahr</strong>. Je näher am echten Ort und Jahr, desto mehr Punkte.</p>
          <h2>Spielablauf</h2>
          <ol>
            <li>Sieh dich im 360°-Panorama um — Architektur, Natur, Kleidung.</li>
            <li>Tippe auf die Karte, wo auf der Welt das Ereignis geschah.</li>
            <li>Stelle mit dem Regler das Jahr ein. Sammle Punkte, Level und Abzeichen.</li>
          </ol>
          <h2>Spielmodi</h2>
          <p>Solospiel, die tägliche Herausforderung „Dieser Tag in der Geschichte", historische Kampagnen und Mehrspieler für bis zu 12 Spieler.</p>
          <h2>FAQ</h2>
          <p><strong>Ist es kostenlos?</strong> Ja, das Spielen ist kostenlos. Optionales Premium (99 CZK/Monat) bietet werbefreies Spielen und erweiterte Funktionen.</p>
          <p><strong>Welche Sprachen?</strong> Tschechisch, Englisch und Deutsch.</p>
          <p><strong>Wie unterscheidet es sich von GeoGuessr?</strong> Neben dem Ort errätst du auch das Jahr des historischen Ereignisses — das Spiel ist lehrreich.</p>
          <p>Zum Spielen wird ein Browser mit JavaScript benötigt. Öffne <a href="https://historyguesser.net/de">historyguesser.net</a>.</p>
        </main>`,
  },
}

function jsonLd(v) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        name: 'Historyguesser',
        url: `${BASE}${v.path}`,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Web',
        inLanguage: ['cs', 'en', 'de'],
        description: v.jsonldDescription,
        offers: [
          { '@type': 'Offer', price: '0', priceCurrency: 'CZK', description: 'Free' },
          { '@type': 'Offer', price: '99', priceCurrency: 'CZK', description: 'Premium — monthly subscription' },
        ],
        author: { '@type': 'Organization', name: 'Historyguesser' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: v.faq.map(([q, a]) => ({
          '@type': 'Question', name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      },
    ],
  }
}

const srcPath = resolve(dist, 'index.html')
let src
try {
  src = readFileSync(srcPath, 'utf8')
} catch {
  console.error('[i18n-pages] dist/index.html nenalezen — spusť po `vite build`.')
  process.exit(1)
}

for (const v of Object.values(L)) {
  let html = src
  html = html.replace('<html lang="cs">', `<html lang="${v.lang}">`)
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${v.title}</title>`)
  html = html.replace(/(<meta name="description" content=")[\s\S]*?(" \/>)/, `$1${v.description}$2`)
  html = html.replace(/(<meta property="og:title" content=")[\s\S]*?(" \/>)/, `$1${v.title}$2`)
  html = html.replace(/(<meta property="og:description" content=")[\s\S]*?(" \/>)/, `$1${v.ogDescription}$2`)
  html = html.replace(/(<meta property="og:url" content=")[\s\S]*?(" \/>)/, `$1${BASE}${v.path}$2`)
  html = html.replace(/(<meta property="og:locale" content=")[\s\S]*?(" \/>)/, `$1${v.ogLocale}$2`)
  html = html.replace(/(<meta name="twitter:title" content=")[\s\S]*?(" \/>)/, `$1${v.title}$2`)
  html = html.replace(/(<meta name="twitter:description" content=")[\s\S]*?(" \/>)/, `$1${v.ogDescription}$2`)
  // canonical → self-referencing na jazykovou URL
  html = html.replace(/(<link rel="canonical" href=")[\s\S]*?(" \/>)/, `$1${BASE}${v.path}$2`)
  // JSON-LD
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">\n${JSON.stringify(jsonLd(v), null, 2)}\n    </script>`)
  // noscript
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, `<noscript>\n        ${v.noscript}\n      </noscript>`)

  const outDir = resolve(dist, v.lang)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'index.html'), html, 'utf8')
  console.log(`[i18n-pages] ✓ dist/${v.lang}/index.html`)
}

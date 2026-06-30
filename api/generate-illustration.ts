// Vercel serverless funkce — vygeneruje ilustrační (doplňkový) obrázek události
// přes OpenAI image API. Klíč zůstává na serveru. Volá jen admin.
//
// ENV (Vercel): OPENAI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

export const config = { maxDuration: 180 }

function buildPrompt(p: { title: string; date: string; period: string; location: string; description: string }): string {
  return `Create a historically accurate, photorealistic illustration of the following event — a single editorial image (NOT a 360° panorama).

EVENT: ${p.title || '(neuvedeno)'}
DATE: ${p.date || '(neuvedeno)'}
PERIOD: ${p.period || '(neuvedeno)'}
LOCATION: ${p.location || '(neuvedeno)'}
DESCRIPTION: ${p.description || '(neuvedeno)'}

STYLE & ACCURACY
- Photorealistic, documentary realism, natural lighting, authentic atmosphere.
- Historically accurate architecture, clothing, technology, vegetation and culture for the exact place and period.
- People (if any) behave appropriately for the situation; anatomically correct, natural poses, no AI artifacts, no duplicated faces.
- A clear, representative composition that captures the essence of the event.
- No text, watermarks, logos, captions or borders. No modern elements out of period.`
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return }

  const SUPA = process.env.VITE_SUPABASE_URL
  const ANON = process.env.VITE_SUPABASE_ANON_KEY
  const OPENAI_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_KEY) { res.status(500).json({ error: 'missing_openai_key' }); return }

  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '')
    if (!token || !SUPA || !ANON) { res.status(401).json({ error: 'unauthorized' }); return }
    const userRes = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } })
    if (!userRes.ok) { res.status(401).json({ error: 'unauthorized' }); return }
    const user = await userRes.json()
    const profRes = await fetch(`${SUPA}/rest/v1/profiles?id=eq.${user.id}&select=role`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } })
    const prof = await profRes.json()
    if (!Array.isArray(prof) || prof[0]?.role !== 'admin') { res.status(403).json({ error: 'forbidden' }); return }
  } catch {
    res.status(401).json({ error: 'unauthorized' }); return
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const title = String(body.title || '').trim()
  if (!title) { res.status(400).json({ error: 'missing_title' }); return }

  const model = body.model === 'gpt-image-1' ? 'gpt-image-1' : 'gpt-image-2'
  const prompt = buildPrompt({
    title,
    date: String(body.event_date || '').trim(),
    period: String(body.period || '').trim(),
    location: String(body.location || '').trim(),
    description: String(body.description || '').trim(),
  })

  try {
    const payload: any = { model, prompt, size: '1536x1024', quality: String(body.quality || 'medium'), n: 1, output_format: 'jpeg', output_compression: 90 }
    const aiRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify(payload),
    })
    if (!aiRes.ok) {
      const txt = await aiRes.text()
      res.status(502).json({ error: 'openai_error', detail: txt.slice(0, 500) }); return
    }
    const data = await aiRes.json()
    let b64 = data?.data?.[0]?.b64_json
    const url = data?.data?.[0]?.url
    let mime = 'image/jpeg'
    if (!b64 && url) {
      const imgRes = await fetch(url)
      if (!imgRes.ok) { res.status(502).json({ error: 'image_fetch_failed' }); return }
      b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64')
      mime = imgRes.headers.get('content-type') || mime
    }
    if (!b64) { res.status(502).json({ error: 'no_image' }); return }
    res.status(200).json({ image: `data:${mime};base64,${b64}`, model })
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', detail: String(e?.message || e) })
  }
}

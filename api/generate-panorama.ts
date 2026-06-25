// Vercel serverless funkce — vygeneruje 360° panorama přes OpenAI image API.
// Klíč zůstává na serveru (env OPENAI_API_KEY). Volá jen admin (ověření přes Supabase).
//
// ENV (Vercel): OPENAI_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

export const config = { maxDuration: 180 }

function buildPrompt(p: {
  title: string; date: string; period: string; location: string; description: string
}): string {
  return `Create an ultra-realistic historical 360° panorama.

TECHNICAL REQUIREMENTS
- Equirectangular projection, full 360-degree panoramic image, 2:1 aspect ratio.
- Seamless horizontal wraparound; left and right edges must connect perfectly.
- Correct panoramic distortion near edges. Optimized for interactive 360° viewing.
- Ground-level viewpoint, first-person observer, camera height approximately 1.7 meters.

VISUAL STYLE
- Photorealistic, documentary realism, historically authentic atmosphere.
- Natural lighting, physically realistic materials, real-world weather.
- No fantasy elements, no painting style, no cinematic effects, no exaggerated drama.

HISTORICAL RESEARCH TASK
Before generating the scene, determine the most historically plausible and visually informative moment associated with the event. Select a moment that actually happened, is representative, contains recognizable historical clues, does not directly reveal the answer, maximizes educational value, and can realistically be observed by a witness standing at the location. Generate the panorama as if a real eyewitness were standing there during that moment.

EVENT
${p.title || '(neuvedeno)'}

EXACT DATE
${p.date || '(neuvedeno)'}

PERIOD
${p.period || '(neuvedeno)'}

LOCATION
${p.location || '(neuvedeno)'}

DESCRIPTION
${p.description || '(neuvedeno)'}

HISTORICAL ACCURACY
Historical accuracy has absolute priority. All visible elements (architecture, terrain, vegetation, climate, clothing, armor, weapons, vehicles, banners, military formations, technology, culture, construction methods, agriculture, infrastructure, trade goods) must match the exact place and period. Do not include anything that did not exist at that location and date. When details are uncertain, prefer the most widely accepted academic reconstruction. Do not invent speculative details.

REALISTIC HUMAN REPRESENTATION
Anatomically correct humans, realistic proportions, natural poses and expressions. No duplicated people, cloned faces, malformed hands, extra limbs, or AI artifacts. Correct population diversity for the specific region and period.

CROWD BEHAVIOR & BEHAVIOR APPROPRIATENESS
Any people present must behave in a way appropriate to the specific situation and moment of the event. Crowds must contain significant visual diversity (age, gender, clothing condition, posture, activity, social status). Avoid repeated faces and clothing patterns.

SCENE COMPOSITION
Do not create artificially staged scenes. Distribute people naturally; most should be engaged in ordinary actions appropriate for the situation. Avoid groups looking directly at the camera, symmetrical compositions, cinematic hero shots, and modern photography composition. Avoid recreating famous paintings, textbook illustrations, or movie scenes. Generate as a plausible real-world observation.

360° PANORAMA REQUIREMENTS
The panorama must remain believable in every viewing direction. Do not concentrate all important action in a single area; interesting details should exist across the entire 360° environment. Maintain realistic scale relationships and seamless continuity in every direction.

GAMEPLAY REQUIREMENTS
This panorama is for a historical GeoGuessr-style game. Include enough authentic clues (regional architecture, local building materials, terrain, vegetation, period-appropriate signage/language, military equipment, trade goods, transportation) for a knowledgeable player to infer approximate century, geographic region, and historical context — without immediately identifying the exact event. Clues should be discoverable through observation but not obvious. Avoid famous individuals in the center of attention and obvious event-defining symbols that would make identification trivial.

NEGATIVE (do NOT include):
modern buildings, modern roads, asphalt, electricity poles, power lines, street lights, traffic signs, modern clothing, plastic objects, modern weapons, modern vehicles, aircraft outside period, photography equipment, tourists, smartphones, wristwatches outside period, text overlays, watermarks, logos, duplicate people, duplicate faces, deformed anatomy, extra fingers, extra limbs, floating objects, cropped humans, blurred faces, low detail, oversaturated colors, cinematic color grading, movie poster composition, fantasy elements, science fiction elements, steampunk elements, incorrect ethnicity for region and period, incorrect architecture, incorrect vegetation, incorrect military equipment, incorrect historical technology.`
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method_not_allowed' }); return }

  const SUPA = process.env.VITE_SUPABASE_URL
  const ANON = process.env.VITE_SUPABASE_ANON_KEY
  const OPENAI_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_KEY) { res.status(500).json({ error: 'missing_openai_key' }); return }

  // ── Ověření, že volá admin ──
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

  const model = body.model === 'gpt-image-2' ? 'gpt-image-2' : 'gpt-image-1'
  const prompt = buildPrompt({
    title,
    date: String(body.event_date || '').trim(),
    period: String(body.period || '').trim(),
    location: String(body.location || '').trim(),
    description: String(body.description || '').trim(),
  })

  try {
    const payload: any = model === 'gpt-image-2'
      ? { model, prompt, size: '1776x896', quality: String(body.quality || 'medium'), n: 1, output_format: 'webp', output_compression: 90 }
      : { model, prompt, size: '1536x1024', quality: String(body.quality || 'medium'), n: 1, output_format: 'webp', output_compression: 90 }
    let mime = 'image/webp'

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
    if (!b64 && url) {
      // Model vrátil URL (dall-e-3 default) → stáhni a převeď na base64
      const imgRes = await fetch(url)
      if (!imgRes.ok) { res.status(502).json({ error: 'image_fetch_failed' }); return }
      const buf = Buffer.from(await imgRes.arrayBuffer())
      b64 = buf.toString('base64')
      mime = imgRes.headers.get('content-type') || mime
    }
    if (!b64) { res.status(502).json({ error: 'no_image' }); return }

    res.status(200).json({ image: `data:${mime};base64,${b64}`, model })
  } catch (e: any) {
    res.status(500).json({ error: 'server_error', detail: String(e?.message || e) })
  }
}

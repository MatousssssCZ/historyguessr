import { describe, it, expect } from 'vitest'
import { encodePanoramaUrl } from './panorama'

const BASE = 'https://wgiijdnoiiuxxucacyio.supabase.co/storage/v1/object/public/panorama'

describe('encodePanoramaUrl', () => {
  it('zenkóduje mezery v názvu souboru (starý rozbitý soubor)', () => {
    const bad = `${BASE}/685fc6cb/685fc6cb_ Pattersonuv_ film_ pano.png`
    const enc = encodePanoramaUrl(bad)
    expect(enc).not.toContain(' ')
    expect(enc).toContain('%20')
  })

  it('je idempotentní — už zenkódovanou URL nerozbije', () => {
    const good = `${BASE}/685fc6cb/685fc6cb_Pattersonuv_pano.png`
    expect(encodePanoramaUrl(good)).toBe(good)
    const already = `${BASE}/685fc6cb/685fc6cb_%20Pattersonuv_pano.png`
    expect(encodePanoramaUrl(already)).toBe(already)
  })

  it('čistou URL nechá beze změny', () => {
    const clean = `${BASE}/abc/abc_udalost_pano.webp`
    expect(encodePanoramaUrl(clean)).toBe(clean)
  })

  it('prázdné / pending vrátí bezpečně', () => {
    expect(encodePanoramaUrl(null)).toBe('')
    expect(encodePanoramaUrl(undefined)).toBe('')
    expect(encodePanoramaUrl('pending')).toBe('pending')
  })

  it('nevalidní URL nespadne', () => {
    expect(encodePanoramaUrl('nonsense')).toBe('nonsense')
  })
})

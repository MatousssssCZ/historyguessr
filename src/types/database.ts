export interface Profile {
  id: string
  username: string | null
  avatar_url: string | null
  role: 'user' | 'admin'
  total_score: number
  games_played: number
  xp: number
  created_at: string
  is_premium?: boolean
  energy?: number
  energy_reset_at?: string | null
}

// ── Kampaně ────────────────────────────────────────────────
export interface CampaignCategory {
  id: string
  seq: number
  slug: string | null
  title: string
  title_en: string | null
  title_de: string | null
  description: string | null
  icon: string | null
  color: string | null
  unlock_stars: number
  is_premium: boolean
  published: boolean
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  category_id: string
  seq: number
  title: string
  title_en: string | null
  title_de: string | null
  description: string | null
  unlock_stars: number
  published: boolean
  created_at: string
  updated_at: string
}

export interface CampaignEvent {
  campaign_id: string
  position: number   // 1..5
  event_id: string
}

export interface UserCampaignProgress {
  user_id: string
  campaign_id: string
  best_score: number
  stars: number      // 0..3
  attempts_used: number
  completed_at: string | null
}

export type EventStatus = 'draft' | 'awaiting_panorama' | 'awaiting_review' | 'published'

export interface Event {
  id: string
  seq: number
  title: string
  description: string
  title_en: string | null
  title_de: string | null
  description_en: string | null
  description_de: string | null
  year: number
  year_from: number
  year_to: number
  event_date: string | null
  lat: number
  lng: number
  panorama_url: string
  preview_url: string | null
  event_image_url: string | null
  category: string | null
  difficulty: 1 | 2 | 3
  published: boolean
  status: EventStatus
  panorama_prompt: string | null
  play_count: number
  created_by: string | null
  created_at: string
  updated_at: string
  location_radius_km: number
  year_range: number
  hfov: number
  rating_sum: number
  rating_count: number
  score_count: number
  score_sum: number
  score_loc_sum: number
  score_year_sum: number
}

export interface EventInsert {
  title: string
  description: string
  title_en?: string | null
  title_de?: string | null
  description_en?: string | null
  description_de?: string | null
  year: number
  year_from: number
  year_to: number
  event_date?: string | null
  lat: number
  lng: number
  panorama_url: string
  event_image_url?: string | null
  category?: string | null
  difficulty?: 1 | 2 | 3
  published?: boolean
  status?: EventStatus
  panorama_prompt?: string | null
  created_by?: string | null
  location_radius_km?: number
  year_range?: number
  hfov?: number
}

export interface EventUpdate {
  title?: string
  description?: string
  title_en?: string | null
  title_de?: string | null
  description_en?: string | null
  description_de?: string | null
  year?: number
  year_from?: number
  year_to?: number
  event_date?: string | null
  lat?: number
  lng?: number
  panorama_url?: string
  preview_url?: string | null
  event_image_url?: string | null
  category?: string | null
  difficulty?: 1 | 2 | 3
  published?: boolean
  status?: EventStatus
  panorama_prompt?: string | null
  updated_at?: string
  location_radius_km?: number
  year_range?: number
  hfov?: number
}

export interface GameSession {
  id: string
  user_id: string
  started_at: string
  finished_at: string | null
  total_score: number | null
  rounds: RoundResult[]
  mode: 'classic'
}

export interface RoundResult {
  event_id: string
  guess_lat: number
  guess_lng: number
  guess_year: number
  distance_km: number
  year_diff: number
  location_score: number
  year_score: number
  round_score: number
}

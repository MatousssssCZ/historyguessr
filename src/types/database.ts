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
export type ContentStatus = 'draft' | 'published' | 'archived'

export interface CampaignCategory {
  id: string
  seq: number
  slug: string | null
  title: string
  title_en: string | null
  title_de: string | null
  description: string | null
  description_en: string | null
  description_de: string | null
  icon: string | null
  color: string | null
  hero_image_url: string | null
  /** Pevný globální práh ★ (Premium ho NIKDY neobchází) */
  required_global_stars: number
  is_premium: boolean
  status: ContentStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  category_id: string
  seq: number
  slug: string | null
  title: string
  title_en: string | null
  title_de: string | null
  description: string | null
  description_en: string | null
  description_de: string | null
  visual_url: string | null
  /** Konfigurovatelný počet kol (výchozí 5) */
  rounds_count: number
  /** Vlastní relativní prahy ★; null = globální z app_config */
  star_thresholds_pct: number[] | null
  /** Práh ★ v rámci kategorie — NE sekvenční odemykání */
  required_category_stars: number
  is_premium: boolean
  status: ContentStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface CampaignEvent {
  campaign_id: string
  position: number
  event_id: string
  is_active: boolean
  admin_note: string | null
}

export interface UserCampaignProgress {
  user_id: string
  campaign_id: string
  best_score: number
  best_stars: number       // 0..3
  completed_runs: number
  attempts_count: number
  first_completed_at: string | null
  last_played_at: string | null
}

export type AttemptStatus = 'created' | 'in_progress' | 'completed' | 'abandoned' | 'expired'

export interface CampaignAttempt {
  id: string
  user_id: string
  campaign_id: string
  status: AttemptStatus
  rounds_total: number
  total_score: number
  stars: number
  started_at: string
  completed_at: string | null
  expires_at: string
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

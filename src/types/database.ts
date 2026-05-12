// Typy pro HistoryGuessr databázi

export interface Profile {
  id: string
  username: string | null
  avatar_url: string | null
  role: 'user' | 'admin'
  total_score: number
  games_played: number
  created_at: string
}

export interface Event {
  id: string
  title: string
  description: string
  year: number
  lat: number
  lng: number
  panorama_url: string
  event_image_url: string | null
  category: string | null
  difficulty: 1 | 2 | 3
  published: boolean
  play_count: number
  created_by: string | null
  created_at: string
  updated_at: string
  location_radius_km: number
  year_range: number
  rating_sum: number
  rating_count: number
}

export interface EventInsert {
  title: string
  description: string
  year: number
  lat: number
  lng: number
  panorama_url: string
  event_image_url?: string | null
  category?: string | null
  difficulty?: 1 | 2 | 3
  published?: boolean
  created_by?: string | null
  location_radius_km?: number
  year_range?: number
}

export interface EventUpdate {
  title?: string
  description?: string
  year?: number
  lat?: number
  lng?: number
  panorama_url?: string
  event_image_url?: string | null
  category?: string | null
  difficulty?: 1 | 2 | 3
  published?: boolean
  updated_at?: string
  location_radius_km?: number
  year_range?: number
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

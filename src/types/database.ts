// Typy generované ze Supabase schématu
// Až budeš mít Supabase projekt, můžeš je vygenerovat příkazem:
// npx supabase gen types typescript --project-id TVUJ_ID > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          avatar_url: string | null
          role: 'user' | 'admin'
          total_score: number
          games_played: number
          created_at: string
        }
        Insert: {
          id: string
          username?: string | null
          avatar_url?: string | null
          role?: 'user' | 'admin'
          total_score?: number
          games_played?: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      events: {
        Row: {
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
        }
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'play_count' | 'created_at' | 'updated_at'> & {
          id?: string
          play_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['events']['Insert']>
      }
      game_sessions: {
        Row: {
          id: string
          user_id: string
          started_at: string
          finished_at: string | null
          total_score: number | null
          rounds: RoundResult[]
          mode: 'classic'
        }
        Insert: {
          id?: string
          user_id: string
          started_at?: string
          finished_at?: string | null
          total_score?: number | null
          rounds?: RoundResult[]
          mode?: 'classic'
        }
        Update: Partial<Database['public']['Tables']['game_sessions']['Insert']>
      }
    }
  }
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

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Event = Database['public']['Tables']['events']['Row']
export type GameSession = Database['public']['Tables']['game_sessions']['Row']

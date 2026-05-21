// Tipos gerados a partir do schema do Supabase
// Após rodar o projeto, atualize com: npx supabase gen types typescript --project-id SEU_PROJECT_ID > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; name: string; email: string; is_admin: boolean; active_pool_id: string | null; created_at: string }
        Insert: { id: string; name: string; email: string; is_admin?: boolean; active_pool_id?: string | null }
        Update: { name?: string; email?: string; is_admin?: boolean; active_pool_id?: string | null }
      }
      pools: {
        Row: { id: string; name: string; owner_id: string; is_default_global: boolean; group_predictions_cutoff_at: string | null; created_at: string }
        Insert: { name: string; owner_id: string; is_default_global?: boolean; group_predictions_cutoff_at?: string | null }
        Update: { name?: string; is_default_global?: boolean; group_predictions_cutoff_at?: string | null }
      }
      pool_members: {
        Row: { pool_id: string; user_id: string; joined_at: string }
        Insert: { pool_id: string; user_id: string }
        Update: Record<string, never>
      }
      rounds: {
        Row: {
          id: string; pool_id: string; name: string
          phase: 'grupos' | 'oitavas' | 'quartas' | 'semi' | 'final' | 'terceiro_lugar'
          created_at: string
        }
        Insert: {
          pool_id: string; name: string
          phase: 'grupos' | 'oitavas' | 'quartas' | 'semi' | 'final' | 'terceiro_lugar'
        }
        Update: { name?: string; phase?: string }
      }
      teams: {
        Row: { id: string; name: string; flag_code: string | null }
        Insert: { name: string; flag_code?: string }
        Update: { name?: string; flag_code?: string }
      }
      groups: {
        Row: { id: string; code: string }
        Insert: { code: string }
        Update: { code?: string }
      }
      matches: {
        Row: {
          id: string; round_id: string; group_id: string | null
          home_team_id: string; away_team_id: string
          home_score: number | null; away_score: number | null
          kickoff_at: string; venue: string; cutoff_at: string; status: 'pendente' | 'encerrado'
        }
        Insert: {
          round_id: string; group_id?: string
          home_team_id: string; away_team_id: string
          kickoff_at: string; venue?: string; cutoff_at?: string; status?: 'pendente' | 'encerrado'
        }
        Update: { home_score?: number; away_score?: number; kickoff_at?: string; venue?: string; cutoff_at?: string; status?: string }
      }
      predictions: {
        Row: {
          id: string; pool_id: string; match_id: string; user_id: string
          home_guess: number; away_guess: number; points: number | null; created_at: string
        }
        Insert: { pool_id: string; match_id: string; user_id: string; home_guess: number; away_guess: number }
        Update: { home_guess?: number; away_guess?: number }
      }
      group_predictions: {
        Row: {
          id: string; pool_id: string; user_id: string; group_id: string
          first_id: string; second_id: string; points: number | null; created_at: string
        }
        Insert: { pool_id: string; user_id: string; group_id: string; first_id: string; second_id: string }
        Update: { first_id?: string; second_id?: string }
      }
    }
    Views: {
      leaderboard: {
        Row: { pool_id: string; user_id: string; user_name: string; total_points: number; rank: number }
      }
    }
    Functions: {
      calculate_match_points: {
        Args: { p_prediction_id: string }
        Returns: number
      }
      calculate_group_bonus_points: {
        Args: { p_group_prediction_id: string }
        Returns: number
      }
    }
    Enums: Record<string, never>
  }
}

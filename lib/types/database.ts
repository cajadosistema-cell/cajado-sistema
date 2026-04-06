// Este arquivo é gerado pelo Supabase CLI.
// Execute: npx supabase gen types typescript --project-id SEU_PROJECT_ID > lib/types/database.ts
// Por ora, usamos um tipo genérico.

export type Database = {
  public: {
    Tables: Record<string, {
      Row: Record<string, unknown>
      Insert: Record<string, unknown>
      Update: Record<string, unknown>
    }>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

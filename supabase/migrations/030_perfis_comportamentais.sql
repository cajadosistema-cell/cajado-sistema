-- Migration 030: Tabela de perfis comportamentais
CREATE TABLE IF NOT EXISTS public.perfis_comportamentais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Perfil Profissional DISC
  disc_dominancia   INTEGER DEFAULT 0 CHECK (disc_dominancia BETWEEN 0 AND 100),
  disc_influencia   INTEGER DEFAULT 0 CHECK (disc_influencia BETWEEN 0 AND 100),
  disc_estabilidade INTEGER DEFAULT 0 CHECK (disc_estabilidade BETWEEN 0 AND 100),
  disc_conformidade INTEGER DEFAULT 0 CHECK (disc_conformidade BETWEEN 0 AND 100),
  disc_perfil_dominante TEXT, -- 'executor','comunicador','planejador','analista'
  -- Perfil Pessoal Temperamentos
  temp_colerico    INTEGER DEFAULT 0 CHECK (temp_colerico BETWEEN 0 AND 100),
  temp_melancolico INTEGER DEFAULT 0 CHECK (temp_melancolico BETWEEN 0 AND 100),
  temp_fleumatico  INTEGER DEFAULT 0 CHECK (temp_fleumatico BETWEEN 0 AND 100),
  temp_sanguineo   INTEGER DEFAULT 0 CHECK (temp_sanguineo BETWEEN 0 AND 100),
  temp_perfil_dominante TEXT,
  -- Metadados
  respondido_em TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.perfis_comportamentais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perfil_select_own" ON public.perfis_comportamentais
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "perfil_insert_own" ON public.perfis_comportamentais
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "perfil_update_own" ON public.perfis_comportamentais
  FOR UPDATE USING (auth.uid() = user_id);

-- Migration 027: Cofre de Senhas com criptografia client-side
-- Os dados sensíveis são criptografados ANTES de chegar ao banco.
-- O Supabase nunca vê a senha mestra nem os dados em texto puro.

CREATE TABLE IF NOT EXISTS public.cofre_senhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  categoria TEXT DEFAULT 'outro',
  -- dados_cifrados contém JSON criptografado com AES-256-GCM via WebCrypto API
  -- formato: { iv: base64, salt: base64, ciphertext: base64 }
  dados_cifrados TEXT NOT NULL,
  -- icone opcional para identificação visual (emoji ou nome)
  icone TEXT DEFAULT '🔐',
  -- favorito para acesso rápido
  favorito BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.cofre_senhas ENABLE ROW LEVEL SECURITY;

-- Apenas o próprio usuário vê suas senhas
CREATE POLICY "cofre_select_own" ON public.cofre_senhas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "cofre_insert_own" ON public.cofre_senhas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cofre_update_own" ON public.cofre_senhas
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "cofre_delete_own" ON public.cofre_senhas
  FOR DELETE USING (auth.uid() = user_id);

-- Index para busca rápida
CREATE INDEX IF NOT EXISTS idx_cofre_user ON public.cofre_senhas (user_id);
CREATE INDEX IF NOT EXISTS idx_cofre_categoria ON public.cofre_senhas (categoria);

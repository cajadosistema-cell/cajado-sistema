-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 040: Perfil de Aprendizado da Elena
-- A Elena aprende com o estilo de comunicação do usuário ao longo do tempo
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS elena_perfil (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Estilo de comunicação aprendido
  estilo_comunicacao    text DEFAULT 'informal',        -- formal | informal | direto | detalhado
  tom_preferido         text DEFAULT 'profissional',    -- profissional | casual | amigavel
  prefere_resposta      text DEFAULT 'concisa',         -- concisa | detalhada | com_exemplos

  -- Vocabulário e expressões que o usuário usa
  expressoes_comuns     jsonb DEFAULT '[]'::jsonb,      -- ["lança lá", "bota na PJ", "esquece"]
  palavras_chave        jsonb DEFAULT '[]'::jsonb,      -- palavras/abreviações frequentes

  -- Padrões de comportamento financeiro
  categorias_frequentes jsonb DEFAULT '{}'::jsonb,      -- {"alimentacao": 15, "transporte": 8}
  contas_preferidas     jsonb DEFAULT '[]'::jsonb,      -- ["Visa", "C6", "Nubank"]
  forma_pagamento_usual text DEFAULT 'pix',             -- forma mais usada

  -- Contexto pessoal aprendido (livre)
  contexto_pessoal      text,                           -- "Empresário, usa muito o C6 Bank PJ, gosta de respostas curtas"
  preferencias_ui       jsonb DEFAULT '{}'::jsonb,      -- outras preferências detectadas

  -- Controle
  total_interacoes      int DEFAULT 0,                  -- total de msgs processadas
  ultima_atualizacao    timestamptz DEFAULT now(),
  created_at            timestamptz DEFAULT now(),

  UNIQUE(user_id)
);

-- RLS: cada usuário vê apenas seu perfil
ALTER TABLE elena_perfil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "elena_perfil_owner" ON elena_perfil
  FOR ALL USING (auth.uid() = user_id);

-- Índice
CREATE INDEX IF NOT EXISTS idx_elena_perfil_user ON elena_perfil(user_id);

-- Comentário
COMMENT ON TABLE elena_perfil IS 'Perfil de aprendizado da Elena — armazena padrões de comunicação do usuário para personalizar respostas';

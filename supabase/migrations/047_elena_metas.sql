-- ============================================================
-- SISTEMA CAJADO - MIGRATION 047
-- Elena: Tabela de metas financeiras (migra de localStorage para banco)
-- Permite verificar metas criadas via SQL e persistir entre dispositivos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.elena_metas (
  id            UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID        REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  categoria     TEXT        NOT NULL,       -- alimentacao, transporte, total, etc.
  valor_limite  NUMERIC     NOT NULL,       -- limite mensal em R$
  periodo       TEXT        DEFAULT 'mes',  -- mes, semana, ano
  ativa         BOOLEAN     DEFAULT true,
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, categoria)               -- uma meta por categoria por usuário
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_elena_metas_user ON public.elena_metas(user_id, ativa);

-- RLS
ALTER TABLE public.elena_metas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario gerencia proprias metas Elena" ON public.elena_metas;

CREATE POLICY "Usuario gerencia proprias metas Elena"
  ON public.elena_metas FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Query de verificação (rode após criar uma meta para confirmar) ──
-- SELECT categoria, valor_limite, periodo, ativa, atualizado_em
-- FROM public.elena_metas
-- WHERE user_id = auth.uid()
-- ORDER BY atualizado_em DESC;

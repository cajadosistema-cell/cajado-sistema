-- ============================================================
-- SISTEMA CAJADO - MIGRATION 048
-- Elena: Tabela híbrida de memória universal (elena_registro)
-- Permite que a Elena salve QUALQUER tipo de informação que
-- não tem tabela própria no sistema. Schema-less via JSONB.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.elena_registro (
  id            UUID        DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID        REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,

  -- Classificação livre (a Elena define)
  tipo          TEXT        NOT NULL DEFAULT 'anotacao',
  -- Exemplos: 'preferencia', 'dado_pessoal', 'regra_negocio',
  --           'anotacao', 'contato', 'acordo', 'lembrete', 'meta'

  -- Chave única legível (ex: 'banco_preferido', 'nome_esposa')
  -- Permite upsert inteligente: atualiza ao invés de duplicar
  chave         TEXT,

  -- Título descritivo (ex: "Banco preferido do Sr. Max")
  titulo        TEXT        NOT NULL,

  -- Conteúdo principal em texto livre
  conteudo      TEXT,

  -- Dados estruturados opcionais (para casos mais complexos)
  dados         JSONB,

  -- Tags para facilitar busca semântica
  tags          TEXT[]      DEFAULT '{}',

  -- Marcado como importante = carrega automaticamente no contexto da Elena
  importante    BOOLEAN     DEFAULT false,

  criado_em     TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: uma chave única por usuário (permite upsert)
-- OBS: registros sem chave (chave IS NULL) podem existir múltiplos
CREATE UNIQUE INDEX IF NOT EXISTS idx_elena_registro_chave
  ON public.elena_registro (user_id, chave)
  WHERE chave IS NOT NULL;

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_elena_registro_user      ON public.elena_registro (user_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_elena_registro_tipo      ON public.elena_registro (user_id, tipo);
CREATE INDEX IF NOT EXISTS idx_elena_registro_importante ON public.elena_registro (user_id, importante) WHERE importante = true;

-- Índice de texto completo para busca por conteúdo
CREATE INDEX IF NOT EXISTS idx_elena_registro_fts
  ON public.elena_registro USING gin(to_tsvector('portuguese', coalesce(titulo,'') || ' ' || coalesce(conteudo,'')));

-- RLS
ALTER TABLE public.elena_registro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario gerencia propria memoria Elena" ON public.elena_registro;

CREATE POLICY "Usuario gerencia propria memoria Elena"
  ON public.elena_registro FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Queries úteis para verificação ────────────────────────────
-- Ver toda a memória da Elena:
-- SELECT tipo, chave, titulo, conteudo, importante, criado_em
-- FROM public.elena_registro
-- ORDER BY importante DESC, criado_em DESC;
--
-- Ver só os importantes (carregados automaticamente no contexto):
-- SELECT chave, titulo, conteudo FROM public.elena_registro WHERE importante = true;
--
-- Buscar por tipo:
-- SELECT * FROM public.elena_registro WHERE tipo = 'preferencia';

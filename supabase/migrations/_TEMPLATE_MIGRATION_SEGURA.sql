-- ============================================================
-- TEMPLATE SEGURO DE MIGRATION — Cajado Sistema
-- ============================================================
-- Copie este template para toda nova migration.
-- Siga OBRIGATORIAMENTE o processo abaixo.
--
-- PROCESSO ANTES DE RODAR NO PRODUÇÃO:
--   1. node backup-antes-de-migrar.js   (gera backup em /backups/)
--   2. Teste no Supabase SQL Editor com uma query SELECT primeiro
--   3. Execute a migration
--   4. Verifique com a query SELECT de verificação no final
--   5. Se algo errou: node restaurar-backup.js latest
-- ============================================================

-- ── BLOCO 1: Modificações de estrutura (sempre seguras) ──────
-- Use sempre IF NOT EXISTS / IF EXISTS para ser idempotente

ALTER TABLE public.nome_tabela
  ADD COLUMN IF NOT EXISTS nova_coluna TIPO DEFAULT valor;

-- ── BLOCO 2: Migrar dados existentes (sem perda) ─────────────
-- Sempre preenche dados antes de adicionar NOT NULL

UPDATE public.nome_tabela
SET nova_coluna = valor_padrao
WHERE nova_coluna IS NULL;

-- ── BLOCO 3: Constraints (só depois de popular dados) ─────────

-- ALTER TABLE public.nome_tabela ALTER COLUMN nova_coluna SET NOT NULL;

-- ── BLOCO 4: Índices ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_nome_tabela_nova_coluna
  ON public.nome_tabela(nova_coluna);

-- ── BLOCO 5: Policies RLS ─────────────────────────────────────
-- Sempre dropa a antiga antes de criar a nova

DROP POLICY IF EXISTS "nome_policy_antiga" ON public.nome_tabela;
CREATE POLICY "nome_policy_nova" ON public.nome_tabela
  FOR ALL TO authenticated
  USING  (condição)
  WITH CHECK (condição);

-- ── BLOCO 6: Verificação final ────────────────────────────────
-- SEMPRE inclua uma query de verificação que confirme o sucesso

SELECT
  COUNT(*)                           AS total,
  COUNT(nova_coluna)                 AS com_valor,
  COUNT(*) - COUNT(nova_coluna)      AS sem_valor_null
FROM public.nome_tabela;

-- ============================================================
-- Resultado esperado: sem_valor_null = 0
-- ============================================================

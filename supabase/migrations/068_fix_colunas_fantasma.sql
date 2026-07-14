-- ════════════════════════════════════════════════════════════════
-- 068_fix_colunas_fantasma.sql
--
-- A auditoria de schema (código vs banco) encontrou colunas que a Elena
-- USA e o banco NÃO TEM. Mesmo padrão do bug `limite_credito`: a query
-- falha com ERRO 42703 e a funcionalidade morre em silêncio.
--
-- 🔴 diario_entradas.gratidao / .intencao
--    O prompt INSTRUI a IA a enviar esses campos:
--       "gratidao" e "intencao" = campos especiais para tipo "espiritual"
--    O handler grava:  gratidao: acao.dados.gratidao || null
--    E o buscar lê:    .select('... gratidao, intencao ...')
--
--    Como as colunas não existem, TODO registro de diário espiritual
--    falhava, e listar o diário também. A funcionalidade nunca funcionou.
--
-- Estas colunas são features reais (a IA já sabe preenchê-las), então
-- criamos as colunas em vez de remover o recurso.
-- ════════════════════════════════════════════════════════════════

-- ── PASSO 1 — DIAGNÓSTICO (leitura) ─────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'diario_entradas'
ORDER BY ordinal_position;


-- ── PASSO 2 — CRIAR AS COLUNAS ──────────────────────────────────
ALTER TABLE diario_entradas
  ADD COLUMN IF NOT EXISTS gratidao text;

ALTER TABLE diario_entradas
  ADD COLUMN IF NOT EXISTS intencao text;

COMMENT ON COLUMN diario_entradas.gratidao IS
  'Pelo que o usuário é grato — preenchido pela Elena em entradas do tipo "espiritual"';
COMMENT ON COLUMN diario_entradas.intencao IS
  'Intenção/oração do dia — preenchido pela Elena em entradas do tipo "espiritual"';


-- ── PASSO 3 — CONFERÊNCIA ───────────────────────────────────────
-- As duas devem aparecer:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'diario_entradas'
  AND column_name IN ('gratidao', 'intencao');

-- E rode de novo o AUDITORIA_schema.sql — as linhas de diario_entradas
-- devem sumir. Deve sobrar apenas imoveis.financiado (tratado à parte).

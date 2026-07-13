-- ════════════════════════════════════════════════════════════════
-- 063_merge_cartoes_nome_variante.sql
--
-- O 062 deduplicou nomes IDÊNTICOS. Mas o problema real era outro:
-- a Elena criava um cartão NOVO toda vez que o NOME variava um pouco
-- (ditado por voz: "Nubank" virava "no Bank"). O mesmo cartão ficou
-- PARTIDO EM DOIS, cada metade com uma parte dos dados:
--
--   Nubank    | venc 15 | limite NULL |  ← tem a data
--   no Bank   | venc NULL| limite 5000 |  ← tem o limite
--
-- Por isso a Elena "voltava a perguntar a data": ela encontrava o
-- registro que estava sem ela.
--
-- Este script junta os pares confirmados e apaga o lixo de teste.
--
-- ⚠️ BACKUP ANTES: Supabase → Database → Backups
-- ════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────
-- ⚙️ CONFLITO A RESOLVER — LEIA ANTES DE RODAR
--
-- "C6" tem dia_vencimento = 25
-- "C6 Bank" tem dia_vencimento = 10
--
-- Só um está certo. Escolha o correto na linha abaixo (PASSO 2.2).
-- Deixei 10 como padrão (é o do registro mais completo, que também
-- tem o limite de 3000). Se o certo for 25, troque.
-- ────────────────────────────────────────────────────────────────


-- ────────────────────────────────────────────────────────────────
-- PASSO 1 — CONFERIR o estado atual (leitura, seguro)
-- ────────────────────────────────────────────────────────────────
SELECT id, nome, tipo, categoria, dia_vencimento, dia_fechamento, limite, bandeira, created_at
FROM contas
WHERE lower(trim(nome)) IN ('nubank','no bank','c6','c6 bank','teste','debug card','xp')
ORDER BY nome, created_at;


-- ────────────────────────────────────────────────────────────────
-- PASSO 2 — MERGE + LIMPEZA
-- ────────────────────────────────────────────────────────────────
BEGIN;

-- ═══ 2.1 — NUBANK: junta "no Bank" dentro de "Nubank" ═══════════
-- Nubank fica com: vencimento 15 (dele) + limite 5000 (do "no Bank")
-- Bandeira: mantém mastercard (do Nubank). O "no Bank" dizia visa,
-- mas Nubank é Mastercard — o "visa" foi um chute da IA.

CREATE TEMP TABLE _merge_nubank ON COMMIT DROP AS
SELECT
  (SELECT id FROM contas WHERE lower(trim(nome)) = 'nubank'  AND tipo = 'cartao_credito' LIMIT 1) AS manter_id,
  (SELECT id FROM contas WHERE lower(trim(nome)) = 'no bank' AND tipo = 'cartao_credito' LIMIT 1) AS remover_id;

-- Puxa os dados que só existem no "no Bank"
UPDATE contas alvo
SET limite         = COALESCE(alvo.limite,         fonte.limite),
    dia_vencimento = COALESCE(alvo.dia_vencimento, fonte.dia_vencimento),
    dia_fechamento = COALESCE(alvo.dia_fechamento, fonte.dia_fechamento)
FROM contas fonte, _merge_nubank m
WHERE alvo.id = m.manter_id AND fonte.id = m.remover_id;

-- Reaponta lançamentos/gastos que apontavam para o "no Bank"
DO $$
DECLARE r RECORD; n BIGINT;
BEGIN
  FOR r IN
    SELECT con.conrelid::regclass::text AS tabela, att.attname AS coluna
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f' AND con.confrelid = 'contas'::regclass
      AND array_length(con.conkey, 1) = 1
  LOOP
    EXECUTE format(
      'UPDATE %s t SET %I = m.manter_id FROM _merge_nubank m WHERE t.%I = m.remover_id',
      r.tabela, r.coluna, r.coluna);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE NOTICE '[Nubank] reapontadas % linha(s) em %.%', n, r.tabela, r.coluna; END IF;
  END LOOP;
END $$;

DELETE FROM contas WHERE id = (SELECT remover_id FROM _merge_nubank);


-- ═══ 2.2 — C6: junta "C6" dentro de "C6 Bank" ═══════════════════
-- Mantemos "C6 Bank" (é o registro com limite 3000).
-- ⚙️ CONFLITO: C6 dizia venc 25, C6 Bank diz venc 10.
--    Deixei o 10 (do C6 Bank). Se o correto for 25, mude o número
--    na linha marcada com  <<< AJUSTE AQUI  logo abaixo.

CREATE TEMP TABLE _merge_c6 ON COMMIT DROP AS
SELECT
  (SELECT id FROM contas WHERE lower(trim(nome)) = 'c6 bank' AND tipo = 'cartao_credito' LIMIT 1) AS manter_id,
  (SELECT id FROM contas WHERE lower(trim(nome)) = 'c6'      AND tipo = 'cartao_credito' LIMIT 1) AS remover_id;

UPDATE contas alvo
SET limite         = COALESCE(alvo.limite,         fonte.limite),
    dia_fechamento = COALESCE(alvo.dia_fechamento, fonte.dia_fechamento),
    dia_vencimento = 10   -- <<< AJUSTE AQUI (10 do "C6 Bank" ou 25 do "C6")
FROM contas fonte, _merge_c6 m
WHERE alvo.id = m.manter_id AND fonte.id = m.remover_id;

DO $$
DECLARE r RECORD; n BIGINT;
BEGIN
  FOR r IN
    SELECT con.conrelid::regclass::text AS tabela, att.attname AS coluna
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f' AND con.confrelid = 'contas'::regclass
      AND array_length(con.conkey, 1) = 1
  LOOP
    EXECUTE format(
      'UPDATE %s t SET %I = m.manter_id FROM _merge_c6 m WHERE t.%I = m.remover_id',
      r.tabela, r.coluna, r.coluna);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE NOTICE '[C6] reapontadas % linha(s) em %.%', n, r.tabela, r.coluna; END IF;
  END LOOP;
END $$;

DELETE FROM contas WHERE id = (SELECT remover_id FROM _merge_c6);

-- Renomeia "C6 Bank" para "C6" (nome mais natural pra falar)
UPDATE contas SET nome = 'C6'
WHERE id = (SELECT manter_id FROM _merge_c6);


-- ═══ 2.3 — LIXO DE TESTE: apagar ════════════════════════════════
-- Confirmados como descartáveis: teste (pf), teste (pj), Debug Card (pj), XP
-- Primeiro solta as FKs (se algum gasto apontava pra eles, vira NULL)

CREATE TEMP TABLE _lixo ON COMMIT DROP AS
SELECT id FROM contas
WHERE lower(trim(nome)) IN ('teste', 'debug card', 'xp');

DO $$
DECLARE r RECORD; n BIGINT;
BEGIN
  FOR r IN
    SELECT con.conrelid::regclass::text AS tabela, att.attname AS coluna
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f' AND con.confrelid = 'contas'::regclass
      AND array_length(con.conkey, 1) = 1
  LOOP
    EXECUTE format(
      'UPDATE %s t SET %I = NULL FROM _lixo l WHERE t.%I = l.id',
      r.tabela, r.coluna, r.coluna);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE NOTICE '[Lixo] desvinculadas % linha(s) em %.%', n, r.tabela, r.coluna; END IF;
  END LOOP;
END $$;

DELETE FROM contas WHERE id IN (SELECT id FROM _lixo);

COMMIT;


-- ────────────────────────────────────────────────────────────────
-- PASSO 3 — CONFERÊNCIA
-- Devem sobrar ~11 cartões, cada um com nome único.
-- Nubank deve estar com venc 15 E limite 5000 (dados juntos!).
-- ────────────────────────────────────────────────────────────────
SELECT nome, categoria, dia_vencimento, dia_fechamento, limite, bandeira
FROM contas
WHERE tipo IN ('cartao_credito', 'cartao_debito')
ORDER BY nome;

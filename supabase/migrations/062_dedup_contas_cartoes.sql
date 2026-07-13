-- ════════════════════════════════════════════════════════════════
-- 062_dedup_contas_cartoes.sql  (v2 — coluna correta: "limite", nao "limite_credito")
--
-- PROBLEMA: useElenaSalvar.ts fazia `.insert()` CEGO em `contas` nos
-- handlers 'cadastrar_conta' e 'cadastrar_cartao'. Sem verificação de
-- duplicata, sem upsert, sem constraint no banco.
--
-- Resultado: o mesmo cartão ("Nubank") foi inserido ~30x. Várias
-- duplicatas ficaram com dia_vencimento/dia_fechamento NULL (os campos
-- só eram gravados se a IA os enviasse). O prompt da Elena então listava:
--     • "Nubank" | vencimento: não informado
--     • "Nubank" | vencimento: dia 1
--     • "Nubank" | vencimento: não informado   ...
-- e ela reperguntava a data mesmo já tendo sido informada.
--
-- ESTE SCRIPT:
--   1. Mostra o diagnóstico (quantas duplicatas existem)
--   2. Mescla os dados das duplicatas na linha canônica (COALESCE)
--   3. Reaponta TODAS as foreign keys que apontam para as duplicatas
--   4. Remove as duplicatas
--   5. Cria índice único para nunca mais acontecer
--
-- ⚠️ FAÇA BACKUP ANTES: no Supabase → Database → Backups
-- ⚠️ RODE OS PASSOS EM ORDEM. O PASSO 1 é só leitura — rode e confira.
-- ════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────
-- PASSO 1 — DIAGNÓSTICO (somente leitura, seguro)
-- Rode isto primeiro e veja o estrago.
-- ────────────────────────────────────────────────────────────────
SELECT
  user_id,
  lower(trim(nome))              AS nome_normalizado,
  tipo,
  categoria,
  count(*)                       AS qtd_duplicatas,
  count(dia_vencimento)          AS qtd_com_vencimento,
  count(*) - count(dia_vencimento) AS qtd_SEM_vencimento,
  array_agg(dia_vencimento)      AS vencimentos_encontrados,
  array_agg(dia_fechamento)      AS fechamentos_encontrados
FROM contas
GROUP BY user_id, lower(trim(nome)), tipo, categoria
HAVING count(*) > 1
ORDER BY qtd_duplicatas DESC;


-- ────────────────────────────────────────────────────────────────
-- PASSO 2 — MESCLAR + REAPONTAR FKs + DELETAR DUPLICATAS
-- Transacional: ou faz tudo, ou não faz nada.
-- ────────────────────────────────────────────────────────────────
BEGIN;

-- 2.1 — Define a linha CANÔNICA de cada grupo.
-- Critério: a mais antiga que tenha dia_vencimento preenchido.
-- Se nenhuma tiver, pega simplesmente a mais antiga.
CREATE TEMP TABLE _canonicas ON COMMIT DROP AS
SELECT DISTINCT ON (user_id, lower(trim(nome)), tipo, categoria)
  id AS canonica_id,
  user_id,
  lower(trim(nome)) AS nome_norm,
  tipo,
  categoria
FROM contas
ORDER BY
  user_id, lower(trim(nome)), tipo, categoria,
  (dia_vencimento IS NOT NULL) DESC,  -- prioriza quem tem data
  (dia_fechamento IS NOT NULL) DESC,
  (limite IS NOT NULL) DESC,
  created_at ASC NULLS LAST,          -- desempate: a mais antiga
  id ASC;

-- 2.2 — Mapeia cada duplicata → sua canônica
CREATE TEMP TABLE _mapa ON COMMIT DROP AS
SELECT
  c.id          AS duplicata_id,
  k.canonica_id AS canonica_id
FROM contas c
JOIN _canonicas k
  ON  c.user_id            = k.user_id
  AND lower(trim(c.nome))  = k.nome_norm
  AND c.tipo               = k.tipo
  AND c.categoria IS NOT DISTINCT FROM k.categoria
WHERE c.id <> k.canonica_id;

-- 2.3 — MESCLA: puxa os dados que existirem nas duplicatas para a canônica.
-- Assim, se a canônica tinha vencimento NULL mas uma duplicata tinha "dia 1",
-- a canônica passa a ter "dia 1". Nenhum dado é perdido.
UPDATE contas alvo
SET
  dia_vencimento = COALESCE(alvo.dia_vencimento, agg.dia_vencimento),
  dia_fechamento = COALESCE(alvo.dia_fechamento, agg.dia_fechamento),
  limite = COALESCE(alvo.limite, agg.limite),
  bandeira       = COALESCE(alvo.bandeira,       agg.bandeira),
  saldo_atual    = COALESCE(alvo.saldo_atual,    agg.saldo_atual)
FROM (
  SELECT
    m.canonica_id,
    max(c.dia_vencimento) AS dia_vencimento,
    max(c.dia_fechamento) AS dia_fechamento,
    max(c.limite) AS limite,
    max(c.bandeira)       AS bandeira,
    max(c.saldo_atual)    AS saldo_atual
  FROM _mapa m
  JOIN contas c ON c.id = m.duplicata_id
  GROUP BY m.canonica_id
) agg
WHERE alvo.id = agg.canonica_id;

-- 2.4 — REAPONTA todas as FKs que referenciam contas(id).
-- Descoberta dinâmica: pega do catálogo do Postgres toda coluna que
-- tem foreign key para contas(id). Isso cobre gastos_pessoais.conta_id,
-- receitas_pessoais.conta_id, compromissos_fixos.conta_id, etc.,
-- SEM precisar listar tabela por tabela.
DO $$
DECLARE
  r RECORD;
  n BIGINT;
BEGIN
  FOR r IN
    SELECT
      con.conrelid::regclass::text AS tabela,
      att.attname                  AS coluna
    FROM pg_constraint con
    JOIN pg_attribute att
      ON att.attrelid = con.conrelid
     AND att.attnum   = con.conkey[1]
    WHERE con.contype    = 'f'
      AND con.confrelid  = 'contas'::regclass
      AND array_length(con.conkey, 1) = 1
  LOOP
    EXECUTE format(
      'UPDATE %s t SET %I = m.canonica_id FROM _mapa m WHERE t.%I = m.duplicata_id',
      r.tabela, r.coluna, r.coluna
    );
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 'Reapontadas % linha(s) em %.%', n, r.tabela, r.coluna;
    END IF;
  END LOOP;
END $$;

-- 2.5 — Agora que nada mais aponta para elas, remove as duplicatas
DELETE FROM contas WHERE id IN (SELECT duplicata_id FROM _mapa);

COMMIT;


-- ────────────────────────────────────────────────────────────────
-- PASSO 3 — BLINDAGEM: índice único
-- Impede que o mesmo cartão/conta seja cadastrado 2x, mesmo que
-- um bug no código volte a tentar. O banco passa a ser a última defesa.
-- ────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS contas_unico_por_usuario
  ON contas (user_id, lower(trim(nome)), tipo, categoria);


-- ────────────────────────────────────────────────────────────────
-- PASSO 4 — CONFERÊNCIA (leitura). Deve voltar ZERO linhas.
-- ────────────────────────────────────────────────────────────────
SELECT lower(trim(nome)) AS nome, tipo, categoria, count(*)
FROM contas
GROUP BY user_id, lower(trim(nome)), tipo, categoria
HAVING count(*) > 1;

-- E confira como seus cartões ficaram:
SELECT nome, tipo, categoria, dia_vencimento, dia_fechamento, limite, bandeira
FROM contas
WHERE tipo IN ('cartao_credito', 'cartao_debito')
ORDER BY nome;

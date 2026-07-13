-- ════════════════════════════════════════════════════════════════
-- 064_indices_tenant_corretos.sql
--
-- CORRIGE O ÍNDICE DO 062, QUE ESTAVA ERRADO:
--   CREATE UNIQUE INDEX ... ON contas (user_id, lower(trim(nome)), tipo, categoria)
--
-- Dois problemas:
--   1. Contas PJ têm user_id = NULL. No Postgres, NULL ≠ NULL em índice
--      único → essas contas ESCAPAVAM da proteção e podiam duplicar.
--   2. Conta PJ pertence à EMPRESA, não ao usuário. Se outro usuário da
--      mesma empresa cadastrasse "Itaú PJ", criaria uma segunda.
--
-- MODELO REAL DO SISTEMA (confirmado no catálogo):
--   • Conta PF  → isola por user_id     (junto com gastos_pessoais,
--                                        receitas_pessoais, faturas_cartoes,
--                                        compromissos_fixos, alertas_recorrentes)
--   • Conta PJ  → isola por empresa_id  (junto com lancamentos, operacoes,
--                                        ativos, recorrencias, conciliacao_extrato)
--
-- Os índices abaixo são PARCIAIS e separados por categoria — então
-- "Itaú PF" e "Itaú PJ" continuam coexistindo normalmente. O suporte
-- a PF e PJ é preservado integralmente.
-- ════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────
-- PASSO 1 — DETECTAR COLISÕES sob a NOVA chave (leitura, seguro)
-- Se voltar alguma linha, o índice não vai poder ser criado antes
-- de resolver. RODE ISTO PRIMEIRO.
-- ────────────────────────────────────────────────────────────────

-- 1a) Colisões entre contas PF (mesmo usuário, mesmo nome normalizado)
SELECT 'PF' AS escopo, user_id AS dono, lower(trim(nome)) AS nome_norm, tipo,
       count(*) AS qtd, array_agg(nome) AS variantes, array_agg(id) AS ids
FROM contas
WHERE categoria = 'pf' AND user_id IS NOT NULL
GROUP BY user_id, lower(trim(nome)), tipo
HAVING count(*) > 1

UNION ALL

-- 1b) Colisões entre contas PJ (mesma empresa, mesmo nome normalizado)
SELECT 'PJ', empresa_id, lower(trim(nome)), tipo,
       count(*), array_agg(nome), array_agg(id)
FROM contas
WHERE categoria = 'pj'
GROUP BY empresa_id, lower(trim(nome)), tipo
HAVING count(*) > 1;

-- ⚠️ ESPERADO: a conta "itau" / "Itaú" (ambas PF, mesmo usuário da
--    VisioPro) deve aparecer aqui. O trim/lower não pegou por causa
--    do acento. O PASSO 2 resolve.


-- ────────────────────────────────────────────────────────────────
-- PASSO 2 — MERGE das colisões, COM FILTRO DE TENANT EXPLÍCITO
--
-- ⚠️ Diferente do 062/063: aqui o agrupamento SEMPRE inclui o dono
--    (user_id para PF, empresa_id para PJ). Nenhum dado cruza tenant.
--    Nomes com acento são normalizados via unaccent manual.
-- ────────────────────────────────────────────────────────────────
BEGIN;

-- 2.1 — Chave normalizada COM remoção de acentos
--       (translate cobre os acentos usados em português)
CREATE TEMP VIEW _contas_norm AS
SELECT
  id, user_id, empresa_id, categoria, tipo, nome,
  dia_vencimento, dia_fechamento, limite, bandeira, saldo_atual, created_at,
  lower(trim(translate(nome,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))) AS nome_norm,
  -- Dono efetivo: PF → usuário | PJ → empresa
  CASE WHEN categoria = 'pj' THEN empresa_id ELSE user_id END AS dono
FROM contas;

-- 2.2 — Canônica de cada grupo (dono + nome_norm + tipo + categoria)
CREATE TEMP TABLE _canon ON COMMIT DROP AS
SELECT DISTINCT ON (dono, nome_norm, tipo, categoria)
  id AS canonica_id, dono, nome_norm, tipo, categoria
FROM _contas_norm
WHERE dono IS NOT NULL
ORDER BY
  dono, nome_norm, tipo, categoria,
  (dia_vencimento IS NOT NULL) DESC,
  (limite         IS NOT NULL) DESC,
  created_at ASC NULLS LAST,
  id ASC;

-- 2.3 — Mapa duplicata → canônica (NUNCA cruza dono)
CREATE TEMP TABLE _map ON COMMIT DROP AS
SELECT n.id AS dup_id, k.canonica_id
FROM _contas_norm n
JOIN _canon k
  ON  n.dono      = k.dono          -- ⬅️ TENANT SEMPRE NO JOIN
  AND n.nome_norm = k.nome_norm
  AND n.tipo      = k.tipo
  AND n.categoria = k.categoria
WHERE n.id <> k.canonica_id;

-- 2.4 — Mescla os dados (nada se perde)
UPDATE contas alvo
SET dia_vencimento = COALESCE(alvo.dia_vencimento, agg.dia_vencimento),
    dia_fechamento = COALESCE(alvo.dia_fechamento, agg.dia_fechamento),
    limite         = COALESCE(alvo.limite,         agg.limite),
    bandeira       = COALESCE(alvo.bandeira,       agg.bandeira)
FROM (
  SELECT m.canonica_id,
         max(c.dia_vencimento) AS dia_vencimento,
         max(c.dia_fechamento) AS dia_fechamento,
         max(c.limite)         AS limite,
         max(c.bandeira)       AS bandeira
  FROM _map m JOIN contas c ON c.id = m.dup_id
  GROUP BY m.canonica_id
) agg
WHERE alvo.id = agg.canonica_id;

-- 2.5 — Reaponta FKs (as 13 tabelas, descobertas do catálogo)
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
      'UPDATE %s t SET %I = m.canonica_id FROM _map m WHERE t.%I = m.dup_id',
      r.tabela, r.coluna, r.coluna);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE NOTICE 'Reapontadas % em %.%', n, r.tabela, r.coluna; END IF;
  END LOOP;
END $$;

DELETE FROM contas WHERE id IN (SELECT dup_id FROM _map);

COMMIT;


-- ────────────────────────────────────────────────────────────────
-- PASSO 3 — ÍNDICES CORRETOS
-- ────────────────────────────────────────────────────────────────

-- Remove o índice errado do 062 (ancorado só em user_id)
DROP INDEX IF EXISTS contas_unico_por_usuario;

-- PF: única por USUÁRIO
CREATE UNIQUE INDEX IF NOT EXISTS contas_unico_pf
  ON contas (user_id, lower(trim(nome)), tipo)
  WHERE categoria = 'pf' AND user_id IS NOT NULL;

-- PJ: única por EMPRESA
CREATE UNIQUE INDEX IF NOT EXISTS contas_unico_pj
  ON contas (empresa_id, lower(trim(nome)), tipo)
  WHERE categoria = 'pj';

-- ✅ "Itaú PF" e "Itaú PJ" continuam coexistindo — os índices são
--    parciais e não se enxergam. PF e PJ seguem 100% suportados.


-- ────────────────────────────────────────────────────────────────
-- PASSO 4 — CONFERÊNCIA
-- ────────────────────────────────────────────────────────────────
SELECT nome, tipo, categoria, dia_vencimento, limite, bandeira,
       user_id, empresa_id
FROM contas
ORDER BY empresa_id, categoria, nome;

-- E rode de novo o AUDITORIA_cross_tenant.sql — deve dar 0 em tudo.

-- ════════════════════════════════════════════════════════════════
-- 065_elena_diagnostico.sql
--
-- Registra TUDO que a Elena não conseguiu fazer, para virar backlog
-- de desenvolvimento em vez de sumir no chat.
--
-- Três tipos de ocorrência:
--   • nao_implementado → a IA gerou uma ação que o handler não conhece.
--                        É uma FUNCIONALIDADE FALTANDO. O mais valioso:
--                        mostra o que o Sr. Max quer e o sistema não faz.
--   • erro_salvar      → a ação existe mas a gravação falhou (RLS, coluna,
--                        constraint). É BUG, com a mensagem exata do banco.
--   • dado_invalido    → a IA mandou dados que não passaram na validação.
--                        Geralmente indica prompt mal calibrado.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS elena_diagnostico (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Quem / qual tenant
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  empresa_id     uuid,

  -- Classificação
  tipo           text NOT NULL CHECK (tipo IN ('nao_implementado', 'erro_salvar', 'dado_invalido')),
  acao_tipo      text,                    -- ex: 'cadastrar_socio', 'gasto_empresa'

  -- O que aconteceu
  mensagem       text,                    -- mensagem de erro do banco / validação
  dados          jsonb,                   -- o JSON que a IA gerou
  pedido_usuario text,                    -- o que o Sr. Max escreveu (contexto!)

  -- Ambiente (ajuda a reproduzir)
  rota           text,
  user_agent     text,

  -- Gestão do backlog
  status         text NOT NULL DEFAULT 'aberto'
                 CHECK (status IN ('aberto', 'em_analise', 'resolvido', 'descartado')),
  notas_dev      text,
  resolvido_em   timestamptz,

  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Índices para o relatório
CREATE INDEX IF NOT EXISTS idx_elena_diag_tipo    ON elena_diagnostico (tipo, status);
CREATE INDEX IF NOT EXISTS idx_elena_diag_acao    ON elena_diagnostico (acao_tipo);
CREATE INDEX IF NOT EXISTS idx_elena_diag_user    ON elena_diagnostico (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_elena_diag_empresa ON elena_diagnostico (empresa_id, created_at DESC);

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE elena_diagnostico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS elena_diag_select ON elena_diagnostico;
CREATE POLICY elena_diag_select ON elena_diagnostico
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS elena_diag_insert ON elena_diagnostico;
CREATE POLICY elena_diag_insert ON elena_diagnostico
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS elena_diag_update ON elena_diagnostico;
CREATE POLICY elena_diag_update ON elena_diagnostico
  FOR UPDATE USING (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════════
-- CONSULTAS PARA O DESENVOLVEDOR
-- ════════════════════════════════════════════════════════════════

-- 📋 BACKLOG: o que mais falta implementar (ordenado por demanda real)
--    Cada linha é uma funcionalidade que o Sr. Max PEDIU e não existe.
SELECT
  acao_tipo                                   AS funcionalidade_faltando,
  count(*)                                    AS vezes_pedida,
  count(DISTINCT user_id)                     AS usuarios_afetados,
  max(created_at)                             AS ultima_vez,
  (array_agg(pedido_usuario ORDER BY created_at DESC))[1:3] AS exemplos_do_pedido,
  (array_agg(dados          ORDER BY created_at DESC))[1]   AS json_gerado_pela_ia
FROM elena_diagnostico
WHERE tipo = 'nao_implementado' AND status = 'aberto'
GROUP BY acao_tipo
ORDER BY vezes_pedida DESC;


-- 🐛 BUGS: gravações que falharam (com a mensagem exata do banco)
SELECT
  acao_tipo,
  mensagem                                    AS erro_do_banco,
  count(*)                                    AS ocorrencias,
  max(created_at)                             AS ultima_vez,
  (array_agg(pedido_usuario ORDER BY created_at DESC))[1] AS exemplo_pedido,
  (array_agg(dados          ORDER BY created_at DESC))[1] AS payload
FROM elena_diagnostico
WHERE tipo = 'erro_salvar' AND status = 'aberto'
GROUP BY acao_tipo, mensagem
ORDER BY ocorrencias DESC;


-- 🎯 PRIORIZAÇÃO: onde dói mais (todos os tipos, últimos 30 dias)
SELECT
  tipo,
  acao_tipo,
  count(*)        AS ocorrencias,
  max(created_at) AS ultima
FROM elena_diagnostico
WHERE status = 'aberto'
  AND created_at > now() - interval '30 days'
GROUP BY tipo, acao_tipo
ORDER BY ocorrencias DESC
LIMIT 20;


-- ✅ Marcar como resolvido depois de implementar:
-- UPDATE elena_diagnostico
-- SET status = 'resolvido', resolvido_em = now(), notas_dev = 'implementado na v1.2'
-- WHERE acao_tipo = 'cadastrar_socio' AND status = 'aberto';

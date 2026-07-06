-- ============================================================
-- SISTEMA CAJADO - MIGRATION 061
-- Unifica alertas_recorrentes com compromissos_fixos.
-- Adiciona colunas de compatibilidade e migra dados existentes.
-- ============================================================

-- 1) Adicionar coluna tipo_detalhe para preservar o tipo específico
--    (agua, energia, internet, telefone, etc.)
ALTER TABLE public.compromissos_fixos
  ADD COLUMN IF NOT EXISTS tipo_detalhe TEXT DEFAULT 'outro'
    CHECK (tipo_detalhe IN (
      'boleto','cartao','agua','energia','internet','telefone',
      'aluguel','condominio','plano_saude','financiamento','outro'
    ));

-- 2) Flag para saber se foi criado pela Elena
ALTER TABLE public.compromissos_fixos
  ADD COLUMN IF NOT EXISTS criado_pela_elena BOOLEAN DEFAULT FALSE;

-- 3) Migrar dados de alertas_recorrentes → compromissos_fixos
--    Usa INSERT ... ON CONFLICT para evitar duplicatas
--    Mapeia tipo → categoria:
--      cartao → cartao
--      financiamento, aluguel, condominio → boleto_imovel
--      agua, energia, internet, telefone, plano_saude → conta_fixa
--      boleto, outro → outro
INSERT INTO public.compromissos_fixos (
  user_id, categoria, descricao, valor, dia_vencimento,
  recorrente, ativo, conta_id, tipo_detalhe, criado_pela_elena,
  metadados, created_at, updated_at
)
SELECT
  ar.user_id,
  CASE
    WHEN ar.tipo = 'cartao' THEN 'cartao'
    WHEN ar.tipo IN ('financiamento', 'aluguel', 'condominio') THEN 'boleto_imovel'
    WHEN ar.tipo IN ('agua', 'energia', 'internet', 'telefone', 'plano_saude') THEN 'conta_fixa'
    ELSE 'outro'
  END AS categoria,
  ar.descricao,
  COALESCE(ar.valor, 0),
  ar.dia_vencimento,
  true,                      -- recorrente = sempre true
  ar.ativo,
  ar.conta_id,
  ar.tipo,                   -- preserva tipo original
  ar.criado_pela_elena,
  jsonb_build_object(
    'migrado_de', 'alertas_recorrentes',
    'alerta_id_original', ar.id,
    'categoria_original', ar.categoria
  ),
  ar.created_at,
  ar.updated_at
FROM public.alertas_recorrentes ar
WHERE NOT EXISTS (
  -- Evita duplicar se já existir compromisso com mesma descricao + user_id
  SELECT 1 FROM public.compromissos_fixos cf
  WHERE cf.user_id = ar.user_id
    AND cf.descricao = ar.descricao
    AND cf.dia_vencimento = ar.dia_vencimento
);

-- 4) Trigger updated_at para compromissos_fixos (se não existir)
CREATE OR REPLACE FUNCTION update_compromissos_fixos_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compromissos_fixos_updated_at ON compromissos_fixos;

CREATE TRIGGER trg_compromissos_fixos_updated_at
  BEFORE UPDATE ON compromissos_fixos
  FOR EACH ROW EXECUTE FUNCTION update_compromissos_fixos_updated_at();

-- 5) Comentário atualizado
COMMENT ON TABLE public.compromissos_fixos IS
  'Tabela unificada de contas fixas/recorrentes. Usada pela Elena (IA) e pela UI TabControleUnificado. Substitui alertas_recorrentes.';

-- Verificação
SELECT 'Migration 061 OK — compromissos_fixos unificado' AS status;

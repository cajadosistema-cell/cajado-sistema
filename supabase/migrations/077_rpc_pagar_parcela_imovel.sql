-- ============================================================
-- SISTEMA CAJADO - MIGRATION 077
-- Pagamento de parcela de imóvel de forma ATÔMICA.
--
-- Motivo: o modal "Pagar Boleto" (TabImoveis.tsx) executava 4
-- operações em sequência, sem transação:
--   1) insert em lancamentos  2) debita contas.saldo_atual
--   3) incrementa imoveis.parcelas_pagas  4) grava pagamentos_imoveis
-- Quando a 4ª falhava (coluna `notas` inexistente), as 3 primeiras
-- já tinham sido gravadas -> débito órfão + parcela avançada
-- sem boleto pago. Aconteceu em 100% das tentativas.
--
-- Esta função faz as 4 numa transação só: ou tudo grava, ou nada.
-- Também corrige a corrida de saldo (lia saldo_atual carregado na
-- abertura do modal em vez do valor fresco do banco).
-- ============================================================

CREATE OR REPLACE FUNCTION public.pagar_parcela_imovel(
  p_imovel_id       UUID,
  p_conta_id        UUID,
  p_valor           NUMERIC,
  p_data_pagamento  DATE,
  p_mes_referencia  TEXT,
  p_parcela_atual   INTEGER,
  p_descricao       TEXT,
  p_categoria_id    UUID    DEFAULT NULL,
  p_observacoes     TEXT    DEFAULT NULL,
  p_notas           TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER          -- mantém o RLS do usuário logado
AS $$
DECLARE
  v_empresa_id     UUID;
  v_parcelas_total INTEGER;
  v_titulo         TEXT;
  v_status_atual   TEXT;
  v_lancamento_id  UUID;
  v_novo_saldo     NUMERIC;
  v_conta_nome     TEXT;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor de pagamento inválido';
  END IF;

  -- Trava a linha do imóvel até o fim da transação (evita duplo clique)
  SELECT empresa_id, parcelas_total, titulo
    INTO v_empresa_id, v_parcelas_total, v_titulo
    FROM public.imoveis
   WHERE id = p_imovel_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Imóvel não encontrado ou sem permissão de acesso';
  END IF;

  -- IDEMPOTÊNCIA: se o boleto deste mês já está pago, não faz nada.
  SELECT status INTO v_status_atual
    FROM public.pagamentos_imoveis
   WHERE imovel_id = p_imovel_id
     AND mes_referencia = p_mes_referencia
     FOR UPDATE;

  IF v_status_atual = 'pago' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'ja_pago',
      'mensagem', format('A parcela de %s do imóvel %s já estava registrada como paga.',
                         p_mes_referencia, v_titulo)
    );
  END IF;

  -- 1) Debita a conta lendo o saldo FRESCO (nada de valor carregado na tela)
  UPDATE public.contas
     SET saldo_atual = COALESCE(saldo_atual, 0) - p_valor
   WHERE id = p_conta_id
  RETURNING saldo_atual, nome INTO v_novo_saldo, v_conta_nome;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta de débito não encontrada ou sem permissão de acesso';
  END IF;

  -- 2) Lançamento de saída
  INSERT INTO public.lancamentos (
    conta_id, descricao, valor, tipo, regime, status,
    data_competencia, data_caixa, categoria_id,
    parcela_atual, total_parcelas, conciliado, observacoes
  ) VALUES (
    p_conta_id, p_descricao, p_valor, 'despesa', 'caixa', 'validado',
    p_data_pagamento, p_data_pagamento, p_categoria_id,
    p_parcela_atual, v_parcelas_total, true, p_observacoes
  )
  RETURNING id INTO v_lancamento_id;

  -- 3) Avança a parcela do imóvel
  UPDATE public.imoveis
     SET parcelas_pagas = p_parcela_atual
   WHERE id = p_imovel_id;

  -- 4) Registra o boleto como pago
  INSERT INTO public.pagamentos_imoveis (
    imovel_id, empresa_id, mes_referencia, status,
    valor_pago, data_pagamento, conta_origem_id, notas
  ) VALUES (
    p_imovel_id, v_empresa_id, p_mes_referencia, 'pago',
    p_valor, p_data_pagamento, p_conta_id, p_notas
  )
  ON CONFLICT (imovel_id, mes_referencia) DO UPDATE
    SET status          = 'pago',
        valor_pago      = EXCLUDED.valor_pago,
        data_pagamento  = EXCLUDED.data_pagamento,
        conta_origem_id = EXCLUDED.conta_origem_id,
        notas           = EXCLUDED.notas;

  RETURN jsonb_build_object(
    'ok', true,
    'lancamento_id', v_lancamento_id,
    'novo_saldo', v_novo_saldo,
    'conta_nome', v_conta_nome,
    'mes_referencia', p_mes_referencia,
    'parcela_atual', p_parcela_atual,
    'parcelas_total', v_parcelas_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pagar_parcela_imovel(
  UUID, UUID, NUMERIC, DATE, TEXT, INTEGER, TEXT, UUID, TEXT, TEXT
) TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 077 OK — pagar_parcela_imovel() criada' AS status;

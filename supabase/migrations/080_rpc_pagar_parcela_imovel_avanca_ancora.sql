-- ============================================================
-- SISTEMA CAJADO - MIGRATION 080
-- pagar_parcela_imovel() passa a avançar `proximo_vencimento`.
--
-- MOTIVO (04/09/2026)
-- A função da migration 077 faz `SET parcelas_pagas = p_parcela_atual`
-- e nunca toca em `proximo_vencimento`. Só que a âncora é justamente
-- quem define a data da próxima parcela: em patrimonio-pagamentos.ts,
-- `montarCalendario` trata `proximo_vencimento` como o vencimento da
-- parcela nº (parcelas_pagas + 1) e ignora a derivação por
-- data_aquisicao quando ela está preenchida.
--
-- Consequência: todo boleto pago pelo modal deixava a âncora um período
-- para trás. No mês seguinte o resumo lia essa data já vencida, não
-- encontrava pagamento para o mês corrente e pintava 🔴 VENCIDO um
-- boleto que estava em dia.
--
-- Foi o que aconteceu com quatro imóveis do Sr. Max em setembro/2026
-- (Sítio Mucugê, Sítio São Roque, Apartamento Ciacci e Terreno Baron
-- Conect). Os dois que apareciam corretos — Sítio Palmeira e Sítio Vida
-- — tinham sido pagos pela Elena, cujo handler `confirmar_pagamento`
-- já avança as duas coisas, com este comentário:
--
--   "A âncora TEM de andar junto com o contador: ela é sempre a parcela
--    nº (parcelas_pagas + 1). Quando só o contador subia, a numeração
--    desandava um mês no mês seguinte e o contrato 'quitava' adiantado."
--
-- A correção existia num caminho e não no outro. Esta migration fecha
-- essa diferença.
--
-- O QUE MUDA: uma única operação a mais dentro da mesma transação
-- (passo 3). Assinatura, retorno, idempotência e as outras três
-- operações ficam idênticas à 077.
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
  -- NOVOS: usados só para avançar a âncora
  v_periodicidade  TEXT;
  v_ancora_atual   DATE;
  v_passo          INTEGER;
  v_nova_ancora    DATE;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor de pagamento inválido';
  END IF;

  -- Trava a linha do imóvel até o fim da transação (evita duplo clique)
  SELECT empresa_id, parcelas_total, titulo, periodicidade, proximo_vencimento
    INTO v_empresa_id, v_parcelas_total, v_titulo, v_periodicidade, v_ancora_atual
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

  -- 3) Avança a parcela do imóvel — E A ÂNCORA JUNTO.
  --
  -- O passo segue a mesma tabela de `passoMeses` em patrimonio-pagamentos.ts.
  -- Periodicidade nula ou vazia = mensal, que é o padrão dos contratos e o
  -- que aquela função também assume — as duas TÊM de concordar, senão a
  -- âncora anda num ritmo e o calendário da tela em outro.
  v_passo := CASE lower(coalesce(nullif(trim(v_periodicidade), ''), 'mensal'))
               WHEN 'mensal'        THEN 1
               WHEN 'bimestral'     THEN 2
               WHEN 'trimestral'    THEN 3
               WHEN 'quadrimestral' THEN 4
               WHEN 'semestral'     THEN 6
               WHEN 'anual'         THEN 12
               ELSE NULL            -- periodicidade desconhecida: não mexe
             END;

  -- Só avança se: existe âncora, o passo é conhecido, e ainda há parcela
  -- depois desta. Na última parcela o contrato fica quitado e a âncora
  -- perde sentido — apontar para um vencimento que não existe seria pior
  -- que deixá-la parada.
  IF v_ancora_atual IS NOT NULL
     AND v_passo IS NOT NULL
     AND (v_parcelas_total IS NULL OR p_parcela_atual < v_parcelas_total)
  THEN
    v_nova_ancora := (v_ancora_atual + (v_passo || ' month')::interval)::date;
  ELSE
    v_nova_ancora := v_ancora_atual;   -- inalterada
  END IF;

  UPDATE public.imoveis
     SET parcelas_pagas     = p_parcela_atual,
         proximo_vencimento = v_nova_ancora
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
    'parcelas_total', v_parcelas_total,
    -- NOVO no retorno: dá para a tela conferir que a âncora andou.
    -- Campo a mais em JSONB não quebra quem não lê.
    'proximo_vencimento', v_nova_ancora
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pagar_parcela_imovel(
  UUID, UUID, NUMERIC, DATE, TEXT, INTEGER, TEXT, UUID, TEXT, TEXT
) TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 080 OK — pagar_parcela_imovel() agora avança proximo_vencimento' AS status;


-- ============================================================
-- COMO TESTAR (sem gastar dinheiro de verdade)
--
-- 1. Escolha um imóvel e anote o estado atual:
--
--    select titulo, parcelas_pagas, parcelas_total, periodicidade,
--           proximo_vencimento
--    from imoveis
--    where titulo like 'TESTE%'
--    order by titulo;
--
-- 2. Pague uma parcela pelo modal "Pagar Boleto" nesse imóvel de teste.
--
-- 3. Rode a consulta do passo 1 de novo. `parcelas_pagas` deve ter subido
--    1 e `proximo_vencimento` deve ter avançado um mês (ou o passo da
--    periodicidade). Antes desta migration, só o contador andava.
--
-- 4. Peça o resumo do mês na Elena. O imóvel deve aparecer como
--    ✅ Em dia ou 🟡 A vencer — nunca 🔴 VENCIDO logo depois de pago.
--
-- COMO REVERTER
-- Rode a migration 077 de novo: ela é CREATE OR REPLACE com a mesma
-- assinatura e devolve a função ao comportamento anterior. Nenhum dado
-- gravado por esta versão precisa ser desfeito — a âncora avançada é o
-- estado correto de qualquer forma.
-- ============================================================

-- ============================================================
-- Popular dados de teste para admin@visiopro.com
-- Gastos avulsos (gastos_pessoais) + Contas fixas (compromissos_fixos)
-- ============================================================

DO $$
DECLARE
  v_uid UUID;
  v_empresa UUID;
BEGIN
  -- Buscar user_id do admin@visiopro.com
  SELECT id INTO v_uid FROM auth.users WHERE email = 'admin@visiopro.com';
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário admin@visiopro.com não encontrado!';
  END IF;

  -- Buscar empresa_id
  SELECT empresa_id INTO v_empresa FROM public.perfis WHERE id = v_uid;

  -- ============================================================
  -- 1. GASTOS AVULSOS (gastos_pessoais) — agosto/2026
  -- ============================================================
  INSERT INTO public.gastos_pessoais (user_id, descricao, valor, categoria, forma_pagamento, data, recorrente)
  VALUES
    (v_uid, 'Almoço restaurante',          45.00,  'alimentacao',  'pix',            '2026-08-01', false),
    (v_uid, 'Uber para escritório',         22.50,  'transporte',   'cartao_credito', '2026-08-01', false),
    (v_uid, 'Supermercado semanal',        320.00,  'alimentacao',  'cartao_debito',  '2026-08-02', false),
    (v_uid, 'Gasolina',                    250.00,  'transporte',   'pix',            '2026-08-03', false),
    (v_uid, 'Farmácia',                     89.90,  'saude',        'pix',            '2026-08-03', false),
    (v_uid, 'Netflix + Spotify',            55.80,  'lazer',        'cartao_credito', '2026-08-04', false),
    (v_uid, 'Material escritório',         150.00,  'outros',       'pix',            '2026-08-04', false),
    (v_uid, 'Cafeteria',                    18.00,  'alimentacao',  'pix',            '2026-08-04', false),
    (v_uid, 'Estacionamento shopping',      25.00,  'transporte',   'dinheiro',       '2026-08-04', false),
    (v_uid, 'Corte de cabelo',              60.00,  'outros',       'pix',            '2026-08-04', false);

  RAISE NOTICE '✅ 10 gastos avulsos inseridos para agosto/2026';

  -- ============================================================
  -- 2. CONTAS FIXAS RECORRENTES (compromissos_fixos)
  -- ============================================================
  -- Categoria != 'boleto_imovel' para cair na seção CONTAS FIXAS
  INSERT INTO public.compromissos_fixos (user_id, descricao, valor, dia_vencimento, tipo_detalhe, categoria, ativo, recorrente)
  VALUES
    (v_uid, 'Conta de Água',         85.00,   10, 'agua',        'conta_fixa', true, true),
    (v_uid, 'Conta de Energia',     210.00,   15, 'energia',     'conta_fixa', true, true),
    (v_uid, 'Internet Vivo',        149.90,    5, 'internet',    'conta_fixa', true, true),
    (v_uid, 'Plano Celular',         79.90,   20, 'telefone',    'conta_fixa', true, true),
    (v_uid, 'Plano de Saúde',       450.00,   10, 'plano_saude', 'conta_fixa', true, true)
  ON CONFLICT DO NOTHING;

  RAISE NOTICE '✅ 5 contas fixas inseridas';
  RAISE NOTICE '🎯 Pronto! Peça "resumo do mês" na Elena para ver os blocos.';

END $$;

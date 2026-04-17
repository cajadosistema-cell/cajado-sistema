-- ============================================================
-- SEED FASE 1 — Sistema Cajado
-- Execute APÓS o migration_fase1.sql no SQL Editor do Supabase
-- ============================================================
-- IMPORTANTE: Substitua <SEU_USER_ID> pelo UUID do seu usuário
-- (encontre em: Authentication > Users no dashboard Supabase)
-- ============================================================

-- ── VARIÁVEL: Cole seu user_id aqui ──────────────────────────
-- Exemplo: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
DO $$
DECLARE
  uid UUID;
  uid2 UUID;
BEGIN
  -- Pega os primeiros dois usuários do sistema
  SELECT id INTO uid FROM public.perfis ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO uid2 FROM public.perfis ORDER BY created_at ASC OFFSET 1 LIMIT 1;

  IF uid IS NULL THEN
    RAISE NOTICE 'Nenhum usuário encontrado. Faça login no sistema primeiro.';
    RETURN;
  END IF;

  -- ── EQUIPE: Registros de ponto ─────────────────────────────
  INSERT INTO public.registros_ponto (user_id, tipo, timestamp) VALUES
    (uid, 'entrada',     NOW() - INTERVAL '8 hours'),
    (uid, 'pausa_inicio', NOW() - INTERVAL '5 hours'),
    (uid, 'pausa_fim',    NOW() - INTERVAL '4 hours 30 minutes'),
    (uid, 'entrada',     (NOW() - INTERVAL '1 day')::DATE + TIME '08:15:00'),
    (uid, 'saida',       (NOW() - INTERVAL '1 day')::DATE + TIME '18:00:00'),
    (uid, 'entrada',     (NOW() - INTERVAL '2 days')::DATE + TIME '08:30:00'),
    (uid, 'saida',       (NOW() - INTERVAL '2 days')::DATE + TIME '17:45:00');

  -- ── EQUIPE: Tarefas ────────────────────────────────────────
  INSERT INTO public.tarefas (titulo, descricao, responsavel_id, status, prioridade, prazo, modulo) VALUES
    ('Ligar para cliente Marcos sobre regularização', 'Aguardando documentação do DETRAN', uid, 'em_andamento', 'alta', CURRENT_DATE + 1, 'crm'),
    ('Atualizar tabela de preços 2026', 'Verificar taxas do DETRAN e reajustar valores', uid, 'a_fazer', 'media', CURRENT_DATE + 7, 'financeiro'),
    ('Configurar resposta automática WhatsApp', 'Mensagem fora do horário comercial', uid, 'a_fazer', 'urgente', CURRENT_DATE, 'inbox'),
    ('Conciliar extrato Bradesco - Abril', NULL, uid, 'a_fazer', 'alta', CURRENT_DATE + 2, 'financeiro'),
    ('Reunião com parceiro de seguros', 'Parceria para DPVAT em conjunto', uid, 'concluida', 'media', CURRENT_DATE - 2, 'comercial'),
    ('Revisão de comissões do mês', 'Calcular parceiros e indicadores', uid, 'concluida', 'alta', CURRENT_DATE - 5, 'financeiro'),
    ('Postar no Instagram dicas DETRAN', 'Criar 3 posts explicativos', uid, 'em_andamento', 'baixa', CURRENT_DATE + 14, 'comercial');

  -- Tarefas para segundo usuário (se existir)
  IF uid2 IS NOT NULL THEN
    INSERT INTO public.tarefas (titulo, responsavel_id, status, prioridade, prazo, modulo) VALUES
      ('Fechar proposta João Batista', uid2, 'em_andamento', 'urgente', CURRENT_DATE, 'crm'),
      ('Enviar fotos do processo da Juliana', uid2, 'a_fazer', 'media', CURRENT_DATE + 3, 'operacional');
  END IF;

  -- ── EQUIPE: Ocorrências ────────────────────────────────────
  INSERT INTO public.ocorrencias (tipo, descricao, colaborador_id, modulo, impacto, resolvida) VALUES
    ('acerto', 'Atendimento rápido e preciso para o cliente Rafael — fechou na hora', uid, 'crm', 'alto', false),
    ('elogio', 'Cliente Juliana elogiou o atendimento pelo WhatsApp', uid, 'inbox', 'medio', false),
    ('erro', 'Lançamento financeiro duplicado no Bradesco — corrigido manualmente', uid, 'financeiro', 'medio', true),
    ('alerta', 'WhatsApp principal com mensagens acumuladas fora do horário', uid, 'inbox', 'alto', false),
    ('acerto', 'Conciliação bancária realizada antes do prazo', uid, 'financeiro', 'baixo', false);

  -- ── PF PESSOAL: Gastos ────────────────────────────────────
  INSERT INTO public.gastos_pessoais (user_id, descricao, valor, categoria, forma_pagamento, data, recorrente) VALUES
    (uid, 'Supermercado Atacadão',      890.00, 'alimentacao',  'cartao_debito',  CURRENT_DATE - 3, false),
    (uid, 'Uber - trabalho',             38.50, 'transporte',   'cartao_debito',  CURRENT_DATE - 2, false),
    (uid, 'Netflix',                     55.90, 'lazer',        'cartao_credito', CURRENT_DATE - 1, true),
    (uid, 'Spotify',                     21.90, 'lazer',        'cartao_credito', CURRENT_DATE - 1, true),
    (uid, 'Farmácia - remédios',        120.00, 'saude',        'pix',            CURRENT_DATE - 4, false),
    (uid, 'Gasolina do carro',          280.00, 'transporte',   'pix',            CURRENT_DATE - 5, false),
    (uid, 'Restaurante com família',    320.00, 'alimentacao',  'cartao_credito', CURRENT_DATE - 6, false),
    (uid, 'Plano Internet Residencial', 150.00, 'moradia',      'debito_auto',    CURRENT_DATE - 10, true),
    (uid, 'Energia elétrica',           380.00, 'moradia',      'pix',            CURRENT_DATE - 12, false),
    (uid, 'Curso online - Finanças',    297.00, 'educacao',     'pix',            CURRENT_DATE - 8, false),
    (uid, 'IFood - pedido noite',        67.50, 'alimentacao',  'pix',            CURRENT_DATE, false),
    (uid, 'Academia',                   120.00, 'saude',        'pix',            CURRENT_DATE - 15, true);

  -- ── PF PESSOAL: Receitas ──────────────────────────────────
  INSERT INTO public.receitas_pessoais (user_id, descricao, valor, categoria, recorrente, data) VALUES
    (uid, 'Pró-labore Cajado - Abril',  8000.00, 'pro_labore', true,  CURRENT_DATE - 5),
    (uid, 'Aluguel Sala Comercial',     1200.00, 'aluguel',    true,  CURRENT_DATE - 5),
    (uid, 'Dividendos FIIs',             350.00, 'dividendos', false, CURRENT_DATE - 10),
    (uid, 'Freelance - Site Parceiro',   800.00, 'freelance',  false, CURRENT_DATE - 15);

  -- ── PF PESSOAL: Orçamentos ────────────────────────────────
  INSERT INTO public.orcamentos_pessoais (user_id, categoria, valor_limite, mes_referencia)
  VALUES
    (uid, 'alimentacao',  1500.00, TO_CHAR(CURRENT_DATE, 'YYYY-MM')),
    (uid, 'transporte',    800.00, TO_CHAR(CURRENT_DATE, 'YYYY-MM')),
    (uid, 'lazer',         500.00, TO_CHAR(CURRENT_DATE, 'YYYY-MM')),
    (uid, 'saude',         400.00, TO_CHAR(CURRENT_DATE, 'YYYY-MM')),
    (uid, 'moradia',      2000.00, TO_CHAR(CURRENT_DATE, 'YYYY-MM')),
    (uid, 'educacao',      500.00, TO_CHAR(CURRENT_DATE, 'YYYY-MM'))
  ON CONFLICT (user_id, categoria, mes_referencia) DO NOTHING;

  RAISE NOTICE 'Seed Fase 1 concluído com sucesso para user_id: %', uid;
END $$;

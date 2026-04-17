-- =========================================================================
-- SEED DE DADOS DEMO — SISTEMA CAJADO
-- Cole este código no SQL Editor do Supabase (dashboard.supabase.com)
-- Para rodar, clique em "Run"
-- =========================================================================

-- 1. LIMPAR DADOS ANTIGOS (Opcional - remova os traços se quiser limpar antes)
-- DELETE FROM atividades;
-- DELETE FROM leads;
-- DELETE FROM lancamentos;
-- DELETE FROM contas;

-- 2. DADOS DO CRM (Leads)
INSERT INTO leads (nome, telefone, email, origem, servico_interesse, status, valor_estimado, notas, created_at)
VALUES 
  ('Carlos Eduardo Silva', '(77) 99912-3456', 'carlos@gmail.com', 'whatsapp', 'Licenciamento Anual', 'novo', 250.00, 'Cliente precisa com urgência', NOW() - INTERVAL '1 day'),
  ('Ana Paula Ferreira', '(77) 98845-6789', 'ana.paula@hotmail.com', 'indicacao', 'Transferência de Propriedade', 'proposta', 450.00, 'Falta enviar o CRV', NOW() - INTERVAL '3 days'),
  ('Marcos Antônio Lima', '(77) 99123-0987', 'marcos@outlook.com', 'instagram', 'Regularização de Débitos', 'retomar', 1200.00, 'Aguardando o 13º salário', NOW() - INTERVAL '15 days'),
  ('Juliana Costa Rocha', '(77) 98811-2233', 'ju.costa@empresa.com.br', 'google', 'Placa Mercosul', 'cliente_ativo', 150.00, 'Paga via PIX hoje', NOW() - INTERVAL '2 days'),
  ('Rafael Souza Nunes', '(77) 99654-3210', 'rafael.nunes@gmail.com', 'whatsapp', 'Primeira Habilitação', 'perdido', 1800.00, 'Achou caro', NOW() - INTERVAL '10 days'),
  ('Fernanda Oliveira', '(77) 99234-5678', 'fe_oliveira@gmail.com', 'indicacao', 'CRLV Digital', 'novo', 180.00, 'Documentos na recepção', NOW() - INTERVAL '2 hours'),
  ('João Batista Carvalho', '(77) 98112-9988', 'joao.batista@gmail.com', 'whatsapp', 'Seguro DPVAT / IPVA', 'proposta', 850.00, 'Vai dividir no cartão', NOW() - INTERVAL '5 days'),
  ('Mariana Alves Santos', '(77) 99988-7766', 'mariana@hotmail.com', 'instagram', 'Renovação CNH', 'cliente_ativo', 250.00, 'Processo aberto no DETRAN', NOW() - INTERVAL '4 days');

-- 3. DADOS FINANCEIROS (Contas)
DO $$
DECLARE
  conta_bradesco UUID;
  conta_c6 UUID;
  conta_caixa UUID;
BEGIN
  -- Cria as contas
  INSERT INTO contas (nome, tipo, categoria, saldo_inicial, saldo_atual, ativo, cor)
  VALUES 
    ('Bradesco PJ', 'corrente', 'pj', 18500.00, 18500.00, true, '#ef4444') RETURNING id INTO conta_bradesco;
    
  INSERT INTO contas (nome, tipo, categoria, saldo_inicial, saldo_atual, ativo, cor)
  VALUES 
    ('C6 Bank PJ', 'corrente', 'pj', 8200.00, 8200.00, true, '#1f2937') RETURNING id INTO conta_c6;
    
  INSERT INTO contas (nome, tipo, categoria, saldo_inicial, saldo_atual, ativo, cor)
  VALUES 
    ('Caixa Físico', 'dinheiro', 'pj', 1200.00, 1200.00, true, '#10b981') RETURNING id INTO conta_caixa;

  -- 4. DADOS FINANCEIROS (Lançamentos / Extrato)
  
  -- Algumas receitas dos meses anteriores (já conciliadas)
  INSERT INTO lancamentos (descricao, valor, tipo, regime, status, data_competencia, data_caixa, conciliado, conta_id)
  VALUES
    ('Licenciamento - Carlos Silva', 250.00, 'receita', 'caixa', 'validado', CURRENT_DATE - 30, CURRENT_DATE - 30, true, conta_bradesco),
    ('Transferência - Ana Paula', 450.00, 'receita', 'caixa', 'validado', CURRENT_DATE - 25, CURRENT_DATE - 25, true, conta_c6),
    ('Regularização - Marcos', 1200.00, 'receita', 'caixa', 'validado', CURRENT_DATE - 20, CURRENT_DATE - 20, true, conta_bradesco),
    ('Placas - Juliana', 150.00, 'receita', 'caixa', 'validado', CURRENT_DATE - 15, CURRENT_DATE - 15, true, conta_caixa),
    ('Renovação CNH - Mariana', 250.00, 'receita', 'caixa', 'validado', CURRENT_DATE - 10, CURRENT_DATE - 10, true, conta_c6),
    ('Licenciamento Moto - Pedro', 180.00, 'receita', 'caixa', 'validado', CURRENT_DATE - 5, CURRENT_DATE - 5, true, conta_bradesco),
    ('Documentação caminhão - Transporte X', 2500.00, 'receita', 'caixa', 'validado', CURRENT_DATE - 2, CURRENT_DATE - 2, true, conta_bradesco);

  -- Algumas despesas fixas (já validadas)
  INSERT INTO lancamentos (descricao, valor, tipo, regime, status, data_competencia, data_caixa, conciliado, conta_id)
  VALUES
    ('Aluguel do escritório', 1800.00, 'despesa', 'caixa', 'validado', CURRENT_DATE - 28, CURRENT_DATE - 28, true, conta_bradesco),
    ('Conta de Energia', 320.00, 'despesa', 'caixa', 'validado', CURRENT_DATE - 22, CURRENT_DATE - 22, true, conta_c6),
    ('Internet VIP', 150.00, 'despesa', 'caixa', 'validado', CURRENT_DATE - 18, CURRENT_DATE - 18, true, conta_c6),
    ('Folha de pagamento (João)', 2500.00, 'despesa', 'caixa', 'validado', CURRENT_DATE - 10, CURRENT_DATE - 10, true, conta_bradesco),
    ('Material de escritório', 120.00, 'despesa', 'caixa', 'validado', CURRENT_DATE - 5, CURRENT_DATE - 5, true, conta_caixa);

  -- Contas a pagar futuras
  INSERT INTO lancamentos (descricao, valor, tipo, regime, status, data_competencia, data_caixa, conciliado, conta_id)
  VALUES
    ('Aluguel do escritório', 1800.00, 'despesa', 'competencia', 'pendente', CURRENT_DATE + 5, null, false, conta_bradesco),
    ('Taxas do DETRAN mensais', 3500.00, 'despesa', 'competencia', 'pendente', CURRENT_DATE + 3, null, false, conta_bradesco),
    ('Marketing Instagram/Google', 800.00, 'despesa', 'competencia', 'pendente', CURRENT_DATE + 10, null, false, conta_c6);

  -- Contas a receber (lançamentos)
  INSERT INTO lancamentos (descricao, valor, tipo, regime, status, data_competencia, data_caixa, conciliado, conta_id)
  VALUES
    ('Transferência frota (Sítio Y)', 4500.00, 'receita', 'competencia', 'pendente', CURRENT_DATE + 2, null, false, conta_bradesco),
    ('Regularização frota (Fazenda Z)', 3200.00, 'receita', 'competencia', 'pendente', CURRENT_DATE + 7, null, false, conta_c6);

END $$;

-- 5. SEGURANCA WA (Números, Mensagens Padrão, Checkins)
INSERT INTO numeros_whatsapp (numero, nome, status, limite_diario, enviados_hoje, intervalo_minimo_segundos, is_backup, notas)
VALUES
  ('5511999998888', 'Atendimento Principal', 'ativo', 250, 190, 15, false, 'Número quente, usar com cuidado'),
  ('5511988887777', 'Vendas Secundário', 'ativo', 100, 45, 20, false, 'Usado apenas para disparo em massa seguro'),
  ('5511977776666', 'Reserva 1', 'backup', 0, 0, 30, true, 'Aquecido e pronto para uso caso o principal caia'),
  ('5511966665555', 'Suporte Antigo', 'bloqueado', 50, 50, 10, false, 'Banido na campanha de março');

INSERT INTO mensagens_padrao (titulo, conteudo, categoria, variaveis)
VALUES
  ('Saudação Inicial', 'Olá {{nome}}! Tudo bem? Aqui é do atendimento Cajado. Como posso te ajudar com o {{servico}} hoje?', 'prospeccao', ARRAY['nome', 'servico']),
  ('Aviso de Vistoria', 'Atenção {{nome}}, sua vistoria foi agendada. Não esqueça de trazer os documentos.', 'pos_venda', ARRAY['nome']),
  ('Cobrança Amigável', 'Bom dia {{nome}}, identificamos um valor pendente. Podemos enviar o link do PIX?', 'followup', ARRAY['nome']);

INSERT INTO checkins (tipo, latitude, longitude, endereco, timestamp, servico_descricao)
VALUES
  ('entrada', -23.5505, -46.6333, 'Av. Paulista, 1000 - São Paulo', NOW() - INTERVAL '8 hours', 'Chegada no escritório'),
  ('saida', -23.5505, -46.6333, 'Av. Paulista, 1000 - São Paulo', NOW() - INTERVAL '1 hour', 'Fim do expediente');

-- 6. ORGANIZAÇÃO (Projetos, Ideias, Decisões)
INSERT INTO projetos (titulo, descricao, status, prioridade, data_limite, progresso)
VALUES
  ('Automação de WhatsApp', 'Integrar API Oficial da Meta no CRM', 'em_andamento', 'alta', CURRENT_DATE + 15, 65),
  ('Reforma do Escritório', 'Trocar mesas e ar-condicionado da recepção', 'nao_iniciado', 'media', CURRENT_DATE + 45, 0),
  ('Nova Tabela de Preços', 'Atualizar todos os valores de despachante para 2026', 'concluido', 'alta', CURRENT_DATE - 5, 100);

INSERT INTO ideias (titulo, descricao, votos, status)
VALUES
  ('Oferecer seguro auto junto com licenciamento', 'Podemos fazer parceria com corretora', 5, 'aprovada'),
  ('Café expresso grátis pros clientes', 'Comprar máquina de cápsula', 2, 'nova'),
  ('Usar TikTok para dicas de trânsito', 'Gravar vídeos curtos', 8, 'em_analise');

INSERT INTO decisoes (titulo, contexto, impacto, autores)
VALUES
  ('Migração para API Oficial', 'Estávamos tomando muitos bloqueios com QR Code', 'Alto. Exigirá aprovação de templates.', 'Carlos, Ana'),
  ('Aumento do valor da transferência', 'Taxas do DETRAN subiram 10%', 'Médio. Reajuste de R$40.', 'Carlos');

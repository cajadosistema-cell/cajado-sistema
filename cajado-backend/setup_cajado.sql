-- ============================================================
-- CAJADO BACKEND — Tabelas necessárias para o Inbox WhatsApp
-- Execute este SQL no Supabase do Cajado (SQL Editor)
-- ============================================================

-- 1. Empresa padrão do Cajado
CREATE TABLE IF NOT EXISTS empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    status TEXT DEFAULT 'ativo',
    plano_tipo TEXT DEFAULT 'bot_mensal',
    proximo_vencimento DATE,
    link_pagamento TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inserir empresa Cajado (se não existir)
INSERT INTO empresas (nome, status)
SELECT 'Cajado', 'ativo' WHERE NOT EXISTS (SELECT 1 FROM empresas LIMIT 1);

-- 2. Tabela de usuários do backend inbox
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT,
    email TEXT UNIQUE,
    senha TEXT,
    role TEXT DEFAULT 'atendente',
    setor TEXT DEFAULT 'todos',
    ativo BOOLEAN DEFAULT TRUE,
    empresa_id UUID REFERENCES empresas(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexar por email para login rápido
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios(empresa_id);

-- 3. Conversas do WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_conversas (
    numero TEXT NOT NULL,
    empresa_id UUID NOT NULL REFERENCES empresas(id),
    dados JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (empresa_id, numero)
);

CREATE INDEX IF NOT EXISTS idx_wconv_empresa ON whatsapp_conversas(empresa_id);

-- 4. Configurações (prompt do bot por empresa)
CREATE TABLE IF NOT EXISTS configuracoes (
    id TEXT NOT NULL,
    empresa_id UUID NOT NULL REFERENCES empresas(id),
    valor TEXT,
    PRIMARY KEY (empresa_id, id)
);

-- 5. Times / Setores
CREATE TABLE IF NOT EXISTS times (
    id TEXT NOT NULL,
    empresa_id UUID NOT NULL REFERENCES empresas(id),
    nome TEXT,
    descricao TEXT,
    palavras_chave TEXT,
    cor TEXT DEFAULT '#3b82f6',
    emoji TEXT DEFAULT '💼',
    ativo BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (empresa_id, id)
);

-- 6. Canais (conexões de WhatsApp)
CREATE TABLE IF NOT EXISTS canais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES empresas(id) NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'evolution',
    status TEXT DEFAULT 'desconectado',
    dados_conexao JSONB NOT NULL DEFAULT '{}'::jsonb,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_canais_empresa ON canais(empresa_id);
CREATE INDEX IF NOT EXISTS idx_canais_evolution ON canais((dados_conexao->>'instance_name'));

-- 7. Webchat Vivi (conversas do site)
CREATE TABLE IF NOT EXISTS vivi_conversas (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    empresa_id UUID REFERENCES empresas(id),
    mensagem TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    canal TEXT DEFAULT 'site',
    visto BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vivi_session ON vivi_conversas(session_id);
CREATE INDEX IF NOT EXISTS idx_vivi_empresa ON vivi_conversas(empresa_id);

-- ============================================================
-- DESABILITAR RLS (para servidor backend - usa service_role key)
-- ============================================================
ALTER TABLE empresas DISABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversas DISABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE times DISABLE ROW LEVEL SECURITY;
ALTER TABLE canais DISABLE ROW LEVEL SECURITY;
ALTER TABLE vivi_conversas DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- INSERIR TIMES PADRÃO (setores de atendimento)
-- ============================================================
INSERT INTO times (id, empresa_id, nome, descricao, palavras_chave, cor, emoji, ativo)
SELECT 
    t.id, e.id, t.nome, t.descricao, t.palavras_chave, t.cor, t.emoji, TRUE
FROM (
    VALUES 
        ('vendas',     'Vendas',     'Equipe comercial e fechamento de propostas',     'comprar, preco, orcamento, venda, comercial',           '#3b82f6', '💼'),
        ('suporte',    'Suporte',    'Atendimento técnico, dúvidas e problemas',        'duvida, erro, ajuda, suporte, tecnico',                 '#10b981', '🛠️'),
        ('financeiro', 'Financeiro', 'Pagamentos, boletos e pendências financeiras',    'pagamento, boleto, nf, nota fiscal, financeiro',        '#f59e0b', '💰'),
        ('servicos',   'Serviços',   'Execução de serviços e acompanhamento de OS',     'servico, os, ordem, execucao, prazo, entrega',          '#8b5cf6', '📋')
) AS t(id, nome, descricao, palavras_chave, cor, emoji)
CROSS JOIN (SELECT id FROM empresas LIMIT 1) AS e
ON CONFLICT DO NOTHING;

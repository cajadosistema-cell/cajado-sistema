-- ================================================================
-- FIX CORRIGIDO: Persistência de conversas
-- A tabela usuarios já existe SEM empresa_id — corrigindo isso
-- ================================================================

-- 1. Cria whatsapp_conversas (causa raiz das perdas)
CREATE TABLE IF NOT EXISTS whatsapp_conversas (
    numero TEXT NOT NULL,
    empresa_id UUID NOT NULL,
    dados JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (empresa_id, numero)
);

-- 2. Configurações do bot por empresa
CREATE TABLE IF NOT EXISTS configuracoes (
    id TEXT NOT NULL,
    empresa_id UUID NOT NULL,
    valor TEXT,
    PRIMARY KEY (empresa_id, id)
);

-- 3. Canais WhatsApp
CREATE TABLE IF NOT EXISTS canais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT DEFAULT 'evolution',
    status TEXT DEFAULT 'desconectado',
    dados_conexao JSONB DEFAULT '{}'::jsonb,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Times/Setores
CREATE TABLE IF NOT EXISTS times (
    id TEXT NOT NULL,
    empresa_id UUID NOT NULL,
    nome TEXT,
    descricao TEXT,
    palavras_chave TEXT,
    cor TEXT DEFAULT '#3b82f6',
    emoji TEXT DEFAULT '💼',
    ativo BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (empresa_id, id)
);

-- 5. Adiciona empresa_id na tabela usuarios existente
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa_id UUID;

-- 6. Desabilita RLS (backend usa service_role key)
ALTER TABLE whatsapp_conversas DISABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes      DISABLE ROW LEVEL SECURITY;
ALTER TABLE canais             DISABLE ROW LEVEL SECURITY;
ALTER TABLE times              DISABLE ROW LEVEL SECURITY;

-- 7. Vincula admin@visiopro.com à primeira empresa
UPDATE usuarios
SET empresa_id = (SELECT id FROM empresas ORDER BY created_at ASC NULLS LAST LIMIT 1)
WHERE email = 'admin@visiopro.com';

-- 8. Checa resultado — deve retornar empresa_id preenchido
SELECT email, empresa_id FROM usuarios WHERE email = 'admin@visiopro.com';

-- 1. Criar a tabela de empresas (Tenants) se não existir
CREATE TABLE IF NOT EXISTS empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inserir uma empresa padrão (se estiver vazia)
INSERT INTO empresas (nome) 
SELECT 'VisioPro' WHERE NOT EXISTS (SELECT 1 FROM empresas LIMIT 1);

-- 2. Criar tabela "usuarios" se ainda não existir, antes de alterá-la
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT, email TEXT, senha TEXT, role TEXT, ativo BOOLEAN
);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
UPDATE usuarios SET empresa_id = (SELECT id FROM empresas LIMIT 1) WHERE empresa_id IS NULL;

-- 3. Criar conversas se não existir
CREATE TABLE IF NOT EXISTS whatsapp_conversas (
    numero TEXT,
    dados JSONB
);
ALTER TABLE whatsapp_conversas ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
UPDATE whatsapp_conversas SET empresa_id = (SELECT id FROM empresas LIMIT 1) WHERE empresa_id IS NULL;
ALTER TABLE whatsapp_conversas DROP CONSTRAINT IF EXISTS whatsapp_conversas_pkey;
ALTER TABLE whatsapp_conversas ADD PRIMARY KEY (empresa_id, numero);

-- 4. CRIAR TABELA configuracoes e linkar empresa_id
CREATE TABLE IF NOT EXISTS configuracoes (
    id TEXT,
    valor TEXT
);
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
UPDATE configuracoes SET empresa_id = (SELECT id FROM empresas LIMIT 1) WHERE empresa_id IS NULL;
ALTER TABLE configuracoes DROP CONSTRAINT IF EXISTS configuracoes_pkey;
ALTER TABLE configuracoes ADD PRIMARY KEY (empresa_id, id);

-- 5. Criar times se não existir
CREATE TABLE IF NOT EXISTS times (
    id TEXT,
    nome TEXT,
    descricao TEXT,
    palavras_chave TEXT,
    cor TEXT,
    emoji TEXT,
    ativo BOOLEAN
);
ALTER TABLE times ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
UPDATE times SET empresa_id = (SELECT id FROM empresas LIMIT 1) WHERE empresa_id IS NULL;
ALTER TABLE times DROP CONSTRAINT IF EXISTS times_pkey;
ALTER TABLE times ADD PRIMARY KEY (empresa_id, id);

-- 6. Criar leads (Vivi) se não existir
CREATE TABLE IF NOT EXISTS vivi_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT,
    whatsapp TEXT,
    canal TEXT,
    status TEXT
);
ALTER TABLE vivi_leads ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);
UPDATE vivi_leads SET empresa_id = (SELECT id FROM empresas LIMIT 1) WHERE empresa_id IS NULL;

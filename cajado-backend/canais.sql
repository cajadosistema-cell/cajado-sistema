-- 1. Criar a tabela de Canais (Conexões de WhatsApp) associada à Empresa
CREATE TABLE IF NOT EXISTS canais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES empresas(id) NOT NULL,
    nome TEXT NOT NULL, -- Ex: "WhatsApp Comercial"
    tipo TEXT NOT NULL, -- "evolution" ou "oficial"
    status TEXT DEFAULT 'desconectado', -- "conectado", "pendente", "desconectado"
    dados_conexao JSONB NOT NULL DEFAULT '{}'::jsonb, -- Armazena tokens, IDs e senhas específicos do canal
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Segurança: Indexar por empresa_id para buscas mais rápidas no webhook
CREATE INDEX IF NOT EXISTS idx_canais_empresa ON canais(empresa_id);
-- Indexar por instance_name (dentro do JSONB) e phone_number_id para agilizar o webhook
CREATE INDEX IF NOT EXISTS idx_canais_evolution ON canais((dados_conexao->>'instance_name'));
CREATE INDEX IF NOT EXISTS idx_canais_oficial ON canais((dados_conexao->>'phone_number_id'));

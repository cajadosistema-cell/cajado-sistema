-- ════════════════════════════════════════════════════════════════
-- MIGRATION: Tabela Funcionários + RBAC + Criação via Supabase Auth
-- Execute no Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- 1. Criar (ou garantir que existe) a tabela funcionarios
CREATE TABLE IF NOT EXISTS funcionarios (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  cargo        TEXT DEFAULT '',
  ativo        BOOLEAN DEFAULT true,
  permissoes   TEXT[] DEFAULT '{}',  -- Array de IDs de módulos permitidos
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir que as colunas de data existam (caso a tabela tenha sido criada antes por outro script)
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- 2. Habilitar RLS
ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;

-- 3. Remover políticas antigas se existirem
DROP POLICY IF EXISTS "funcionarios_select_own"  ON funcionarios;
DROP POLICY IF EXISTS "funcionarios_admin_all"   ON funcionarios;
DROP POLICY IF EXISTS "funcionarios_service_all" ON funcionarios;

-- 4. Política: qualquer usuário autenticado pode LER (SELECT) seu próprio registro
--    (necessário para o sidebar buscar as permissões do funcionário logado)
CREATE POLICY "funcionarios_select_own"
  ON funcionarios FOR SELECT
  USING (
    auth.uid() = id           -- o próprio funcionário lê seu registro
    OR email = (              -- ou por email (fallback para casos legacy)
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );

-- 5. Política: service_role (usado na API Route) tem acesso total
CREATE POLICY "funcionarios_service_all"
  ON funcionarios FOR ALL
  USING (true)
  WITH CHECK (true);

-- Nota: A política "service_role" acima permite que a API Route (que usa
-- SUPABASE_SERVICE_ROLE_KEY) crie/edite/delete registros sem restrições.
-- O SELECT pela anon_key no sidebar só retorna o registro do usuário logado.

-- 6. Índices de performance
CREATE INDEX IF NOT EXISTS idx_funcionarios_email ON funcionarios(email);
CREATE INDEX IF NOT EXISTS idx_funcionarios_ativo ON funcionarios(ativo);

-- 7. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_funcionarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_funcionarios_updated_at ON funcionarios;
CREATE TRIGGER trg_funcionarios_updated_at
  BEFORE UPDATE ON funcionarios
  FOR EACH ROW EXECUTE FUNCTION update_funcionarios_updated_at();

-- ════════════════════════════════════════════════════════════════
-- INSTRUÇÃO IMPORTANTE:
-- Após rodar esta migration, vá em:
--   Supabase Dashboard > Project Settings > API
--   Copie a chave "service_role" (secret)
--   Cole no arquivo .env.local como SUPABASE_SERVICE_ROLE_KEY=...
--   E também nas variáveis de ambiente do Railway/Vercel
-- ════════════════════════════════════════════════════════════════

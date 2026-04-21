-- ============================================================
-- SISTEMA CAJADO - MIGRATION 003
-- RBAC: Roles, User Roles e dados iniciais de roles
-- ============================================================

-- Roles disponíveis no sistema
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  permissoes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de roles para autenticados" ON public.roles
  FOR SELECT TO authenticated USING (TRUE);

-- Vínculo usuário ↔ role
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticados user_roles" ON public.user_roles
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- Dados iniciais de Roles
-- ============================================================

INSERT INTO public.roles (nome, descricao, permissoes) VALUES
  ('admin', 'Administrador com acesso irrestrito', ARRAY[
    'financeiro','comissoes','inbox','cajado','vendas','pos-venda',
    'seguranca-wa','expansao','inteligencia','organizacao','diario',
    'gestao-pessoal','pf-pessoal','patrimonio','investimentos','trader',
    'seguranca-geral','configuracoes'
  ]),
  ('gestor', 'Gestor com acesso ao comercial e financeiro', ARRAY[
    'financeiro','cajado','vendas','pos-venda','inbox','organizacao','diario'
  ]),
  ('atendente', 'Atendente com acesso ao CRM e WhatsApp', ARRAY[
    'inbox','cajado','vendas','pos-venda','organizacao'
  ]),
  ('financeiro', 'Analista financeiro', ARRAY[
    'financeiro','comissoes','organizacao'
  ]),
  ('visualizacao', 'Somente leitura nos módulos permitidos', ARRAY[
    'cajado','vendas'
  ])
ON CONFLICT (nome) DO NOTHING;

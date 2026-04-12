-- ============================================================
-- VisioPro: Desabilitar RLS nas tabelas do sistema backend
-- Execute este SQL no Supabase Dashboard → SQL Editor
-- ============================================================

-- Desabilita RLS (Row Level Security) em todas as tabelas do sistema
-- O backend usa JWT próprio, não o Supabase Auth, então o RLS bloqueia tudo

ALTER TABLE public.empresas       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios       DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.times          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.canais         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversas DISABLE ROW LEVEL SECURITY;

-- Tabelas opcionais (só executar se existirem)
ALTER TABLE public.vivi_leads        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vivi_conversas    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vivi_agendamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vp_cobrancas      DISABLE ROW LEVEL SECURITY;

-- Verifica quais tabelas têm RLS ativo (deve retornar vazio após executar acima)
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;

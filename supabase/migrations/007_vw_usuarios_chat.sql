-- ============================================================
-- Migration 007: View de Usuarios para o Chat
-- ============================================================

-- Cria uma view segura para ler nomes de todos os usuarios do auth.users
-- Isso resolve o problema de administradores ou usuarios sem registro
-- na tabela "funcionarios" aparecerem como "Desconhecido" no chat.

CREATE OR REPLACE VIEW public.vw_usuarios_chat AS
SELECT 
    id,
    COALESCE(
        raw_user_meta_data->>'nome', 
        raw_user_meta_data->>'name', 
        split_part(email, '@', 1)
    ) as nome,
    email
FROM auth.users;

-- Dá permissão de select na view para usuários autenticados
GRANT SELECT ON public.vw_usuarios_chat TO authenticated;

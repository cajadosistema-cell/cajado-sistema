-- ================================================================
-- CORREÇÃO: Separar max@cajado.com da empresa admin@visiopro.com
-- Cole e execute TUDO de uma vez no SQL Editor (Role: postgres)
-- ================================================================

DO $$
DECLARE
  v_max_id       uuid;
  v_admin_id     uuid;
  v_admin_emp    uuid;
  v_cajado_emp   uuid;
BEGIN

  -- Pega os IDs dos usuários
  SELECT id INTO v_max_id   FROM auth.users WHERE email = 'max@cajado.com';
  SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@visiopro.com';

  IF v_max_id IS NULL THEN
    RAISE EXCEPTION 'Usuário max@cajado.com não encontrado!';
  END IF;
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Usuário admin@visiopro.com não encontrado!';
  END IF;

  -- Pega a empresa atual de ambos
  SELECT empresa_id INTO v_admin_emp FROM public.perfis WHERE id = v_admin_id;
  SELECT empresa_id INTO v_cajado_emp FROM public.perfis WHERE id = v_max_id;

  RAISE NOTICE 'admin empresa_id: %', v_admin_emp;
  RAISE NOTICE 'max empresa_id atual: %', v_cajado_emp;

  -- Se estão na mesma empresa, cria uma nova para max@cajado.com
  IF v_cajado_emp = v_admin_emp OR v_cajado_emp IS NULL THEN
    RAISE NOTICE 'Criando nova empresa para Cajado...';

    -- Cria a empresa Cajado (ignora se já existir com esse nome)
    INSERT INTO public.empresas (nome, plano, trial_ativo)
    VALUES ('Cajado', 'starter', false)
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_cajado_emp;

    -- Se já existia, busca pelo nome
    IF v_cajado_emp IS NULL THEN
      SELECT id INTO v_cajado_emp FROM public.empresas WHERE nome = 'Cajado' LIMIT 1;
    END IF;

    -- Garante que é uma empresa diferente de admin
    IF v_cajado_emp = v_admin_emp THEN
      INSERT INTO public.empresas (nome, plano, trial_ativo)
      VALUES ('Cajado Sistema', 'starter', false)
      RETURNING id INTO v_cajado_emp;
    END IF;

    -- Atualiza o perfil de max para a nova empresa
    UPDATE public.perfis SET empresa_id = v_cajado_emp WHERE id = v_max_id;

    RAISE NOTICE '✅ max@cajado.com movido para empresa: %', v_cajado_emp;
  ELSE
    RAISE NOTICE '✅ max@cajado.com já estava em empresa separada: %', v_cajado_emp;
  END IF;

END $$;

-- ================================================================
-- VERIFICAÇÃO FINAL — confirma o isolamento após a correção
-- ================================================================
SELECT
  u.email,
  p.empresa_id,
  e.nome AS empresa_nome
FROM auth.users u
JOIN public.perfis p ON p.id = u.id
JOIN public.empresas e ON e.id = p.empresa_id
WHERE u.email IN ('max@cajado.com', 'admin@visiopro.com')
ORDER BY u.email;

-- ============================================================
-- MIGRATION 047 — Trigger de segurança: garante empresa_id
-- correto em contas PF na inserção/atualização
-- Evita cartões sumindo por empresa_id cruzado entre clientes
-- ============================================================

-- Função: corrige empresa_id de contas PF automaticamente
CREATE OR REPLACE FUNCTION public.garantir_empresa_id_conta_pf()
RETURNS TRIGGER AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  -- Só age em contas PF com user_id definido
  IF NEW.categoria = 'pf' AND NEW.user_id IS NOT NULL THEN
    -- Busca a empresa correta do usuário
    SELECT empresa_id INTO v_empresa_id
    FROM public.perfis
    WHERE id = NEW.user_id
    LIMIT 1;

    -- Se encontrou e é diferente do atual, corrige
    IF v_empresa_id IS NOT NULL AND NEW.empresa_id IS DISTINCT FROM v_empresa_id THEN
      NEW.empresa_id := v_empresa_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove trigger antigo se existir
DROP TRIGGER IF EXISTS trg_garantir_empresa_id_conta_pf ON public.contas;

-- Cria trigger que roda ANTES de INSERT ou UPDATE
CREATE TRIGGER trg_garantir_empresa_id_conta_pf
  BEFORE INSERT OR UPDATE ON public.contas
  FOR EACH ROW
  EXECUTE FUNCTION public.garantir_empresa_id_conta_pf();

-- ── Correção retroativa: garante que contas PF existentes
--    já tenham o empresa_id correto do usuário dono
UPDATE public.contas c
SET empresa_id = p.empresa_id
FROM public.perfis p
WHERE c.user_id = p.id
  AND c.categoria = 'pf'
  AND c.empresa_id IS DISTINCT FROM p.empresa_id
  AND p.empresa_id IS NOT NULL;

-- ── Corrige contas PF sem user_id atribuindo ao owner da empresa
UPDATE public.contas c
SET user_id = e.owner_id
FROM public.empresas e
WHERE c.empresa_id = e.id
  AND c.categoria = 'pf'
  AND c.user_id IS NULL
  AND e.owner_id IS NOT NULL;

-- Resultado esperado: ZERO contas PF com empresa_id errado ou sem user_id

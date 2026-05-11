-- ============================================================
-- Migration 038: Corrige isolamento de faturas_cartoes por user_id
--               A tabela contas já tem user_id desde migration 018.
--               Aqui corrigimos faturas_cartoes que ficou com USING(true).
-- ============================================================

-- 1. Adiciona user_id em faturas_cartoes (se não existir)
ALTER TABLE public.faturas_cartoes
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Preenche user_id a partir do user_id da conta vinculada
UPDATE public.faturas_cartoes fc
SET user_id = c.user_id
FROM public.contas c
WHERE fc.conta_id = c.id
  AND fc.user_id IS NULL
  AND c.user_id IS NOT NULL;

-- 3. Índice para performance
CREATE INDEX IF NOT EXISTS idx_faturas_cartoes_user_id ON public.faturas_cartoes(user_id);

-- 4. Troca a policy aberta por isolamento real por user_id
DROP POLICY IF EXISTS "Acesso total faturas_cartoes" ON public.faturas_cartoes;

CREATE POLICY "faturas_cartoes_user_isolado" ON public.faturas_cartoes
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Trigger: quando inserir uma fatura, preenche user_id automaticamente
CREATE OR REPLACE FUNCTION public.set_fatura_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id
    FROM public.contas
    WHERE id = NEW.conta_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_fatura_user_id ON public.faturas_cartoes;
CREATE TRIGGER trg_set_fatura_user_id
  BEFORE INSERT ON public.faturas_cartoes
  FOR EACH ROW EXECUTE FUNCTION public.set_fatura_user_id();

-- 6. Verifica estado final
SELECT
  fc.id,
  c.nome_cartao,
  fc.mes_referencia,
  fc.valor_fechado,
  fc.user_id IS NOT NULL AS tem_user_id
FROM public.faturas_cartoes fc
JOIN public.contas c ON c.id = fc.conta_id
ORDER BY fc.created_at DESC
LIMIT 20;

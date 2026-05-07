
-- Adiciona triggers de empresa_id para imoveis e financiamentos que faltaram na migration 015

DROP TRIGGER IF EXISTS trg_auto_empresa_imoveis ON public.imoveis;
CREATE TRIGGER trg_auto_empresa_imoveis
  BEFORE INSERT ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_financiamentos ON public.financiamentos;
CREATE TRIGGER trg_auto_empresa_financiamentos
  BEFORE INSERT ON public.financiamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

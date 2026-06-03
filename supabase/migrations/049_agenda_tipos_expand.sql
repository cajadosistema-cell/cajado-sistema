-- ============================================================
-- MIGRATION 049: Expande tipos válidos da agenda_eventos
-- Problema: Elena gerava tipos 'vencimento', 'prazo', 'pessoal'
-- que não estavam na constraint CHECK original da tabela.
-- Isso causava erro: "new row for relation agenda_eventos violates check"
-- ============================================================

-- Remove a constraint antiga e recria com todos os tipos que a Elena usa
ALTER TABLE public.agenda_eventos
  DROP CONSTRAINT IF EXISTS agenda_eventos_tipo_check;

ALTER TABLE public.agenda_eventos
  ADD CONSTRAINT agenda_eventos_tipo_check
  CHECK (tipo IN (
    'compromisso',
    'lembrete',
    'nota',
    'tarefa',
    'aniversario',
    'reuniao',
    'vencimento',
    'prazo',
    'pessoal'
  ));

COMMENT ON CONSTRAINT agenda_eventos_tipo_check ON public.agenda_eventos
  IS 'Tipos válidos de evento. Sincronize com TIPOS_EVENTO_VALIDOS em elena-constants.ts';

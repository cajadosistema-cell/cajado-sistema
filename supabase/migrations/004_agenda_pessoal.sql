-- ============================================================
-- SISTEMA CAJADO - MIGRATION 004
-- Agenda Pessoal: compromissos, lembretes, notas rápidas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agenda_eventos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'compromisso'
    CHECK (tipo IN ('compromisso','lembrete','nota','tarefa','aniversario','reuniao')),
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ,
  dia_inteiro BOOLEAN DEFAULT FALSE,
  recorrencia TEXT DEFAULT 'nenhuma'
    CHECK (recorrencia IN ('nenhuma','diaria','semanal','mensal','anual')),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','concluido','cancelado')),
  prioridade TEXT NOT NULL DEFAULT 'normal'
    CHECK (prioridade IN ('baixa','normal','alta','urgente')),
  cor TEXT DEFAULT '#f5a623',
  lembrete_minutos INTEGER, -- ex: 30 = lembrar 30 min antes
  origem TEXT DEFAULT 'manual'
    CHECK (origem IN ('manual','voz','ia','sistema')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agenda_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario ve e edita proprios eventos" ON public.agenda_eventos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_agenda BEFORE UPDATE ON public.agenda_eventos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_agenda_user_data ON public.agenda_eventos(user_id, data_inicio);
CREATE INDEX idx_agenda_status ON public.agenda_eventos(status, data_inicio);

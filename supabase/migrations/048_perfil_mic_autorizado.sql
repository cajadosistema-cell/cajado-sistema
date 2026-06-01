-- Migration 048: adiciona campos de preferências da Elena no perfil
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS mic_autorizado    BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS elena_prefs       JSONB   DEFAULT '{}';

-- mic_autorizado: true = usuário já autorizou microfone (salvo no banco, não só localStorage)
-- elena_prefs: configurações gerais da elena por usuário (futuro)

COMMENT ON COLUMN public.perfis.mic_autorizado IS 'Permissão de microfone concedida pelo usuário para a Elena';
COMMENT ON COLUMN public.perfis.elena_prefs    IS 'Preferências da Elena por usuário (modo voz, idioma, etc.)';

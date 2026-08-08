-- ================================================================
-- Migration 079: Fix diario_entradas_tipo_check
-- ================================================================

-- 1. Converter registros antigos (que violam a nova constraint)
UPDATE public.diario_entradas SET tipo = 'reflexao' WHERE tipo = 'diario';
UPDATE public.diario_entradas SET tipo = 'marco' WHERE tipo = 'snapshot';

-- 2. Derrubar a constraint atual, não importa como foi nomeada inicialmente
ALTER TABLE public.diario_entradas DROP CONSTRAINT IF EXISTS diario_entradas_tipo_check;

-- 3. Criar a nova constraint corretamente
ALTER TABLE public.diario_entradas
  ADD CONSTRAINT diario_entradas_tipo_check
  CHECK (tipo IN ('reflexao','decisao','marco','insight','reuniao','espiritual'));

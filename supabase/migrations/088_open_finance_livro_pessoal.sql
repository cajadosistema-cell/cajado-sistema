-- ============================================================
-- SISTEMA CAJADO - MIGRATION 088
-- Open Finance passa a poder gravar no livro PESSOAL.
--
-- O PROBLEMA
-- A importação do Open Finance escreve sempre em `lancamentos`, que é o
-- livro da PJ. Quando a conta é PF — o PicPay da Maiara, por exemplo — a
-- conta aparece certinha com saldo, mas as transações vão parar num livro
-- que as telas de PF não leem. Resultado em 24/09: conta PicPay com
-- R$ 8,53 e "RECEITAS DO MÊS R$ 0,00 · LANÇAMENTOS 0".
--
-- As telas pessoais leem `gastos_pessoais` e `receitas_pessoais` (é onde a
-- Elena lança os gastos do Sr. Max). É para lá que a importação precisa
-- mandar quando a categoria for pf.
--
-- POR QUE ESTA MIGRATION EXISTE
-- Nenhuma das duas tabelas tem como saber que um lançamento já foi
-- importado. Sem isso, cada sincronização repete os mesmos gastos — e
-- gasto duplicado é pior que gasto ausente: o ausente a pessoa percebe,
-- o duplicado ela acredita.
--
-- O ÍNDICE ÚNICO é a trava de verdade. Conferir antes de inserir ajuda,
-- mas não impede duas sincronizações simultâneas de gravarem a mesma
-- transação. O banco impede.
--
-- REVERTER
--     drop index if exists ux_gastos_pessoais_open_finance;
--     drop index if exists ux_receitas_pessoais_open_finance;
--     alter table public.gastos_pessoais   drop column if exists open_finance_id;
--     alter table public.receitas_pessoais drop column if exists open_finance_id;
-- ============================================================

alter table public.gastos_pessoais
  add column if not exists open_finance_id text;

alter table public.receitas_pessoais
  add column if not exists open_finance_id text;

comment on column public.gastos_pessoais.open_finance_id is
  'Id da transação na Pluggy. Preenchido só no que veio do Open Finance; '
  'é o que impede a mesma transação entrar duas vezes.';
comment on column public.receitas_pessoais.open_finance_id is
  'Id da transação na Pluggy. Ver gastos_pessoais.open_finance_id.';

-- Índice PARCIAL: só vale para linhas importadas. Lançamento manual tem
-- `open_finance_id` nulo, e nulo não colide com nulo — o Sr. Max continua
-- lançando quantos almoços quiser.
create unique index if not exists ux_gastos_pessoais_open_finance
  on public.gastos_pessoais (open_finance_id)
  where open_finance_id is not null;

create unique index if not exists ux_receitas_pessoais_open_finance
  on public.receitas_pessoais (open_finance_id)
  where open_finance_id is not null;

notify pgrst, 'reload schema';

select 'Migration 088 OK — open_finance_id no livro pessoal' as status;


-- ============================================================
-- CONFERIR DEPOIS DE RODAR
--
--     select indexname from pg_indexes
--     where tablename in ('gastos_pessoais','receitas_pessoais')
--       and indexname like '%open_finance%';
--   → duas linhas.
--
-- DEPOIS DA MIGRATION: o `route.ts` precisa estar atualizado também.
-- A migration sozinha não muda nada — ela só abre a porta.
-- ============================================================

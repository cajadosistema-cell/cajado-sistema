-- ============================================================
-- SISTEMA CAJADO - MIGRATION 082
-- `auditoria_invariantes` passa a ignorar os dados de teste.
--
-- MOTIVO
-- Os registros com prefixo 'TESTE - ' pertencem à conta
-- admin@visiopro.com e existem de propósito: são o cenário usado
-- para exercitar o sistema sem tocar nos dados do Sr. Max.
--
-- O problema não é a existência deles, é o ruído. Em 04/09/2026 a
-- auditoria ficou com duas linhas permanentes de TESTE. Uma
-- auditoria que nunca chega a zero deixa de ser lida — e a próxima
-- linha, a de verdade, entra no meio das duas sem ninguém notar.
-- Zero linhas tem que voltar a significar "banco íntegro".
--
-- O QUE MUDA
-- Só o filtro. Nenhuma checagem foi adicionada, removida ou
-- alterada em relação à 081; nenhum dado é tocado.
--
-- REVERTER
--     Rodar a migration 081 de novo.
-- ============================================================

create or replace view public.auditoria_invariantes
with (security_invoker = true) as

-- ── usuario: falta um dado que só o Sr. Max sabe ──────────────

select
  'conta_fixa_sem_valor'::text                as codigo,
  'usuario'::text                             as severidade,
  cf.descricao::text                          as item,
  ('dia ' || cf.dia_vencimento)::text         as referencia,
  'Conta recorrente ativa sem valor cadastrado — não entra no total do mês.'::text as explicacao
from public.compromissos_fixos cf
where cf.ativo
  and cf.recorrente
  and coalesce(cf.valor, 0) = 0
  and cf.descricao not like 'TESTE%'

union all
select
  'fatura_sem_valor',
  'usuario',
  c.nome::text,
  f.mes_referencia::text,
  'Fatura do mês sem prévia e sem valor fechado — o cartão entra zerado na projeção.'
from public.faturas_cartoes f
join public.contas c on c.id = f.conta_id
where f.mes_referencia = to_char(current_date, 'YYYY-MM')
  and coalesce(f.valor_previsto, 0) = 0
  and coalesce(f.valor_fechado, 0) = 0
  and c.nome not like 'TESTE%'

-- ── sistema: o código não deveria ter produzido isso ──────────

union all
select
  'pagamento_sem_valor',
  'sistema',
  cf.descricao::text,
  h.mes_referencia::text,
  'Compromisso marcado como pago sem valor: nenhum débito foi lançado.'
from public.historico_pagamentos_mensal h
join public.compromissos_fixos cf on cf.id = h.compromisso_id
where h.status = 'pago'
  and h.valor_pago is null
  and cf.descricao not like 'TESTE%'

union all
select
  'boleto_sem_valor',
  'sistema',
  i.titulo::text,
  p.mes_referencia::text,
  'Boleto de imóvel pago sem valor registrado: a movimentação do mês fica incompleta.'
from public.pagamentos_imoveis p
join public.imoveis i on i.id = p.imovel_id
where p.status = 'pago'
  and p.valor_pago is null
  and i.titulo not like 'TESTE%'

union all
select
  'ancora_atrasada',
  'sistema',
  i.titulo::text,
  i.proximo_vencimento::text,
  'Âncora de vencimento em mês passado: o imóvel aparece como VENCIDO mesmo em dia.'
from public.imoveis i
where i.proximo_vencimento is not null
  and i.proximo_vencimento < date_trunc('month', current_date)
  and coalesce(i.parcelas_pagas, 0) < coalesce(i.parcelas_total, 999999)
  and i.titulo not like 'TESTE%'

union all
select
  'parcelas_acima_do_total',
  'sistema',
  i.titulo::text,
  (i.parcelas_pagas || '/' || i.parcelas_total)::text,
  'Mais parcelas pagas do que o contrato tem: o contrato quita adiantado.'
from public.imoveis i
where i.parcelas_total is not null
  and i.parcelas_pagas > i.parcelas_total
  and i.titulo not like 'TESTE%';


comment on view public.auditoria_invariantes is
  'Estados que o banco não deveria alcançar. Zero linhas = íntegro. '
  'Ignora os registros TESTE% (cenário de teste da conta admin@visiopro.com). '
  'severidade=usuario vira pergunta no briefing da Elena; severidade=sistema é para o desenvolvedor.';

grant select on public.auditoria_invariantes to authenticated;

notify pgrst, 'reload schema';

select 'Migration 082 OK — auditoria ignora dados de teste' as status;


-- ============================================================
-- COMO USAR
--
-- Panorama (agora sem o ruído de TESTE):
--     select * from auditoria_invariantes order by severidade, codigo;
--
-- Para inspecionar o cenário de teste de propósito, a 081 continua
-- servindo de referência: basta rodar a checagem avulsa, ex.:
--     select i.titulo, p.mes_referencia
--     from pagamentos_imoveis p
--     join imoveis i on i.id = p.imovel_id
--     where p.status = 'pago' and p.valor_pago is null;
-- ============================================================

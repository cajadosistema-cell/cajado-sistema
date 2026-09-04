-- ============================================================
-- SISTEMA CAJADO - MIGRATION 083
-- A "virada de mês" dos contratos de investimento, que o código
-- pressupunha existir e nunca existiu.
--
-- O QUE ACONTECIA
-- `useElenaSalvar.ts`, no handler de confirmar_pagamento, tem este
-- comentário:
--
--     "A âncora NÃO é avançada aqui de propósito. (…) Empurrar a
--      âncora é trabalho de virada de mês, não de pagamento."
--
-- A decisão está certa: diferente dos imóveis, que têm
-- `pagamentos_imoveis` guardando cada mês, aqui a linha do contrato
-- é o ÚNICO registro que existe. Se a âncora pulasse no momento do
-- pagamento, o pagamento sumiria do resumo do próprio mês.
--
-- O problema é que a tal virada de mês nunca foi escrita. Resultado
-- em 04/09/2026: Energia Solar (Jurema), Contrato 2 e Contrato 3
-- continuavam com `status = 'pago'` e âncora em agosto. Na tela de
-- setembro o Sr. Max via três contratos com data de agosto, marcados
-- como pagos, e R$ 8.578,15 fora do total do mês.
--
-- O QUE ESTA FUNÇÃO FAZ
-- Avança UM passo — nunca até o mês corrente. Contrato pago em junho
-- que ninguém tocou até setembro vira "julho em aberto", que é a
-- verdade: julho não foi pago. Chamar de novo avança de novo, um mês
-- por vez, até a âncora alcançar o presente.
--
-- `parcela_atual` NÃO é tocada aqui. Ela conta parcelas PAGAS e já
-- foi incrementada no pagamento; a tela mostra `parcela_atual + 1`
-- quando o status é pendente. Somar de novo aqui adiantaria o
-- contador em um — erro cometido e desfeito à mão em 04/09.
--
-- `security invoker` (padrão) mantém o RLS: cada usuário só vira o
-- mês dos próprios contratos.
--
-- REVERTER
--     drop function if exists public.virar_mes_investimentos();
-- ============================================================

create or replace function public.virar_mes_investimentos()
returns integer
language plpgsql
as $$
declare
  v_qtd integer;
begin
  update public.investimentos_contratos
  set proximo_vencimento = (proximo_vencimento + interval '1 month')::date,
      status             = 'pendente'
  where status = 'pago'
    and proximo_vencimento is not null
    -- Só quando o mês da âncora já passou. Dentro do próprio mês o
    -- contrato TEM de continuar aparecendo como pago — é o que o
    -- resumo do mês precisa mostrar.
    and proximo_vencimento < date_trunc('month', current_date)::date
    -- Contrato na última parcela está quitado: não há próxima âncora.
    and coalesce(parcela_atual, 0) < coalesce(parcela_total, 2147483647);

  get diagnostics v_qtd = row_count;
  return v_qtd;
end;
$$;

comment on function public.virar_mes_investimentos() is
  'Avança um mês a âncora dos contratos de investimento pagos cujo mês já passou. '
  'Idempotente dentro do mesmo mês. Chamada na abertura da sessão da Elena.';

grant execute on function public.virar_mes_investimentos() to authenticated;


-- ── A auditoria passa a vigiar isto também ───────────────────
-- Rede de segurança: se ninguém abrir a Elena e a virada não rodar,
-- a linha aparece aqui em vez de aparecer na tela do Sr. Max.

create or replace view public.auditoria_invariantes
with (security_invoker = true) as

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
  and i.titulo not like 'TESTE%'

-- 🆕 083: o caso do Sr. Max em 04/09.
union all
select
  'investimento_nao_virou_o_mes',
  'sistema',
  ic.nome_contrato::text,
  ic.proximo_vencimento::text,
  'Contrato de investimento pago com âncora em mês passado: aparece com data velha e fora do total do mês.'
from public.investimentos_contratos ic
where ic.status = 'pago'
  and ic.proximo_vencimento is not null
  and ic.proximo_vencimento < date_trunc('month', current_date)
  and coalesce(ic.parcela_atual, 0) < coalesce(ic.parcela_total, 2147483647)
  and ic.nome_contrato not like 'TESTE%';


comment on view public.auditoria_invariantes is
  'Estados que o banco não deveria alcançar. Zero linhas = íntegro. '
  'Ignora os registros TESTE% (cenário de teste da conta admin@visiopro.com). '
  'severidade=usuario vira pergunta no briefing da Elena; severidade=sistema é para o desenvolvedor.';

grant select on public.auditoria_invariantes to authenticated;

notify pgrst, 'reload schema';

select 'Migration 083 OK — virada de mes de investimentos + auditoria' as status;

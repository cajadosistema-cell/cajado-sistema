-- ============================================================
-- SISTEMA CAJADO - MIGRATION 081
-- View `auditoria_invariantes`: estados que o banco não deveria
-- conseguir alcançar.
--
-- MOTIVO
-- Entre 02 e 04/09/2026 foram encontrados oito defeitos. Todos
-- tinham deixado rastro no banco dias antes de o Sr. Max notar —
-- ninguém estava olhando. Esta view é o "olhar": zero linhas
-- significa banco íntegro.
--
-- Uma fonte só, dois consumidores:
--   • SQL Editor  → `select * from auditoria_invariantes;`
--   • Briefing da Elena → só a severidade 'usuario', porque é o
--     que o Sr. Max consegue resolver sozinho.
--
-- SEVERIDADE
--   usuario  → falta um dado que só ele sabe (o valor de uma conta).
--              Vira pergunta no briefing das 8h.
--   sistema  → estado que o código não deveria ter produzido.
--              Não incomoda o Sr. Max; é a Maiara que olha.
--
-- SEGURANÇA
-- `security_invoker = true` faz a view rodar com as permissões de
-- quem consulta, então o RLS de cada tabela continua valendo: o
-- Sr. Max só enxerga o que é dele. Sem isso, a view rodaria como o
-- dono e vazaria dados entre empresas.
-- Requer PostgreSQL 15+. Se o projeto for anterior, remova a
-- cláusula `with (...)` — MAS aí a view NÃO pode ser consultada
-- pelo app, só pelo SQL Editor.
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

union all
select
  'parcelas_acima_do_total',
  'sistema',
  i.titulo::text,
  (i.parcelas_pagas || '/' || i.parcelas_total)::text,
  'Mais parcelas pagas do que o contrato tem: o contrato quita adiantado.'
from public.imoveis i
where i.parcelas_total is not null
  and i.parcelas_pagas > i.parcelas_total;


comment on view public.auditoria_invariantes is
  'Estados que o banco não deveria alcançar. Zero linhas = íntegro. '
  'severidade=usuario vira pergunta no briefing da Elena; severidade=sistema é para o desenvolvedor.';

grant select on public.auditoria_invariantes to authenticated;

notify pgrst, 'reload schema';

select 'Migration 081 OK — view auditoria_invariantes criada' as status;


-- ============================================================
-- COMO USAR
--
-- Panorama completo (SQL Editor, ignora RLS — vê tudo):
--     select * from auditoria_invariantes order by severidade, codigo;
--
-- Só o que é problema de código:
--     select * from auditoria_invariantes where severidade = 'sistema';
--
-- Sem os dados de demonstração:
--     select * from auditoria_invariantes where item not like 'TESTE%';
--
-- COMO REVERTER
--     drop view if exists public.auditoria_invariantes;
-- Nenhum dado é afetado — é só leitura.
-- ============================================================

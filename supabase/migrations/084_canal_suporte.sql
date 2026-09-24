-- ============================================================
-- SISTEMA CAJADO - MIGRATION 084
-- Canal de suporte: conversa entre o admin de uma empresa
-- cliente e o suporte da VisioPro.
--
-- POR QUE NÃO SERVE O CHAT DE EQUIPE
-- O chat que existe é DENTRO de uma empresa — cada uma com seus
-- funcionários. Isto aqui atravessa empresas: a Maiara (VisioPro,
-- empresa 9cb2f597) precisa falar com o Sr. Max (Cajado, empresa
-- 658ed627). São dois espaços de visibilidade diferentes e
-- misturá-los seria abrir a empresa de um cliente para outro.
--
-- O QUE ISTO RESOLVE QUE O WHATSAPP NÃO RESOLVE
-- No WhatsApp o "lembrei de tal coisa" rola para cima e ninguém
-- sabe mais se foi feito. Aqui uma mensagem pode ser marcada como
-- PENDENTE e só sai da lista quando alguém a resolve. Conversa
-- normal continua conversa; o que é tarefa fica visível até acabar.
--
-- ALÉM DO DESENVOLVIMENTO
-- Quando o sistema for vendido, esta é a mesma estrutura do canal
-- de suporte: uma conversa por cliente, com histórico e pendências.
-- Por isso a tabela é por `empresa_id` e não uma conversa fixa
-- entre duas pessoas.
--
-- SEGURANÇA — LEIA ANTES DE MEXER
-- Esta é a PRIMEIRA tabela do sistema que atravessa empresas.
-- Toda a separação entre clientes depende das duas políticas
-- abaixo. A regra é: vejo a conversa da MINHA empresa, ou vejo
-- todas SE eu for suporte. Não existe "todo admin vê tudo".
-- ============================================================

-- ── 1. Quem é suporte ────────────────────────────────────────
-- `cargo` já existe em `perfis`, mas é texto livre e descreve
-- função, não permissão. Usar texto livre como regra de segurança
-- é criar um buraco por erro de digitação. Coluna booleana.
alter table public.perfis
  add column if not exists suporte boolean not null default false;

comment on column public.perfis.suporte is
  'true = membro do suporte da VisioPro; enxerga o canal de suporte de TODAS as empresas.';

update public.perfis set suporte = true where email = 'admin@visiopro.com';


-- ── 2. Funções auxiliares ────────────────────────────────────
-- `security definer` de propósito: elas leem `perfis`, que tem RLS.
-- Sem isso a política do canal consultaria uma tabela protegida de
-- dentro de outra política — ou bloqueia, ou recursa.
-- `set search_path` fecha a porta de sequestro de schema, que é o
-- risco clássico de security definer.
create or replace function public.minha_empresa()
returns uuid
language sql stable security definer set search_path = public as $$
  select empresa_id from public.perfis where id = auth.uid()
$$;

create or replace function public.sou_suporte()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select suporte from public.perfis where id = auth.uid()), false)
$$;

grant execute on function public.minha_empresa()  to authenticated;
grant execute on function public.sou_suporte()    to authenticated;


-- ── 3. A tabela ──────────────────────────────────────────────
create table if not exists public.canal_suporte_mensagens (
  id            uuid primary key default gen_random_uuid(),
  -- De QUEM é a conversa. Sempre a empresa CLIENTE, mesmo quando
  -- quem escreve é o suporte — senão a mensagem da Maiara cairia
  -- na conversa da VisioPro consigo mesma.
  empresa_id    uuid        not null,
  autor_id      uuid        not null references auth.users(id),
  texto         text        not null check (length(trim(texto)) > 0),
  -- Marcada como tarefa. É o que diferencia isto de um chat comum.
  pendente      boolean     not null default false,
  resolvido_em  timestamptz,
  resolvido_por uuid        references auth.users(id),
  created_at    timestamptz not null default now()
);

-- Sem FK para `empresas` de propósito: não confirmei o nome dessa
-- tabela no banco, e migration que falha por causa de um nome
-- errado é pior que uma FK a menos. Dá para acrescentar depois.

comment on table public.canal_suporte_mensagens is
  'Conversa entre o admin de uma empresa cliente e o suporte da VisioPro. '
  'Mensagem com pendente=true e resolvido_em nulo aparece na aba Pendências.';

-- A conversa é lida sempre em ordem, por empresa.
create index if not exists idx_canal_suporte_empresa_data
  on public.canal_suporte_mensagens (empresa_id, created_at desc);

-- Índice parcial: as pendências abertas são poucas e consultadas
-- o tempo todo (contador no menu). Parcial para não carregar o
-- histórico inteiro só para contar três itens.
create index if not exists idx_canal_suporte_pendentes
  on public.canal_suporte_mensagens (empresa_id)
  where pendente and resolvido_em is null;


-- ── 4. RLS ───────────────────────────────────────────────────
alter table public.canal_suporte_mensagens enable row level security;

drop policy if exists canal_suporte_ler      on public.canal_suporte_mensagens;
drop policy if exists canal_suporte_escrever on public.canal_suporte_mensagens;
drop policy if exists canal_suporte_atualiza on public.canal_suporte_mensagens;

-- LER: a minha empresa, ou todas se eu for suporte.
create policy canal_suporte_ler
  on public.canal_suporte_mensagens for select
  using (empresa_id = public.minha_empresa() or public.sou_suporte());

-- ESCREVER: idem, e o autor tem de ser quem está logado. Sem essa
-- segunda condição, qualquer um poderia escrever em nome de outro.
create policy canal_suporte_escrever
  on public.canal_suporte_mensagens for insert
  with check (
    autor_id = auth.uid()
    and (empresa_id = public.minha_empresa() or public.sou_suporte())
  );

-- ATUALIZAR: serve para marcar pendente e resolver. `using` decide
-- quais linhas posso tocar; `with check` impede que a edição mova a
-- mensagem para a empresa de outro cliente.
create policy canal_suporte_atualiza
  on public.canal_suporte_mensagens for update
  using      (empresa_id = public.minha_empresa() or public.sou_suporte())
  with check (empresa_id = public.minha_empresa() or public.sou_suporte());

-- Apagar não tem política: ninguém apaga. Histórico de suporte que
-- some é pior que histórico feio.

grant select, insert, update on public.canal_suporte_mensagens to authenticated;


-- ── 5. Realtime ──────────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table public.canal_suporte_mensagens;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';

select 'Migration 084 OK — canal de suporte criado' as status;


-- ============================================================
-- CONFERIR DEPOIS DE RODAR
--
-- 1) O suporte foi marcado?
--      select nome, email, suporte from perfis order by suporte desc;
--    Só admin@visiopro.com deve estar com true.
--
-- 2) As políticas existem?
--      select policyname, cmd from pg_policies
--      where tablename = 'canal_suporte_mensagens';
--    Três linhas: ler (SELECT), escrever (INSERT), atualiza (UPDATE).
--
-- ⚠️ O SQL Editor roda como dono do banco e IGNORA RLS — testar a
-- separação por ali não prova nada. A prova é na aplicação, logada
-- como o Sr. Max: ele tem de ver a conversa dele e nenhuma outra.
--
-- COMO REVERTER
--      drop table if exists public.canal_suporte_mensagens;
--      drop function if exists public.sou_suporte();
--      drop function if exists public.minha_empresa();
--      alter table public.perfis drop column if exists suporte;
-- ============================================================

-- ============================================================
-- SISTEMA CAJADO - MIGRATION 087
-- Pendências no chat: a mensagem vira tarefa sem sair da conversa.
--
-- O PROBLEMA QUE ISTO RESOLVE
-- A Maiara descreveu assim: "tipo WhatsApp mesmo — lembrei de tal coisa,
-- você já resolveu? Só que no WhatsApp, quando a gente fala com muitas
-- pessoas, acaba ficando para trás."
--
-- É isso: conversar é fácil, não esquecer é que não. Aqui a mensagem que
-- é tarefa ganha uma marca e só sai da lista quando alguém resolve.
-- Conversa continua conversa; o que é combinado fica visível até acabar.
--
-- POR QUE NÃO UMA TABELA DE TAREFAS
-- Porque o combinado NASCE na conversa. Obrigar a redigitar num formulário
-- é o passo que ninguém dá — e aí volta a ficar só no chat, esquecido.
-- Três colunas na mensagem custam menos e são usadas mais.
--
-- REVERTER
--     alter table public.chat_interno
--       drop column if exists pendente,
--       drop column if exists resolvido_em,
--       drop column if exists resolvido_por;
--     (e refazer o grant da 085: grant update (lido) ...)
-- ============================================================

alter table public.chat_interno
  add column if not exists pendente      boolean not null default false,
  add column if not exists resolvido_em  timestamptz,
  add column if not exists resolvido_por uuid references auth.users(id);

comment on column public.chat_interno.pendente is
  'Mensagem marcada como tarefa. Aberta enquanto resolvido_em for nulo.';

-- Índice parcial: as pendências abertas são poucas e consultadas o tempo
-- todo (o contador no cabeçalho). Parcial para não varrer a conversa
-- inteira só para contar três itens.
create index if not exists idx_chat_pendencias_abertas
  on public.chat_interno (created_at desc)
  where pendente and resolvido_em is null;


-- ── Quem pode marcar ─────────────────────────────────────────
-- A 085 deixou o UPDATE restrito à coluna `lido`. Agora as três novas
-- colunas também precisam entrar no grant — RLS escolhe LINHAS, o grant
-- escolhe COLUNAS, e sem os dois a marcação falha em silêncio.
--
-- `texto`, `anexo_path` e `remetente_id` continuam FORA: ninguém reescreve
-- mensagem, nem a própria. Marcar como resolvida é o que se pode fazer.
revoke update on public.chat_interno from authenticated;
grant  update (lido, pendente, resolvido_em, resolvido_por)
  on public.chat_interno to authenticated;

-- A política da 085 só permitia ao DESTINATÁRIO mexer. Para pendência isso
-- é pouco: quem escreve "preciso que você veja X" quer poder marcar a
-- própria mensagem. Agora vale para os dois lados da conversa.
drop policy if exists chat_marcar_lida   on public.chat_interno;
drop policy if exists chat_marcar_estado on public.chat_interno;

create policy chat_marcar_estado
  on public.chat_interno for update
  using (
    destinatario_id = auth.uid()
    or remetente_id = auth.uid()
    or destinatario_id is null      -- canal Geral
  )
  with check (
    destinatario_id = auth.uid()
    or remetente_id = auth.uid()
    or destinatario_id is null
  );

notify pgrst, 'reload schema';

select 'Migration 087 OK — pendencias no chat' as status;


-- ============================================================
-- CONFERIR DEPOIS DE RODAR
--
--     select policyname, cmd from pg_policies
--     where tablename = 'chat_interno' order by policyname;
--   → chat_insert (INSERT), chat_marcar_estado (UPDATE), chat_select (SELECT)
--     e NENHUMA com ALL.
--
--     select column_name, privilege_type
--     from information_schema.column_privileges
--     where table_name = 'chat_interno' and grantee = 'authenticated'
--       and privilege_type = 'UPDATE';
--   → quatro linhas: lido, pendente, resolvido_em, resolvido_por.
--     Se `texto` aparecer aí, o revoke não pegou e alguém pode reescrever
--     mensagem dos outros.
-- ============================================================

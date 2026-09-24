-- ============================================================
-- SISTEMA CAJADO - MIGRATION 085
-- Fecha o buraco de RLS do chat interno.
--
-- O QUE ESTAVA ERRADO
-- A tabela `chat_interno` tinha três políticas:
--
--   chat_insert       INSERT  with_check (remetente_id = auth.uid())   ✅
--   chat_interno_all  ALL     using/check (auth.role() = 'authenticated')  ⚠️
--   chat_select       SELECT  using (destinatario_id is null
--                                    or remetente_id = auth.uid()
--                                    or destinatario_id = auth.uid())  ✅
--
-- A do meio cobre ler, inserir, ALTERAR e APAGAR, e a condição é só
-- "estar logado". Políticas de RLS se somam com OU — então ela anulava
-- a `chat_select` inteira. Na prática, qualquer usuário autenticado
-- podia ler, editar e apagar qualquer mensagem de qualquer pessoa de
-- qualquer empresa.
--
-- Com quatro usuários (três de teste) isso é pequeno. No dia em que o
-- sistema tiver dois clientes, é vazamento entre eles — e um cliente
-- conseguindo APAGAR a conversa do outro.
--
-- O QUE MUDA
-- 1) A política `ALL` sai. `chat_select` e `chat_insert` voltam a valer
--    de verdade.
-- 2) Entra uma política de UPDATE estreita: só quem é destinatário
--    (ou o canal Geral, destinatario_id nulo) pode atualizar.
-- 3) O privilégio de UPDATE é reduzido à COLUNA `lido`. Política de RLS
--    escolhe LINHAS, não colunas — sem este passo, quem pode marcar como
--    lida também poderia reescrever o texto da mensagem alheia. O grant
--    por coluna é o que fecha isso.
-- 4) DELETE fica sem política nenhuma: ninguém apaga mensagem. Histórico
--    de conversa que some é pior que histórico feio.
--
-- ⚠️ ANTES DE RODAR
-- Confirme que nada no app faz update em `chat_interno` além de `lido`
-- (o `comunicacao-client.tsx` só faz insert; falta conferir o
-- `chat-notifications.tsx`). Se algum código alterar outra coluna, ele
-- vai passar a falhar — e é melhor descobrir agora que em produção.
-- ============================================================

-- ── 1. Fora a política que anulava as outras ─────────────────
drop policy if exists chat_interno_all on public.chat_interno;

-- ── 2. UPDATE só para marcar como lida ───────────────────────
drop policy if exists chat_marcar_lida on public.chat_interno;

create policy chat_marcar_lida
  on public.chat_interno for update
  using      (destinatario_id = auth.uid() or destinatario_id is null)
  with check (destinatario_id = auth.uid() or destinatario_id is null);

-- ── 3. Privilégio de coluna: só `lido` pode ser alterada ─────
-- Este é o passo que impede reescrever mensagem dos outros. RLS decide
-- QUAIS LINHAS; o grant decide QUAIS COLUNAS. Precisa dos dois.
revoke update on public.chat_interno from authenticated;
grant  update (lido) on public.chat_interno to authenticated;

-- select e insert continuam como estavam
grant select, insert on public.chat_interno to authenticated;

notify pgrst, 'reload schema';

select 'Migration 085 OK — RLS do chat_interno fechado' as status;


-- ============================================================
-- CONFERIR DEPOIS DE RODAR
--
--     select policyname, cmd from pg_policies
--     where tablename = 'chat_interno' order by policyname;
--
-- Esperado — três linhas, e NENHUMA com cmd = ALL:
--     chat_insert        INSERT
--     chat_marcar_lida   UPDATE
--     chat_select        SELECT
--
-- ⚠️ O SQL Editor roda como dono do banco e ignora RLS. A prova é na
-- aplicação: o Sr. Max tem de ver o canal Geral e as conversas dele, e
-- nada além disso.
--
-- COMO REVERTER (volta ao estado inseguro de antes)
--     drop policy if exists chat_marcar_lida on public.chat_interno;
--     create policy chat_interno_all on public.chat_interno for all
--       using (auth.role() = 'authenticated')
--       with check (auth.role() = 'authenticated');
--     grant update on public.chat_interno to authenticated;
-- ============================================================

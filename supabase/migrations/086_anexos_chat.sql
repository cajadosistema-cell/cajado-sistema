-- ============================================================
-- SISTEMA CAJADO - MIGRATION 086
-- Anexos no chat interno: bucket privado + colunas.
--
-- POR QUE NÃO SEGUIR O PADRÃO DO ÁUDIO
-- `chat_interno.audio_base64` guarda o arquivo INTEIRO dentro da linha,
-- em texto. Para um áudio de dez segundos passa. Para foto não: o Sr.
-- Max fotografa um boleto, saem 3 MB, viram ~4 MB em base64 — e a
-- consulta do chat traz 150 mensagens de uma vez. Duas dezenas de fotos
-- e a tela leva dez segundos para abrir, no celular dele, no 4G.
--
-- Aqui a imagem vai para o Storage e na linha fica só o caminho. A linha
-- continua com 200 bytes e a foto carrega sob demanda.
--
-- POR QUE UM BUCKET NOVO, E PRIVADO
-- O projeto já tem o `inbox-media`, mas ele é PÚBLICO — qualquer um com
-- o endereço abre, sem login. Faz sentido para mídia do WhatsApp, que
-- precisa ser buscada por URL aberta. Não faz para foto de boleto, com
-- código de barras e valor. Bucket privado, acesso só por URL assinada
-- com validade.
--
-- REVERTER
--     drop policy if exists chat_anexos_enviar on storage.objects;
--     drop policy if exists chat_anexos_ler    on storage.objects;
--     delete from storage.buckets where id = 'chat-anexos';
--     alter table public.chat_interno
--       drop column if exists anexo_path, drop column if exists anexo_tipo;
-- ============================================================

-- ── 1. Colunas ───────────────────────────────────────────────
-- `anexo_path`, não `anexo_url`: em bucket privado não existe URL fixa.
-- Guardamos o caminho e o app pede uma URL assinada na hora de mostrar.
-- Nome honesto evita alguém tentar usar o valor como src direto e não
-- entender por que a imagem não abre.
alter table public.chat_interno
  add column if not exists anexo_path text,
  add column if not exists anexo_tipo text;

comment on column public.chat_interno.anexo_path is
  'Caminho do arquivo no bucket chat-anexos. NÃO é URL — use createSignedUrl.';
comment on column public.chat_interno.anexo_tipo is
  'MIME do anexo (image/jpeg, application/pdf...). Decide como a bolha renderiza.';

-- `anexo_tipo` já aceita PDF de propósito. O Max manda foto de boleto
-- hoje; PDF é a próxima coisa que ele vai querer mandar, e assim não
-- precisa de outra migration.


-- ── 2. O bucket ──────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-anexos', 'chat-anexos',
  false,                      -- privado
  10485760,                   -- 10 MB por arquivo
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- O limite e a lista de tipos são a segunda trava. A primeira é o
-- redimensionamento no navegador (1600px, JPEG 0.8) — uma foto de 4 MB
-- vira ~300 KB sem perder legibilidade de boleto. O limite aqui pega o
-- caso em que alguém contorna a tela.


-- ── 3. Quem pode ler e escrever ──────────────────────────────
drop policy if exists chat_anexos_ler    on storage.objects;
drop policy if exists chat_anexos_enviar on storage.objects;

-- LER: qualquer usuário logado. É o mesmo alcance que as mensagens do
-- canal Geral já têm — não faria sentido a mensagem aparecer e o anexo
-- dela não.
create policy chat_anexos_ler
  on storage.objects for select
  using (bucket_id = 'chat-anexos' and auth.role() = 'authenticated');

-- ESCREVER: só dentro da própria pasta. O caminho é `<user_id>/arquivo`,
-- e a política exige que a primeira pasta seja o id de quem está logado.
-- Sem isso, um usuário poderia gravar na pasta de outro.
create policy chat_anexos_enviar
  on storage.objects for insert
  with check (
    bucket_id = 'chat-anexos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Sem política de update nem delete: arquivo enviado não se altera nem
-- se apaga. Mesma decisão das mensagens.

notify pgrst, 'reload schema';

select 'Migration 086 OK — anexos no chat' as status;


-- ============================================================
-- CONFERIR DEPOIS DE RODAR
--
--     select id, public, file_size_limit from storage.buckets
--     where id = 'chat-anexos';
--   → uma linha, public = false, limite 10485760
--
--     select policyname, cmd from pg_policies
--     where tablename = 'objects' and policyname like 'chat_anexos%';
--   → duas linhas: SELECT e INSERT
-- ============================================================

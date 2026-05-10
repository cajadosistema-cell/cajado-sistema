-- Criação do bucket inbox-media para armazenar arquivos enviados/recebidos no chat
INSERT INTO storage.buckets (id, name, public) 
VALUES ('inbox-media', 'inbox-media', true)
ON CONFLICT (id) DO NOTHING;

-- Política para permitir que o backend e usuários autenticados façam upload
CREATE POLICY "Permitir upload autenticado em inbox-media"
ON storage.objects FOR INSERT
TO authenticated, service_role
WITH CHECK (bucket_id = 'inbox-media');

-- Política para permitir acesso público de leitura (necessário para a Evolution API e visualização)
CREATE POLICY "Permitir leitura pública em inbox-media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'inbox-media');

-- Política para exclusão (apenas donos/admin ou service_role)
CREATE POLICY "Permitir delete para roles"
ON storage.objects FOR DELETE
TO authenticated, service_role
USING (bucket_id = 'inbox-media');

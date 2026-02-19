
-- Remover políticas restritivas criadas anteriormente para documentos_processos
DROP POLICY IF EXISTS "Users can view documents from accessible processos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload documents to processos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents in processos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents in processos" ON storage.objects;

-- Remover políticas restritivas para repositorio_documentos
DROP POLICY IF EXISTS "Users can view repositorio documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to repositorio" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own repositorio documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own repositorio documents" ON storage.objects;

-- Políticas abertas para todos os membros autenticados - documentos_processos
CREATE POLICY "Authenticated users can view documentos_processos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documentos_processos');

CREATE POLICY "Authenticated users can upload documentos_processos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos_processos');

CREATE POLICY "Authenticated users can update documentos_processos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documentos_processos');

CREATE POLICY "Authenticated users can delete documentos_processos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documentos_processos');

-- Políticas abertas para todos os membros autenticados - repositorio_documentos
CREATE POLICY "Authenticated users can view repositorio_documentos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'repositorio_documentos');

CREATE POLICY "Authenticated users can upload repositorio_documentos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'repositorio_documentos');

CREATE POLICY "Authenticated users can update repositorio_documentos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'repositorio_documentos');

CREATE POLICY "Authenticated users can delete repositorio_documentos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'repositorio_documentos');

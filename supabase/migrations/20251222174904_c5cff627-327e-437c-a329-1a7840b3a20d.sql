-- Drop existing policies for the bucket if they exist
DROP POLICY IF EXISTS "Users can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to documentos_processos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documentos_processos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documentos_processos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documentos_processos" ON storage.objects;

-- Create policies for documentos_processos bucket
CREATE POLICY "Authenticated users can upload to documentos_processos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documentos_processos');

CREATE POLICY "Authenticated users can view documentos_processos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documentos_processos');

CREATE POLICY "Authenticated users can update documentos_processos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'documentos_processos');

CREATE POLICY "Authenticated users can delete documentos_processos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documentos_processos');
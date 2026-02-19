
-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop old overly permissive storage policies for documentos_processos
DROP POLICY IF EXISTS "Authenticated users can upload to documentos_processos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documentos_processos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documentos_processos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documentos_processos" ON storage.objects;

-- Drop any pre-existing restricted policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view documents from accessible processos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to documentos_processos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents in documentos_processos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents in documentos_processos" ON storage.objects;

-- Restricted SELECT policy for documentos_processos
CREATE POLICY "Users can view documents from accessible processos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos_processos'
  AND (
    public.is_admin_or_coordenador(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.documentos d
      WHERE d.url LIKE '%' || name || '%'
        AND (
          d.uploaded_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.processos p
            WHERE p.id = d.processo_id
              AND (
                p.advogado_responsavel_id = auth.uid()
                OR p.coordenacao_id IN (
                  SELECT coordenacao_id FROM public.membros_coordenacao
                  WHERE usuario_id = auth.uid()
                )
              )
          )
        )
    )
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Restricted INSERT policy for documentos_processos
CREATE POLICY "Users can upload to documentos_processos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos_processos'
  AND auth.uid() IS NOT NULL
);

-- Restricted UPDATE policy for documentos_processos
CREATE POLICY "Users can update their own documents in documentos_processos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documentos_processos'
  AND (
    public.is_admin_or_coordenador(auth.uid())
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.documentos d
      WHERE d.url LIKE '%' || name || '%'
        AND d.uploaded_by = auth.uid()
    )
  )
);

-- Restricted DELETE policy for documentos_processos
CREATE POLICY "Users can delete their own documents in documentos_processos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos_processos'
  AND (
    public.is_admin_or_coordenador(auth.uid())
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.documentos d
      WHERE d.url LIKE '%' || name || '%'
        AND d.uploaded_by = auth.uid()
    )
  )
);

-- Fix repositorio_documentos policies (drop and recreate with proper restrictions)
DROP POLICY IF EXISTS "Users can view repositorio_documentos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to repositorio_documentos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their repositorio_documentos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their repositorio_documentos" ON storage.objects;

CREATE POLICY "Users can view repositorio_documentos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'repositorio_documentos'
  AND (
    public.is_admin_or_coordenador(auth.uid())
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "Users can upload to repositorio_documentos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'repositorio_documentos'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their repositorio_documentos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'repositorio_documentos'
  AND (
    public.is_admin_or_coordenador(auth.uid())
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "Users can delete their repositorio_documentos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'repositorio_documentos'
  AND (
    public.is_admin_or_coordenador(auth.uid())
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

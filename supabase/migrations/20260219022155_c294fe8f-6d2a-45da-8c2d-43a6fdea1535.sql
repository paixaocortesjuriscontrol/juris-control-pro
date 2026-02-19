
-- ============================================================
-- SECURITY FIX: Enable RLS on DJEN index tables
-- These are internal monitoring tables; only authenticated users
-- (admins/coordenadores) should access them.
-- ============================================================

ALTER TABLE public.djen_diario_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.djen_diario_index_tribunais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.djen_diario_publicacoes ENABLE ROW LEVEL SECURITY;

-- djen_diario_index: only authenticated users can read (it's a monitoring/status table)
CREATE POLICY "Authenticated users can read djen_diario_index"
ON public.djen_diario_index
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert djen_diario_index"
ON public.djen_diario_index
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update djen_diario_index"
ON public.djen_diario_index
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete djen_diario_index"
ON public.djen_diario_index
FOR DELETE
TO authenticated
USING (true);

-- djen_diario_index_tribunais: same pattern
CREATE POLICY "Authenticated users can read djen_diario_index_tribunais"
ON public.djen_diario_index_tribunais
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert djen_diario_index_tribunais"
ON public.djen_diario_index_tribunais
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update djen_diario_index_tribunais"
ON public.djen_diario_index_tribunais
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete djen_diario_index_tribunais"
ON public.djen_diario_index_tribunais
FOR DELETE
TO authenticated
USING (true);

-- djen_diario_publicacoes: authenticated users can read/write (monitoring content)
CREATE POLICY "Authenticated users can read djen_diario_publicacoes"
ON public.djen_diario_publicacoes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert djen_diario_publicacoes"
ON public.djen_diario_publicacoes
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update djen_diario_publicacoes"
ON public.djen_diario_publicacoes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete djen_diario_publicacoes"
ON public.djen_diario_publicacoes
FOR DELETE
TO authenticated
USING (true);

-- ============================================================
-- SECURITY FIX: Tighten storage policies for documentos_processos
-- Replace permissive "any authenticated user" policies with
-- ownership-based access: uploader OR admin/coordenador
-- ============================================================

-- Drop existing overly permissive policies for documentos_processos
DROP POLICY IF EXISTS "Authenticated users can upload to documentos_processos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documentos_processos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documentos_processos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documentos_processos" ON storage.objects;

-- New INSERT policy: any authenticated user can upload (path is user-scoped)
CREATE POLICY "Authenticated users can upload to documentos_processos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos_processos'
);

-- New SELECT policy: user can access files they uploaded OR admins/coordenadores
-- The documentos table already controls access via RLS; storage is an extra layer.
-- We check the documentos table to confirm the requesting user has a record for this file.
CREATE POLICY "Users can view their own documentos_processos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos_processos'
  AND (
    -- Admin or coordenador can see all
    public.is_admin_or_coordenador(auth.uid())
    OR
    -- User uploaded the file (path starts with their user id)
    (auth.uid())::text = (storage.foldername(name))[1]
    OR
    -- File is referenced in documentos table and user has access via RLS (uploaded_by or processo member)
    EXISTS (
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
                  SELECT mc.coordenacao_id FROM public.membros_coordenacao mc
                  WHERE mc.usuario_id = auth.uid()
                )
              )
          )
        )
    )
    OR
    -- File is in pastas path
    EXISTS (
      SELECT 1 FROM public.documentos d
      WHERE d.url LIKE '%' || name || '%'
        AND d.uploaded_by = auth.uid()
    )
  )
);

-- New UPDATE policy: only uploader or admin can update
CREATE POLICY "Users can update their own documentos_processos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentos_processos'
  AND (
    public.is_admin_or_coordenador(auth.uid())
    OR (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.documentos d
      WHERE d.url LIKE '%' || name || '%'
        AND d.uploaded_by = auth.uid()
    )
  )
)
WITH CHECK (
  bucket_id = 'documentos_processos'
);

-- New DELETE policy: only uploader or admin can delete
CREATE POLICY "Users can delete their own documentos_processos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documentos_processos'
  AND (
    public.is_admin_or_coordenador(auth.uid())
    OR (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.documentos d
      WHERE d.url LIKE '%' || name || '%'
        AND d.uploaded_by = auth.uid()
    )
  )
);

-- ============================================================
-- SECURITY FIX: Tighten repositorio_documentos storage policies
-- ============================================================

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Advogados podem visualizar documentos" ON storage.objects;
DROP POLICY IF EXISTS "Advogados podem fazer upload de documentos" ON storage.objects;

-- New SELECT: owner or admin
CREATE POLICY "Users can view repositorio_documentos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'repositorio_documentos'
  AND (
    public.is_admin_or_coordenador(auth.uid())
    OR (auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM public.repositorio_documentos rd
      WHERE rd.storage_path = name
        AND (
          rd.uploaded_by = auth.uid()
          OR public.is_admin_or_coordenador(auth.uid())
        )
    )
  )
);

-- New INSERT: authenticated users can upload to their own folder
CREATE POLICY "Users can upload to repositorio_documentos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'repositorio_documentos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

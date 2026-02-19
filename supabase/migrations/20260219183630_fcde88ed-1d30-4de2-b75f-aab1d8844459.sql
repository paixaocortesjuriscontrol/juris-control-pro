-- Remove overly permissive storage policies that grant full access to all authenticated users
-- These co-exist with stricter policies and override them (any-match wins in Postgres RLS OR logic)

-- documentos_processos: remove the broad permissive SELECT/INSERT/UPDATE/DELETE policies
DROP POLICY IF EXISTS "Authenticated users can view documentos_processos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documentos_processos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documentos_processos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete documentos_processos" ON storage.objects;

-- repositorio_documentos: remove the broad permissive SELECT/INSERT/UPDATE/DELETE policies
DROP POLICY IF EXISTS "Authenticated users can view repositorio_documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload repositorio_documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update repositorio_documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete repositorio_documentos" ON storage.objects;

-- Also remove duplicate/older restrictive policies that are superseded by the newer ones
DROP POLICY IF EXISTS "Advogados podem visualizar documentos" ON storage.objects;

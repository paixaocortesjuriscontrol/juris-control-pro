
-- ================================================================
-- Tighten overly permissive RLS policies (corrected)
-- ================================================================

-- ----------------------------------------------------------------
-- 1. CLIENTES: Replace USING(true) with scoped access
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view clients" ON public.clientes;
DROP POLICY IF EXISTS "Authenticated users can manage clients" ON public.clientes;
DROP POLICY IF EXISTS "Allow authenticated users to manage clients" ON public.clientes;
DROP POLICY IF EXISTS "Allow all authenticated" ON public.clientes;
DROP POLICY IF EXISTS "clientes_select_scoped" ON public.clientes;
DROP POLICY IF EXISTS "clientes_insert_admin" ON public.clientes;
DROP POLICY IF EXISTS "clientes_update_admin" ON public.clientes;
DROP POLICY IF EXISTS "clientes_delete_admin" ON public.clientes;

CREATE POLICY "clientes_select_scoped"
ON public.clientes FOR SELECT TO authenticated
USING (
  public.is_admin_or_coordenador(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.clientes_usuarios cu
    WHERE cu.cliente_id = clientes.id
      AND cu.user_id = auth.uid()
      AND cu.ativo = true
  )
);

CREATE POLICY "clientes_insert_admin"
ON public.clientes FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_coordenador(auth.uid()));

CREATE POLICY "clientes_update_admin"
ON public.clientes FOR UPDATE TO authenticated
USING (public.is_admin_or_coordenador(auth.uid()));

CREATE POLICY "clientes_delete_admin"
ON public.clientes FOR DELETE TO authenticated
USING (public.is_admin_or_coordenador(auth.uid()));

-- ----------------------------------------------------------------
-- 2. PROCESSOS: Scope SELECT to coordination members
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view processos" ON public.processos;
DROP POLICY IF EXISTS "Allow authenticated users to view processos" ON public.processos;
DROP POLICY IF EXISTS "processos_select_authenticated" ON public.processos;
DROP POLICY IF EXISTS "processos_select_scoped" ON public.processos;

CREATE POLICY "processos_select_scoped"
ON public.processos FOR SELECT TO authenticated
USING (
  public.is_admin_or_coordenador(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao mc
    WHERE mc.coordenacao_id = processos.coordenacao_id
      AND mc.usuario_id = auth.uid()
  )
  OR processos.advogado_responsavel_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.processos_responsaveis pr
    WHERE pr.processo_id = processos.id
      AND pr.usuario_id = auth.uid()
      AND pr.ativo = true
  )
);

-- ----------------------------------------------------------------
-- 3. MOVIMENTACOES: Scope to users with access to parent process
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS "Allow authenticated users to view movimentacoes" ON public.movimentacoes;
DROP POLICY IF EXISTS "movimentacoes_select_authenticated" ON public.movimentacoes;
DROP POLICY IF EXISTS "movimentacoes_select_scoped" ON public.movimentacoes;

CREATE POLICY "movimentacoes_select_scoped"
ON public.movimentacoes FOR SELECT TO authenticated
USING (
  public.is_admin_or_coordenador(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.processos p
    JOIN public.membros_coordenacao mc ON mc.coordenacao_id = p.coordenacao_id
    WHERE p.id = movimentacoes.processo_id
      AND mc.usuario_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.processos p
    WHERE p.id = movimentacoes.processo_id
      AND p.advogado_responsavel_id = auth.uid()
  )
);

-- ----------------------------------------------------------------
-- 4. DOCUMENTOS: Scope to coordination members or uploader
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view documentos" ON public.documentos;
DROP POLICY IF EXISTS "Allow authenticated users to view documentos" ON public.documentos;
DROP POLICY IF EXISTS "documentos_select_authenticated" ON public.documentos;
DROP POLICY IF EXISTS "documentos_select_scoped" ON public.documentos;

CREATE POLICY "documentos_select_scoped"
ON public.documentos FOR SELECT TO authenticated
USING (
  public.is_admin_or_coordenador(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.processos p
    JOIN public.membros_coordenacao mc ON mc.coordenacao_id = p.coordenacao_id
    WHERE p.id = documentos.processo_id
      AND mc.usuario_id = auth.uid()
  )
  OR documentos.uploaded_by = auth.uid()
);

-- ----------------------------------------------------------------
-- 5. DJEN index tables: Scope to authenticated (keep functional but block anon)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all authenticated users full access" ON public.djen_diario_index;
DROP POLICY IF EXISTS "djen_diario_index_all" ON public.djen_diario_index;
DROP POLICY IF EXISTS "djen_diario_index_authenticated" ON public.djen_diario_index;

CREATE POLICY "djen_diario_index_authenticated"
ON public.djen_diario_index FOR ALL TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated users full access" ON public.djen_diario_index_tribunais;
DROP POLICY IF EXISTS "djen_diario_index_tribunais_all" ON public.djen_diario_index_tribunais;
DROP POLICY IF EXISTS "djen_diario_index_tribunais_authenticated" ON public.djen_diario_index_tribunais;

CREATE POLICY "djen_diario_index_tribunais_authenticated"
ON public.djen_diario_index_tribunais FOR ALL TO authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all authenticated users full access" ON public.djen_diario_publicacoes;
DROP POLICY IF EXISTS "djen_diario_publicacoes_all" ON public.djen_diario_publicacoes;
DROP POLICY IF EXISTS "djen_diario_publicacoes_authenticated" ON public.djen_diario_publicacoes;

CREATE POLICY "djen_diario_publicacoes_authenticated"
ON public.djen_diario_publicacoes FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------
-- 6. DJE tables: Ensure authenticated-only access
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated users to select" ON public.dje_pdfs_diarios;
DROP POLICY IF EXISTS "dje_pdfs_diarios_select" ON public.dje_pdfs_diarios;
DROP POLICY IF EXISTS "dje_pdfs_diarios_select_authenticated" ON public.dje_pdfs_diarios;

CREATE POLICY "dje_pdfs_diarios_select_authenticated"
ON public.dje_pdfs_diarios FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to select" ON public.dje_conteudo_indexado;
DROP POLICY IF EXISTS "dje_conteudo_indexado_select" ON public.dje_conteudo_indexado;
DROP POLICY IF EXISTS "dje_conteudo_indexado_select_authenticated" ON public.dje_conteudo_indexado;

CREATE POLICY "dje_conteudo_indexado_select_authenticated"
ON public.dje_conteudo_indexado FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to select" ON public.dje_resultados_busca;
DROP POLICY IF EXISTS "dje_resultados_busca_select" ON public.dje_resultados_busca;
DROP POLICY IF EXISTS "dje_resultados_busca_select_authenticated" ON public.dje_resultados_busca;

CREATE POLICY "dje_resultados_busca_select_authenticated"
ON public.dje_resultados_busca FOR SELECT TO authenticated USING (true);

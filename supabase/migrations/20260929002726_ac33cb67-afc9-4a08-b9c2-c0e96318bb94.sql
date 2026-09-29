
-- dados_benner: select/insert/update eram true
DROP POLICY IF EXISTS dados_benner_select ON public.dados_benner;
CREATE POLICY dados_benner_select ON public.dados_benner FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS dados_benner_insert ON public.dados_benner;
CREATE POLICY dados_benner_insert ON public.dados_benner FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS dados_benner_update ON public.dados_benner;
CREATE POLICY dados_benner_update ON public.dados_benner FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- judit_logs: expõe user_email; leitura só do próprio usuário ou admin/coordenador
DROP POLICY IF EXISTS "Authenticated can view judit_logs" ON public.judit_logs;
CREATE POLICY "Authenticated can view judit_logs" ON public.judit_logs FOR SELECT TO authenticated USING (created_by = auth.uid() OR is_admin_or_coordenador(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can insert judit_logs" ON public.judit_logs;
CREATE POLICY "Authenticated can insert judit_logs" ON public.judit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- judit_anexos
DROP POLICY IF EXISTS "Authenticated can view judit_anexos" ON public.judit_anexos;
CREATE POLICY "Authenticated can view judit_anexos" ON public.judit_anexos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated can insert judit_anexos" ON public.judit_anexos;
CREATE POLICY "Authenticated can insert judit_anexos" ON public.judit_anexos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated can update judit_anexos" ON public.judit_anexos;
CREATE POLICY "Authenticated can update judit_anexos" ON public.judit_anexos FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- audiencia_envolvidos
DROP POLICY IF EXISTS "auth read audiencia_envolvidos" ON public.audiencia_envolvidos;
CREATE POLICY "auth read audiencia_envolvidos" ON public.audiencia_envolvidos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth write audiencia_envolvidos" ON public.audiencia_envolvidos;
CREATE POLICY "auth write audiencia_envolvidos" ON public.audiencia_envolvidos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth delete audiencia_envolvidos" ON public.audiencia_envolvidos;
CREATE POLICY "auth delete audiencia_envolvidos" ON public.audiencia_envolvidos FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- tarefa_envolvidos
DROP POLICY IF EXISTS "auth read tarefa_envolvidos" ON public.tarefa_envolvidos;
CREATE POLICY "auth read tarefa_envolvidos" ON public.tarefa_envolvidos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth write tarefa_envolvidos" ON public.tarefa_envolvidos;
CREATE POLICY "auth write tarefa_envolvidos" ON public.tarefa_envolvidos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth delete tarefa_envolvidos" ON public.tarefa_envolvidos;
CREATE POLICY "auth delete tarefa_envolvidos" ON public.tarefa_envolvidos FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- teses_juridicas: leitura compartilhada, mas só logados
DROP POLICY IF EXISTS teses_juridicas_select ON public.teses_juridicas;
CREATE POLICY teses_juridicas_select ON public.teses_juridicas FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- pecas_geradas: leitura só logados
DROP POLICY IF EXISTS pecas_geradas_select ON public.pecas_geradas;
CREATE POLICY pecas_geradas_select ON public.pecas_geradas FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- execucoes_agendadas: escrita só admin/coordenador
DROP POLICY IF EXISTS "Usuarios autenticados podem atualizar execucoes" ON public.execucoes_agendadas;
CREATE POLICY "Usuarios autenticados podem atualizar execucoes" ON public.execucoes_agendadas FOR UPDATE TO authenticated USING (is_admin_or_coordenador(auth.uid())) WITH CHECK (is_admin_or_coordenador(auth.uid()));
DROP POLICY IF EXISTS "Usuarios autenticados podem criar execucoes" ON public.execucoes_agendadas;
CREATE POLICY "Usuarios autenticados podem criar execucoes" ON public.execucoes_agendadas FOR INSERT TO authenticated WITH CHECK (is_admin_or_coordenador(auth.uid()));

-- classificacao_relatores_tst: leitura logados, escrita admin/coordenador
DROP POLICY IF EXISTS "Authenticated can view relatores tst" ON public.classificacao_relatores_tst;
CREATE POLICY "Authenticated can view relatores tst" ON public.classificacao_relatores_tst FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated can insert relatores tst" ON public.classificacao_relatores_tst;
CREATE POLICY "Authenticated can insert relatores tst" ON public.classificacao_relatores_tst FOR INSERT TO authenticated WITH CHECK (is_admin_or_coordenador(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can update relatores tst" ON public.classificacao_relatores_tst;
CREATE POLICY "Authenticated can update relatores tst" ON public.classificacao_relatores_tst FOR UPDATE TO authenticated USING (is_admin_or_coordenador(auth.uid())) WITH CHECK (is_admin_or_coordenador(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can delete relatores tst" ON public.classificacao_relatores_tst;
CREATE POLICY "Authenticated can delete relatores tst" ON public.classificacao_relatores_tst FOR DELETE TO authenticated USING (is_admin_or_coordenador(auth.uid()));

-- djen_diario_index_tribunais: remove policy ALL true e fecha as demais
DROP POLICY IF EXISTS djen_diario_index_tribunais_authenticated ON public.djen_diario_index_tribunais;
DROP POLICY IF EXISTS "Authenticated users can read djen_diario_index_tribunais" ON public.djen_diario_index_tribunais;
CREATE POLICY "Authenticated users can read djen_diario_index_tribunais" ON public.djen_diario_index_tribunais FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can insert djen_diario_index_tribunais" ON public.djen_diario_index_tribunais;
CREATE POLICY "Authenticated users can insert djen_diario_index_tribunais" ON public.djen_diario_index_tribunais FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can update djen_diario_index_tribunais" ON public.djen_diario_index_tribunais;
CREATE POLICY "Authenticated users can update djen_diario_index_tribunais" ON public.djen_diario_index_tribunais FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated users can delete djen_diario_index_tribunais" ON public.djen_diario_index_tribunais;
CREATE POLICY "Authenticated users can delete djen_diario_index_tribunais" ON public.djen_diario_index_tribunais FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- dje_resultados_busca
DROP POLICY IF EXISTS "Usuários autenticados podem ver resultados de busca" ON public.dje_resultados_busca;
DROP POLICY IF EXISTS dje_resultados_busca_select_authenticated ON public.dje_resultados_busca;
CREATE POLICY dje_resultados_busca_select_authenticated ON public.dje_resultados_busca FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- repositorio_documentos: leitura só logados
DROP POLICY IF EXISTS "Advogados podem ver todos os documentos" ON public.repositorio_documentos;
CREATE POLICY "Advogados podem ver todos os documentos" ON public.repositorio_documentos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- publicacoes_djen_leituras: cada um vê só as próprias leituras
DROP POLICY IF EXISTS sel_leituras ON public.publicacoes_djen_leituras;
CREATE POLICY sel_leituras ON public.publicacoes_djen_leituras FOR SELECT TO authenticated USING (usuario_id = auth.uid());

-- publicacoes_djen_execucoes
DROP POLICY IF EXISTS "auth read publicacoes_djen_execucoes" ON public.publicacoes_djen_execucoes;
CREATE POLICY "auth read publicacoes_djen_execucoes" ON public.publicacoes_djen_execucoes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "auth insert publicacoes_djen_execucoes" ON public.publicacoes_djen_execucoes;
CREATE POLICY "auth insert publicacoes_djen_execucoes" ON public.publicacoes_djen_execucoes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- publicacoes_djen_servidor_execucoes
DROP POLICY IF EXISTS authenticated_select_pubdjen_servidor_execucoes ON public.publicacoes_djen_servidor_execucoes;
CREATE POLICY authenticated_select_pubdjen_servidor_execucoes ON public.publicacoes_djen_servidor_execucoes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- permissoes_situacao_tipo_tarefa
DROP POLICY IF EXISTS permissoes_situacao_select ON public.permissoes_situacao_tipo_tarefa;
CREATE POLICY permissoes_situacao_select ON public.permissoes_situacao_tipo_tarefa FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- alertas_parcela: alinhar update/insert com a regra de delete (can_manage_evento)
DROP POLICY IF EXISTS "Alertas parcela podem ser atualizados" ON public.alertas_parcela;
CREATE POLICY "Alertas parcela podem ser atualizados" ON public.alertas_parcela FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM parcelas_evento pe JOIN eventos_agenda ea ON ea.id = pe.evento_id WHERE pe.id = alertas_parcela.parcela_id AND can_manage_evento(auth.uid(), ea.id)));
DROP POLICY IF EXISTS "Alertas parcela podem ser criados por usuários autenticados" ON public.alertas_parcela;
CREATE POLICY "Alertas parcela podem ser criados por usuários autenticados" ON public.alertas_parcela FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM parcelas_evento pe JOIN eventos_agenda ea ON ea.id = pe.evento_id WHERE pe.id = alertas_parcela.parcela_id AND can_manage_evento(auth.uid(), ea.id)));

-- processos_capturados: escrita só logados
DROP POLICY IF EXISTS "Sistema pode atualizar processos capturados" ON public.processos_capturados;
CREATE POLICY "Sistema pode atualizar processos capturados" ON public.processos_capturados FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Sistema pode inserir processos capturados" ON public.processos_capturados;
CREATE POLICY "Sistema pode inserir processos capturados" ON public.processos_capturados FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- depositos_recursais: insert anônimo aberto -> só logados
DROP POLICY IF EXISTS "Authenticated users can insert deposits" ON public.depositos_recursais;

-- publicacoes_djen_descartadas: insert aberto -> só logados (motor browser grava logado)
DROP POLICY IF EXISTS "System can insert descartadas" ON public.publicacoes_djen_descartadas;
CREATE POLICY "System can insert descartadas" ON public.publicacoes_djen_descartadas FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- publicacoes_djen_processos: insert aberto -> só logados
DROP POLICY IF EXISTS "Sistema pode inserir publicações" ON public.publicacoes_djen_processos;
CREATE POLICY "Sistema pode inserir publicações" ON public.publicacoes_djen_processos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- logs_captura_tribunal: insert aberto -> só logados
DROP POLICY IF EXISTS "Sistema pode inserir logs" ON public.logs_captura_tribunal;
CREATE POLICY "Sistema pode inserir logs" ON public.logs_captura_tribunal FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- dj_estaduais_pdfs
DROP POLICY IF EXISTS dj_estaduais_pdfs_select_authenticated ON public.dj_estaduais_pdfs;
CREATE POLICY dj_estaduais_pdfs_select_authenticated ON public.dj_estaduais_pdfs FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- configuracoes_monitoramento_servidor: leitura só admin/coordenador
DROP POLICY IF EXISTS "Autenticados leem configs servidor" ON public.configuracoes_monitoramento_servidor;
CREATE POLICY "Autenticados leem configs servidor" ON public.configuracoes_monitoramento_servidor FOR SELECT TO authenticated USING (is_admin_or_coordenador(auth.uid()));

-- tipo_monitoramento
DROP POLICY IF EXISTS "Autenticados podem ler tipos de monitoramento" ON public.tipo_monitoramento;
CREATE POLICY "Autenticados podem ler tipos de monitoramento" ON public.tipo_monitoramento FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

BEGIN;
CREATE TEMP TABLE correcao_audiencia_titulo ON COMMIT DROP AS
WITH base AS (
 SELECT a.id audiencia_id,a.tarefa_id,a.status audiencia_status,to_jsonb(a) audiencia_antes,to_jsonb(t) tarefa_antes,
 translate(upper(a.titulo),'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','AAAAAEEEEIIIIOOOOOUUUUC') n
 FROM public.audiencias_detectadas a JOIN public.tarefas t ON t.id=a.tarefa_id
 WHERE a.coordenacao_id='968631d0-6659-46f1-b45d-899892cb0121' AND a.origem='projuris' AND t.origem='projuris'
 AND a.status<>'cancelado_oculto' AND t.status='cancelado_oculto' AND t.coordenacao_id=a.coordenacao_id
 AND coalesce(a.titulo,'') !~* '\maudi[eê]ncias?\M'
)
SELECT *, CASE WHEN n ~ '^\W*(\(RAPIDO\)\s*)?(MANIFESTAR|APRESENTAR|CONTESTACAO|DEFESA|INTERPOR|OPOR|PROTOCOLAR|PETICIONAR|IMPUGNAR|CONTRARRAZOES|RECURSO|EMBARGOS)\M' OR n ~ '^\W*(INT|PUB|DISP)\M.*\mPF\M' THEN 'prazo' ELSE 'tarefa' END destino FROM base;
DO $$ BEGIN
 IF (SELECT count(*) FROM correcao_audiencia_titulo)<>349 THEN RAISE EXCEPTION 'Contagem divergente'; END IF;
 IF (SELECT count(*) FROM correcao_audiencia_titulo WHERE destino='prazo')<>3 THEN RAISE EXCEPTION 'Contagem prazos divergente'; END IF;
 IF EXISTS(SELECT 1 FROM public.documentos d JOIN correcao_audiencia_titulo c ON c.audiencia_id=d.audiencia_id WHERE d.tarefa_id IS NOT NULL AND d.tarefa_id<>c.tarefa_id) THEN RAISE EXCEPTION 'Vínculo divergente de anexo'; END IF;
END $$;
ALTER TABLE public.tarefas DISABLE TRIGGER trg_notif_mudanca_tarefas;
ALTER TABLE public.audiencias_detectadas DISABLE TRIGGER trg_notif_mudanca_audiencias;
ALTER TABLE public.comentarios_tarefas DISABLE TRIGGER trg_comentario_tarefa;
UPDATE public.migracoes_projuris_itens m SET dados=coalesce(m.dados,'{}'::jsonb)||jsonb_build_object('correcao_audiencia_sem_titulo_20261022',jsonb_build_object('motivo','Título sem a palavra audiência','audiencia_antes',c.audiencia_antes,'tarefa_antes',c.tarefa_antes,'destino',c.destino)) FROM correcao_audiencia_titulo c WHERE m.registro_id=c.tarefa_id AND m.tipo='tarefa';
UPDATE public.tarefas t SET tipo_tarefa=CASE WHEN c.destino='prazo' THEN 'PRAZO' ELSE 'TAREFA' END,tipo_registro=c.destino,status=CASE WHEN c.audiencia_status='concluido' THEN 'cumprido'::public.status_tarefa ELSE c.audiencia_status::public.status_tarefa END FROM correcao_audiencia_titulo c WHERE t.id=c.tarefa_id;
INSERT INTO public.tarefa_responsaveis(tarefa_id,usuario_id) SELECT DISTINCT c.tarefa_id,r.advogado_id FROM correcao_audiencia_titulo c JOIN public.audiencias_advogados r ON r.audiencia_id=c.audiencia_id ON CONFLICT(tarefa_id,usuario_id) DO NOTHING;
INSERT INTO public.tarefa_envolvidos(tarefa_id,usuario_id) SELECT DISTINCT c.tarefa_id,r.usuario_id FROM correcao_audiencia_titulo c JOIN public.audiencia_envolvidos r ON r.audiencia_id=c.audiencia_id ON CONFLICT(tarefa_id,usuario_id) DO NOTHING;
UPDATE public.documentos d SET tarefa_id=c.tarefa_id FROM correcao_audiencia_titulo c WHERE d.audiencia_id=c.audiencia_id AND d.tarefa_id IS NULL;
INSERT INTO public.comentarios_tarefas(id,tarefa_id,autor_id,conteudo,created_at,mencionados,is_cobranca) SELECT cm.id,c.tarefa_id,cm.autor_id,cm.conteudo,cm.created_at,cm.mencionados,cm.is_cobranca FROM public.comentarios_audiencias cm JOIN correcao_audiencia_titulo c ON c.audiencia_id=cm.audiencia_id ON CONFLICT(id) DO NOTHING;
INSERT INTO public.etiquetas_itens(etiqueta_id,entidade,entidade_id,created_by) SELECT e.etiqueta_id,c.destino,c.tarefa_id,e.created_by FROM public.etiquetas_itens e JOIN correcao_audiencia_titulo c ON c.audiencia_id=e.entidade_id WHERE e.entidade='audiencia' ON CONFLICT(etiqueta_id,entidade,entidade_id) DO NOTHING;
UPDATE public.subatividades_item s SET tipo_item=c.destino,item_id=c.tarefa_id FROM correcao_audiencia_titulo c WHERE s.item_id=c.audiencia_id;
INSERT INTO public.tarefas_publicacoes(tarefa_id,publicacao_id) SELECT c.tarefa_id,p.publicacao_id FROM correcao_audiencia_titulo c JOIN public.audiencias_publicacoes p ON p.audiencia_id=c.audiencia_id ON CONFLICT DO NOTHING;
INSERT INTO public.tarefas_publicacoes_processos(tarefa_id,publicacao_processo_id) SELECT c.tarefa_id,p.publicacao_processo_id FROM correcao_audiencia_titulo c JOIN public.audiencias_publicacoes_processos p ON p.audiencia_id=c.audiencia_id ON CONFLICT DO NOTHING;
UPDATE public.audiencias_detectadas a SET status='cancelado_oculto',observacoes=coalesce(a.observacoes,'')||E'\nCorreção Projuris em 22/10/2026: título sem audiência; restaurado como '||upper(c.destino)||' na tarefa original, mantendo histórico.' FROM correcao_audiencia_titulo c WHERE a.id=c.audiencia_id;
DO $$ BEGIN
 IF (SELECT count(*) FROM correcao_audiencia_titulo c JOIN public.tarefas t ON t.id=c.tarefa_id JOIN public.audiencias_detectadas a ON a.id=c.audiencia_id WHERE t.tipo_registro=c.destino AND t.tipo_tarefa=CASE WHEN c.destino='prazo' THEN 'PRAZO' ELSE 'TAREFA' END AND a.status='cancelado_oculto' AND t.status::text=CASE WHEN c.audiencia_status='concluido' THEN 'cumprido' ELSE c.audiencia_status END AND t.data_vencimento IS NOT DISTINCT FROM (c.tarefa_antes->>'data_vencimento')::date AND t.data_fatal IS NOT DISTINCT FROM (c.tarefa_antes->>'data_fatal')::date AND t.processo_id IS NOT DISTINCT FROM (c.tarefa_antes->>'processo_id')::uuid AND t.responsavel_id IS NOT DISTINCT FROM (c.tarefa_antes->>'responsavel_id')::uuid AND t.coordenacao_id IS NOT DISTINCT FROM (c.tarefa_antes->>'coordenacao_id')::uuid)<>349 THEN RAISE EXCEPTION 'Verificação final falhou'; END IF;
 IF EXISTS(SELECT 1 FROM public.notificacoes_fila n JOIN correcao_audiencia_titulo c ON n.entidade_id IN(c.tarefa_id,c.audiencia_id) WHERE n.created_at>=transaction_timestamp()) THEN RAISE EXCEPTION 'Notificação inesperada'; END IF;
END $$;
ALTER TABLE public.tarefas ENABLE TRIGGER trg_notif_mudanca_tarefas;
ALTER TABLE public.audiencias_detectadas ENABLE TRIGGER trg_notif_mudanca_audiencias;
ALTER TABLE public.comentarios_tarefas ENABLE TRIGGER trg_comentario_tarefa;
COMMIT;
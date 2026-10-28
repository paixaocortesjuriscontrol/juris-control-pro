DO $import$
DECLARE
 coord uuid := '968631d0-6659-46f1-b45d-899892cb0121';
 batch uuid := md5('projuris-workflows-santander-civel-20261028')::uuid;
 actor uuid;
 w record;
 s record;
 wid uuid;
 sid uuid;
 prev uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('projuris-workflows-santander-civel-20261028'));
 IF NOT EXISTS (SELECT 1 FROM public.coordenacoes WHERE id=coord AND nome='Coordenação Santander Cível') THEN RAISE EXCEPTION 'Coordenação divergente'; END IF;
 IF EXISTS (SELECT 1 FROM public.migracoes_projuris WHERE id=batch) THEN
   IF (SELECT count(*) FROM public.migracoes_projuris_itens WHERE migracao_id=batch AND tipo='workflow') <> 22 OR (SELECT count(*) FROM public.migracoes_projuris_itens WHERE migracao_id=batch AND tipo='workflow_etapa') <> 47 THEN RAISE EXCEPTION 'Importação anterior incompleta'; END IF;
   RETURN;
 END IF;
 SELECT m.criado_por INTO actor FROM public.migracoes_projuris m WHERE m.coordenacao_id=coord ORDER BY m.created_at DESC LIMIT 1;
 IF actor IS NULL THEN RAISE EXCEPTION 'Referência de autoria histórica indisponível'; END IF;
 INSERT INTO public.migracoes_projuris(id,coordenacao_id,nome,status,criado_por,mapeamento,contadores)
 VALUES(batch,coord,'Workflows Projuris — modelos Santander Cível — 28/10/2026','concluida',actor,
 jsonb_build_object('origem','workflow-2.csv;etapaworkflow-2.csv;etapaworkflowtarefa-2.csv;tarefatipo-3.csv','execucao','manutencao autorizada pelo solicitante; criado_por reutiliza referencia historica, nao representa sessao autenticada','selecao','originais ativos e habilitados, versao atual exata','revisao','Todos inativos: revisar responsaveis, checklists e condicoes antes de ativar; historico e copias nao importados'),jsonb_build_object('workflows',22,'etapas',47,'execucoes_criadas',0,'tarefas_criadas',0));
 FOR w IN SELECT * FROM (VALUES
 ('4769','3','DISPENSA RECURSAL'),('4770','43','OF COM MULTA'),('4780','3','OF SEM MULTA'),
 ('4784','3','OF DEFINITIVA COM MULTA (SIMULADOR: NÃO RECORRER)'),('4785','3','OF DEFINITIVA SEM MULTA (SIMULADOR: NÃO RECORRER)'),
 ('4789','4','PGTO/OF DE CONDENAÇÃO'),('4788','4','PGTO/OF DE ACORDO'),('4790','4','PGTO DE CONDENAÇÃO'),
 ('4196','14','SIMULADOR 1ª FASE'),('4197','9','SIMULADOR 2ª FASE'),('18630','2','PGTO DE HO DE PERITO'),('26181','2','DESCUMPRIMENTO DE OF'),
 ('31087','2','PGTO DE CUSTAS'),('31088','2','PGTO DE HO DE CONCILIADOR'),('35172','2','SIMULADOR APÓS EDS 2ª FASE'),('4198','12','SIMULADOR APÓS EDS 1ª FASE'),
 ('4853','5','SOLICITAÇÃO DE DOCS'),('5477','6','PGTO/IMPUGNAÇÃO DE REMANESCENTE'),('4787','5','OF PROVISÓRIA SEM MULTA (SIMULADOR: RECORRER)'),
 ('4786','4','OF PROVISÓRIA COM MULTA (SIMULADOR: RECORRER)'),('57835','9','AGI'),('57880','2','DEFESA + AGI')
 ) AS models(source,version,title) LOOP
 wid := md5('projuris-workflow:'||coord::text||':'||w.source)::uuid;
 IF EXISTS(SELECT 1 FROM public.workflows WHERE id=wid OR (coordenacao_id=coord AND nome=w.title)) THEN RAISE EXCEPTION 'Modelo já existente: %',w.title; END IF;
 INSERT INTO public.workflows(id,coordenacao_id,nome,descricao,ativo)
 VALUES(wid,coord,w.title,'Importado do Projuris (workflow '||w.source||', versão '||w.version||'). Inativo para revisão de responsáveis e checklists; sem execução automática.',false);
 INSERT INTO public.migracoes_projuris_itens(migracao_id,tipo,chave_externa,registro_id,status,dados)
 VALUES(batch,'workflow',w.source,wid,'importado',jsonb_build_object('versao',w.version,'ativo_origem',true,'ativo_destino',false,'revisao_pendente',true));
 END LOOP;
 FOR s IN SELECT * FROM (VALUES
 ('4769','114336',NULL::text,'SOLICITAÇÃO DE DISPENSA RECURSAL',0,'dias_corridos',NULL::text),
 ('4769','114337','114336','ACOMPANHAMENTO: DISPENSA RECURSAL',2,'dias_corridos',NULL),
 ('4770','114678',NULL,'OF COM MULTA',0,'dias_corridos',NULL),('4770','114679','114678','COMPROVAÇÃO DE OF',8,'dias_corridos',NULL),
 ('4780','114559',NULL,'OF SEM MULTA',0,'dias_corridos',NULL),('4780','114560','114559','COMPROVAÇÃO DE OF',8,'dias_corridos',NULL),
 ('4784','114564',NULL,'OF DEFINITIVA COM MULTA (SIMULADOR: NÃO RECORRER)',0,'dias_corridos',NULL),('4784','114565','114564','COMPROVAÇÃO DE OF',8,'dias_corridos',NULL),
 ('4785','114586',NULL,'OF DEFINITIVA SEM MULTA (SIMULADOR: NÃO RECORRER)',0,'dias_corridos',NULL),('4785','114587','114586','COMPROVAÇÃO DE OF',8,'dias_corridos',NULL),
 ('4789','114669',NULL,'PGTO/OF DE CONDENAÇÃO',0,'dias_corridos',E'Analisar e alinhar com o Jhon se há matéria de impugnação: \n• Diferença entre cálculos (autor x banco)\n• Of cumpridas/pendentes\n• Astreintes'),
 ('4789','114670','114669','COMPROVAÇÃO DE PGTO/OF DE CONDENAÇÃO',8,'dias_corridos',NULL),
 ('4789','114671','114670','ENCERRAMENTO: PARCIAL PROCEDÊNCIA/PROCEDÊNCIA',3,'dias_corridos','Se houver recurso interposto pelo requerente ou pelo corréu, criar obrigatoriamente o evento "recurso interposto pela parte autora".'),
 ('4788','114647',NULL,'PGTO/OF DE ACORDO',0,'dias_corridos','Analisar e alinhar com o Jhon se há matéria de impugnação.'),
 ('4788','114648','114647','COMPROVAÇÃO DE PGTO/OF DE ACORDO',8,'dias_corridos','ATENÇÃO: Obrigatório inserção do evento de acordo.'),
 ('4788','114649','114648','ENCERRAMENTO: ACORDO',1,'dias_corridos','Se houver recurso interposto pelo requerente ou pelo corréu, criar obrigatoriamente o evento "recurso interposto pela parte autora".'),
 ('4790','114680',NULL,'PGTO DE CONDENAÇÃO',0,'dias_corridos',E'Analisar e alinhar com o Jhon se há matéria de impugnação: \n• Diferença entre cálculos (autor x banco)\n• Of cumpridas/pendentes\n• Astreintes'),
 ('4790','114681','114680','COMPROVAÇÃO DE PGTO',8,'dias_corridos',NULL),
 ('4790','114682','114681','ENCERRAMENTO: PARCIAL PROCEDÊNCIA/PROCEDÊNCIA',3,'dias_corridos','Se houver recurso interposto pelo requerente ou pelo corréu, criar obrigatoriamente o evento "recurso interposto pela parte autora".'),
 ('4196','258810',NULL,'SIMULADOR 1ª FASE',1,'dias_uteis','RESPONDER CHECKLIST ABAIXO'),('4196','258811','258810','PROVIDÊNCIAS APÓS SIMULADOR',2,'dias_corridos',NULL),
 ('4197','258812',NULL,'SIMULADOR 2ª FASE',1,'dias_uteis','RESPONDER CHECKLIST ABAIXO'),('4197','258813','258812','PROVIDÊNCIAS APÓS SIMULADOR',2,'dias_corridos',NULL),
 ('18630','268408',NULL,'PGTO DE HO DE PERITO',1,'dias_corridos',NULL),('18630','268409','268408','COMPROVAÇÃO DE PGTO DE HO DE PERITO',4,'dias_corridos',NULL),
 ('26181','349853',NULL,'VERIFICAÇÃO DE DESCUMPRIMENTO DE OF',1,'dias_corridos','Analisar, adotar providências e reagendar para manifestar dentro do prazo.'),('26181','349854','349853','COMPROVAÇÃO DE OF',8,'dias_corridos',NULL),
 ('31087','410305',NULL,'PGTO DE CUSTAS',1,'dias_corridos',NULL),('31087','410306','410305','COMPROVAÇÃO DE PGTO DE CUSTAS',4,'dias_uteis',NULL),
 ('31088','410311',NULL,'PGTO DE HO DE CONCILIADOR',1,'dias_corridos',NULL),('31088','410312','410311','COMPROVAÇÃO DE PGTO DE HO DE CONCILIADOR',4,'dias_uteis',NULL),
 ('35172','446901',NULL,'SIMULADOR APÓS EDS 2ª FASE',1,'dias_uteis','RESPONDER CHECKLIST ABAIXO.'),('35172','446902','446901','PROVIDÊNCIAS APÓS SIMULADOR',2,'dias_corridos',NULL),
 ('4198','462220',NULL,'SIMULADOR APÓS EDS 1ª FASE',1,'dias_uteis','RESPONDER CHECKLIST ABAIXO'),('4198','462221','462220','PROVIDÊNCIAS APÓS SIMULADOR',2,'dias_corridos',NULL),
 ('4853','462222',NULL,'SOLICITAÇÃO DE DOCS',1,'dias_corridos',NULL),('4853','462223','462222','APRESENTAÇÃO DE DOCS',5,'dias_corridos',NULL),
 ('5477','467698',NULL,'PGTO/IMPUGNAÇÃO DE REMANESCENTE',1,'dias_corridos',E'Analisar e alinhar com o Jhon se há matéria de impugnação: \n• Diferença entre cálculos (autor x banco)\n• Of cumpridas/pendentes\n• Astreintes'),('5477','467699','467698','COMPROVAÇÃO DE PGTO',8,'dias_corridos',NULL),
 ('4787','655439',NULL,'OF PROVISÓRIA SEM MULTA (SIMULADOR: RECORRER)',0,'dias_corridos',NULL),('4787','655440','655439','COMPROVAÇÃO DE OF',8,'dias_corridos','No ato da comprovação deve constar expressamente na petição que o cumprimento da obrigação se deu em caráter provisório.'),
 ('4786','655441',NULL,'OF PROVISÓRIA COM MULTA (SIMULADOR: RECORRER)',0,'dias_corridos',NULL),('4786','655442','655441','COMPROVAÇÃO DE OF',8,'dias_corridos','No ato da comprovação deve constar expressamente na petição que o cumprimento da obrigação se deu em caráter provisório.'),
 ('57835','655913',NULL,'AGI',14,'dias_uteis','ATENÇÃO: ao cumprir essa tarefa, será gerada uma nova para comunicar a interposição do recurso no processo principal e na mesma petição fazer o pedido de reconsideração.'),
 ('57835','655914','655913','MANIFESTAÇÃO',0,'dias_uteis','Comunicar a interposição do recurso no processo principal e na mesma petição fazer o pedido de reconsideração.'),
 ('57880','655917',NULL,'DEFESA + AGI',14,'dias_uteis','ATENÇÃO: ao cumprir essa tarefa, será gerada uma nova para comunicar a interposição do AGI no processo principal e na mesma petição fazer o pedido de reconsideração.'),
 ('57880','655918','655917','MANIFESTAÇÃO',0,'dias_uteis','Comunicar a interposição do AGI no processo principal e na mesma petição fazer o pedido de reconsideração.')
 ) AS stages(workflow_source,source,previous,title,days,unit,description) LOOP
 wid:=md5('projuris-workflow:'||coord::text||':'||s.workflow_source)::uuid;
 sid:=md5('projuris-workflow-etapa:'||coord::text||':'||s.source)::uuid;
 prev:=CASE WHEN s.previous IS NULL THEN NULL ELSE md5('projuris-workflow-etapa:'||coord::text||':'||s.previous)::uuid END;
 IF prev IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workflow_etapas WHERE id=prev AND workflow_id=wid) THEN RAISE EXCEPTION 'Etapa anterior divergente'; END IF;
 INSERT INTO public.workflow_etapas(id,workflow_id,ordem,titulo,tipo_item,tipo_prazo,dias_previsto,dias_fatal,descricao,exibir_kanban,regra_responsavel,condicao,etapa_anterior_id,campos_item)
 VALUES(sid,wid,(SELECT count(*)+1 FROM public.workflow_etapas WHERE workflow_id=wid),s.title,'TAREFA',s.unit,s.days,s.days,s.description,false,'predefinido',CASE WHEN prev IS NULL THEN 'sempre' ELSE 'sucesso_anterior' END,prev,jsonb_build_object('projuris_importacao',jsonb_build_object('etapa',s.source,'revisao_pendente',true,'responsaveis_nao_resolvidos',true)));
 INSERT INTO public.migracoes_projuris_itens(migracao_id,tipo,chave_externa,registro_id,status,dados)
 VALUES(batch,'workflow_etapa',s.source,sid,'importado',jsonb_build_object('workflow_origem',s.workflow_source,'etapa_anterior_origem',s.previous,'dias_previsto',s.days,'dias_fatal',s.days,'tipo_prazo',s.unit,'revisao_pendente',true));
 END LOOP;
 IF (SELECT count(*) FROM public.migracoes_projuris_itens WHERE migracao_id=batch AND tipo='workflow')<>22 OR (SELECT count(*) FROM public.migracoes_projuris_itens WHERE migracao_id=batch AND tipo='workflow_etapa')<>47 THEN RAISE EXCEPTION 'Contagem inesperada'; END IF;
END
$import$;
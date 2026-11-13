CREATE SCHEMA IF NOT EXISTS backup_limpeza_santander;
REVOKE ALL ON SCHEMA backup_limpeza_santander FROM anon, authenticated;

CREATE TABLE backup_limpeza_santander.tarefas AS SELECT * FROM public.tarefas WHERE coordenacao_id='968631d0-6659-46f1-b45d-899892cb0121';
CREATE TABLE backup_limpeza_santander.audiencias_detectadas AS SELECT * FROM public.audiencias_detectadas WHERE coordenacao_id='968631d0-6659-46f1-b45d-899892cb0121';
CREATE TABLE backup_limpeza_santander.eventos_agenda AS SELECT * FROM public.eventos_agenda WHERE coordenacao_id='968631d0-6659-46f1-b45d-899892cb0121';
CREATE TABLE backup_limpeza_santander.workflow_execucoes AS SELECT * FROM public.workflow_execucoes WHERE coordenacao_id='968631d0-6659-46f1-b45d-899892cb0121';
CREATE TABLE backup_limpeza_santander.workflow_execucao_etapas AS SELECT e.* FROM public.workflow_execucao_etapas e WHERE e.execucao_id IN (SELECT id FROM backup_limpeza_santander.workflow_execucoes);

-- destino dos processos compartilhados
CREATE TABLE backup_limpeza_santander.mover AS
WITH itens AS (
  SELECT processo_id, coordenacao_id FROM public.tarefas WHERE coordenacao_id IS NOT NULL AND coordenacao_id<>'968631d0-6659-46f1-b45d-899892cb0121'
  UNION ALL SELECT processo_id, coordenacao_id FROM public.audiencias_detectadas WHERE coordenacao_id IS NOT NULL AND coordenacao_id<>'968631d0-6659-46f1-b45d-899892cb0121'
  UNION ALL SELECT processo_id, coordenacao_id FROM public.eventos_agenda WHERE coordenacao_id IS NOT NULL AND coordenacao_id<>'968631d0-6659-46f1-b45d-899892cb0121'
), cont AS (
  SELECT i.processo_id, i.coordenacao_id, count(*) n FROM itens i JOIN public.processos p ON p.id=i.processo_id
  WHERE p.coordenacao_id='968631d0-6659-46f1-b45d-899892cb0121' GROUP BY 1,2
)
SELECT DISTINCT ON (processo_id) processo_id, coordenacao_id AS destino, n FROM cont ORDER BY processo_id, n DESC;

CREATE TABLE backup_limpeza_santander.processos AS SELECT * FROM public.processos WHERE coordenacao_id='968631d0-6659-46f1-b45d-899892cb0121';
CREATE TABLE backup_limpeza_santander.processos_apagar AS SELECT id FROM backup_limpeza_santander.processos WHERE id NOT IN (SELECT processo_id FROM backup_limpeza_santander.mover);

DO $$
DECLARE r record;
BEGIN
  -- filhos dos itens
  FOR r IN SELECT * FROM (VALUES
    ('tarefa_responsaveis','tarefa_id','tarefas'),('tarefa_envolvidos','tarefa_id','tarefas'),('comentarios_tarefas','tarefa_id','tarefas'),
    ('tarefas_publicacoes','tarefa_id','tarefas'),('tarefas_publicacoes_processos','tarefa_id','tarefas'),('tarefas_relacionadas','tarefa_origem_id','tarefas'),
    ('audiencia_envolvidos','audiencia_id','audiencias_detectadas'),('audiencias_advogados','audiencia_id','audiencias_detectadas'),('comentarios_audiencias','audiencia_id','audiencias_detectadas'),
    ('audiencias_publicacoes','audiencia_id','audiencias_detectadas'),('audiencias_publicacoes_processos','audiencia_id','audiencias_detectadas'),('audiencias_publicacoes_descartadas','audiencia_id','audiencias_detectadas'),
    ('alertas_audiencias','audiencia_id','audiencias_detectadas'),('lembretes_audiencia','audiencia_id','audiencias_detectadas'),('historico_reagendamentos_audiencia','audiencia_id','audiencias_detectadas'),
    ('evento_envolvidos','evento_id','eventos_agenda'),('evento_responsaveis','evento_id','eventos_agenda'),('comentarios_eventos','evento_id','eventos_agenda'),
    ('evento_processos','evento_id','eventos_agenda'),('parcelas_evento','evento_id','eventos_agenda'),('participantes_evento','evento_id','eventos_agenda'),('alertas_evento','evento_id','eventos_agenda')
  ) v(t,c,p) LOOP
    EXECUTE format('CREATE TABLE backup_limpeza_santander.%I AS SELECT x.* FROM public.%I x WHERE x.%I IN (SELECT id FROM backup_limpeza_santander.%I)', r.t, r.t, r.c, r.p);
  END LOOP;
  -- filhos dos processos que serão apagados
  FOR r IN SELECT * FROM (VALUES ('acompanhamento_especial_divergencias'),('acompanhamento_especial_eventos'),('alertas_monitoramento'),('baixar_autos_jobs'),
    ('consultas_judit'),('custas_processuais'),('depositos_recursais'),('distribuicoes_tst_arquivada_2026_06'),('documentos_texto_indexado'),
    ('monitoramentos_eprocesso'),('movimentacoes'),('pecas_geradas'),('pedidos_processo'),('processos_coordenacoes_responsaveis'),('processos_documentos_download'),
    ('processos_partes'),('processos_responsaveis'),('processos_testemunhas'),('publicacoes_djen_processos'),('intimacoes_detectadas'),('distribuicoes_encontradas')) v(t) LOOP
    EXECUTE format('CREATE TABLE backup_limpeza_santander.proc_%s AS SELECT x.* FROM public.%I x WHERE x.processo_id IN (SELECT id FROM backup_limpeza_santander.processos_apagar)', r.t, r.t);
  END LOOP;
  CREATE TABLE backup_limpeza_santander.documentos AS SELECT * FROM public.documentos
   WHERE processo_id IN (SELECT id FROM backup_limpeza_santander.processos_apagar)
      OR tarefa_id IN (SELECT id FROM backup_limpeza_santander.tarefas)
      OR audiencia_id IN (SELECT id FROM backup_limpeza_santander.audiencias_detectadas)
      OR evento_id IN (SELECT id FROM backup_limpeza_santander.eventos_agenda);
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA backup_limpeza_santander FROM anon, authenticated;
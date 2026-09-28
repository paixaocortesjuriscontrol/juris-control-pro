insert into public.tarefas_publicacoes (tarefa_id, publicacao_id)
select distinct ee.item_id, e.publicacao_origem_id
from public.workflow_execucao_etapas ee
join public.workflow_execucoes e on e.id = ee.execucao_id
join public.tarefas t on t.id = ee.item_id
join public.publicacoes_djen pd on pd.id = e.publicacao_origem_id
where e.publicacao_origem_tipo = 'termo'
  and not exists (select 1 from public.tarefas_publicacoes x where x.tarefa_id = t.id)
on conflict do nothing;
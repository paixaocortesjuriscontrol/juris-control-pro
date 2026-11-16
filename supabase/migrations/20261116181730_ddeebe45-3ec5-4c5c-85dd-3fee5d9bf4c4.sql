create temp table _rest2 as
select distinct on (b.id) b.id, m.coordenacao_id
from backup_limpeza_santander.tarefas b
join backup_limpeza_santander.tarefa_responsaveis r on r.tarefa_id=b.id
join public.membros_coordenacao m on m.usuario_id=r.usuario_id and m.coordenacao_id<>'968631d0-6659-46f1-b45d-899892cb0121'
where b.processo_id is null
  and not exists(select 1 from public.tarefas x where x.id=b.id)
  and not exists(select 1 from backup_limpeza_santander.tarefa_responsaveis r2 join public.membros_coordenacao m2 on m2.usuario_id=r2.usuario_id and m2.coordenacao_id='968631d0-6659-46f1-b45d-899892cb0121' where r2.tarefa_id=b.id)
order by b.id;
insert into public.tarefas select (jsonb_populate_record(null::public.tarefas, to_jsonb(b) || jsonb_build_object('coordenacao_id', r.coordenacao_id))).* from backup_limpeza_santander.tarefas b join _rest2 r on r.id=b.id on conflict do nothing;
insert into public.tarefa_responsaveis select (jsonb_populate_record(null::public.tarefa_responsaveis, to_jsonb(b))).* from backup_limpeza_santander.tarefa_responsaveis b where b.tarefa_id in (select id from _rest2) on conflict do nothing;
insert into public.tarefa_envolvidos select (jsonb_populate_record(null::public.tarefa_envolvidos, to_jsonb(b))).* from backup_limpeza_santander.tarefa_envolvidos b where b.tarefa_id in (select id from _rest2) on conflict do nothing;
insert into public.comentarios_tarefas select (jsonb_populate_record(null::public.comentarios_tarefas, to_jsonb(b))).* from backup_limpeza_santander.comentarios_tarefas b where b.tarefa_id in (select id from _rest2) on conflict do nothing;
CREATE TABLE public.backup_copias_antigas_duplicadas_20261127 AS
with n as (select id bid, substring(observacoes from 'Identificador Projuris: (TAR\.\d+)') cod from public.tarefas where origem='projuris' and created_at>='2026-11-25' and observacoes like 'Identificador Projuris: TAR.%'),
pr as (select o.id aid, n.bid,
  case when exists(select 1 from public.migracoes_projuris_itens i join public.migracoes_projuris m on m.id=i.migracao_id where i.registro_id=o.id and m.nome ilike 'Projuris Agenda Futura%') then 'Carga 13/11 (Agenda Futura)'
       when date_trunc('minute', o.created_at at time zone 'America/Sao_Paulo')='2026-10-01 10:01' then 'Carga em massa 01/10 10:01' end carga
  from n join public.tarefas o on o.identificador_projuris=n.cod and o.id<>n.bid
  where o.origem='projuris' and (o.created_at at time zone 'America/Sao_Paulo')::date <= '2026-11-13')
select t.*, pr.bid as copia_25_11_id, pr.carga as carga_origem
from pr join public.tarefas t on t.id=pr.aid
where pr.carga is not null
 and not exists(select 1 from public.auditoria_tarefas a join public.profiles p on p.id=a.usuario_id where a.tarefa_id=pr.aid and a.acao<>'criar' and p.nome not ilike 'Admin.%')
 and not exists(select 1 from public.comentarios_tarefas c join public.profiles p on p.id=c.autor_id where c.tarefa_id=pr.aid and p.nome not ilike 'Admin.%')
 and not exists(select 1 from public.documentos d where d.tarefa_id=pr.aid)
 and not (exists(select 1 from public.comentarios_tarefas c where c.tarefa_id=pr.aid) and not exists(select 1 from public.comentarios_tarefas c where c.tarefa_id=pr.bid));

CREATE TABLE public.backup_copias_antigas_dup_resp_20261127 AS select r.* from public.tarefa_responsaveis r where r.tarefa_id in (select id from public.backup_copias_antigas_duplicadas_20261127);
CREATE TABLE public.backup_copias_antigas_dup_env_20261127 AS select e.* from public.tarefa_envolvidos e where e.tarefa_id in (select id from public.backup_copias_antigas_duplicadas_20261127);
CREATE TABLE public.backup_copias_antigas_dup_com_20261127 AS select c.* from public.comentarios_tarefas c where c.tarefa_id in (select id from public.backup_copias_antigas_duplicadas_20261127);
CREATE TABLE public.backup_copias_antigas_dup_mig_20261127 AS select i.* from public.migracoes_projuris_itens i where i.registro_id in (select id from public.backup_copias_antigas_duplicadas_20261127);

GRANT ALL ON public.backup_copias_antigas_duplicadas_20261127, public.backup_copias_antigas_dup_resp_20261127, public.backup_copias_antigas_dup_env_20261127, public.backup_copias_antigas_dup_com_20261127, public.backup_copias_antigas_dup_mig_20261127 TO service_role;
GRANT SELECT ON public.backup_copias_antigas_duplicadas_20261127, public.backup_copias_antigas_dup_resp_20261127, public.backup_copias_antigas_dup_env_20261127, public.backup_copias_antigas_dup_com_20261127, public.backup_copias_antigas_dup_mig_20261127 TO authenticated;

ALTER TABLE public.backup_copias_antigas_duplicadas_20261127 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_copias_antigas_dup_resp_20261127 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_copias_antigas_dup_env_20261127 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_copias_antigas_dup_com_20261127 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_copias_antigas_dup_mig_20261127 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins leem backup" ON public.backup_copias_antigas_duplicadas_20261127 FOR SELECT TO authenticated USING ((select public.has_role((select auth.uid()), 'admin')));
CREATE POLICY "Admins leem backup" ON public.backup_copias_antigas_dup_resp_20261127 FOR SELECT TO authenticated USING ((select public.has_role((select auth.uid()), 'admin')));
CREATE POLICY "Admins leem backup" ON public.backup_copias_antigas_dup_env_20261127 FOR SELECT TO authenticated USING ((select public.has_role((select auth.uid()), 'admin')));
CREATE POLICY "Admins leem backup" ON public.backup_copias_antigas_dup_com_20261127 FOR SELECT TO authenticated USING ((select public.has_role((select auth.uid()), 'admin')));
CREATE POLICY "Admins leem backup" ON public.backup_copias_antigas_dup_mig_20261127 FOR SELECT TO authenticated USING ((select public.has_role((select auth.uid()), 'admin')));
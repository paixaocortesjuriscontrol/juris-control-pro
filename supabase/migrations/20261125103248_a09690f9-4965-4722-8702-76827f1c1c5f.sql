CREATE TABLE public.backup_coord_gol_janaina_20261125 (id uuid primary key default gen_random_uuid(), tabela text not null, processo_id uuid, dados jsonb not null, created_at timestamptz not null default now());
GRANT SELECT ON public.backup_coord_gol_janaina_20261125 TO authenticated;
GRANT ALL ON public.backup_coord_gol_janaina_20261125 TO service_role;
ALTER TABLE public.backup_coord_gol_janaina_20261125 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem backup" ON public.backup_coord_gol_janaina_20261125 FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TEMP TABLE alvo ON COMMIT DROP AS
with v(d,g) as (values ('00001141720225060020','E'),('00001998720255120001','E'),('00002640920255100011','E'),('00014336520245100011','E'),('00014630320245100011','E'),('00014648520245100011','E'),('00016442420245170006','E'),('00016626420245090007','E'),('00017454120245100011','E'),('00018935220245100011','E'),('00019272720245100011','E'),('00101010520245030016','E'),('00174943420225160001','E'),('00203196120235040352','E'),('00210593920245040334','E'),('00210914020245040012','E'),('01013943320245010074','E'),('00001086020235120035','G'),('00002366520235050491','G'),('00002451820235050009','G'),('00002567720195060003','G'),('00002650220225090892','G'),('00002729020175170004','G'),('00003106920245050561','G'),('00003206120225090662','G'),('00003228120245140416','G'),('00003335620255100006','G'),('00003502520235140403','G'),('00004005720235140401','G'),('00004297820235080109','G'),('00004948820235080201','G'),('00005153520235050561','G'),('00005162020235050561','G'),('00005318020235130006','G'),('00005413320235050561','G'),('00005730320135050492','G'),('00005972620235220001','G'),('00006292220235100015','G'),('00007009520155050030','G'),('00007770320235100801','G'),('00007978020235110052','G'),('00008059020215100008','G'),('00008234120245050010','G'),('00008311420115040006','G'),('00009018720235120038','G'),('00009903220175120035','G'),('00010256520245100014','G'),('00010564920235100005','G'),('00011624020245050611','G'),('00012684120125090892','G'),('00014039620245190005','G'),('00014266520235100801','G'),('00017012220135090662','G'),('00018058820175070028','G'),('00019584820125190001','G'),('00104728220245030043','G'),('00106897420235180001','G'),('00161944420165160002','G'),('00200007920235040001','G'),('00210935020235040010','G'),('00240581820245240007','G'),('00248726720235240006','G'),('00252685320235240003','G'),('00254271120145240003','G'),('00254366720145240004','G'),('00254409820145240006','G'),('00002307220235230001','J'),('00006169720215100013','J'),('00008881620245100004','J'),('00011736920245050611','G'),('00013106120245100013','J'),('00013893420245100015','J'),('00013987220245100022','J'),('00014346820245100005','J'),('00017781320245100017','J'),('00110516220175030144','J'),('00111611620235180053','J'),('00113618920245180052','J'),('00114455020155030173','J'),('00245129520245240007','J'),('00248232620235240006','J'),('00251705420265240006','J'),('00826002820095050025','G'))
select p.id processo_id, c.coord, c.principal from v join processos p on regexp_replace(p.numero,'\D','','g')=v.d
join (values ('J','9d4e11e2-e81f-45ef-a8d4-977ddf371e18'::uuid,true),('G','f5a0ac48-7461-49c1-9151-219e570831bd'::uuid,true),('E','408d691a-dd97-4d18-b3c0-0ffd5c572c21'::uuid,true),('E','c5a10000-0000-4000-8000-000000000002'::uuid,false)) c(g,coord,principal) on c.g=v.g;

INSERT INTO public.backup_coord_gol_janaina_20261125(tabela,processo_id,dados)
select 'processos',p.id,jsonb_build_object('coordenacao_id',p.coordenacao_id) from processos p where p.id in (select processo_id from alvo)
union all select 'processos_coordenacoes_responsaveis',x.processo_id,to_jsonb(x) from processos_coordenacoes_responsaveis x where x.processo_id in (select processo_id from alvo)
union all select 'processos_responsaveis',x.processo_id,to_jsonb(x) from processos_responsaveis x where x.processo_id in (select processo_id from alvo);

UPDATE processos p SET coordenacao_id=a.coord FROM alvo a WHERE a.processo_id=p.id AND a.principal AND p.coordenacao_id IS DISTINCT FROM a.coord;

DELETE FROM processos_coordenacoes_responsaveis x WHERE x.processo_id IN (select processo_id from alvo)
 AND NOT EXISTS (select 1 from alvo a where a.processo_id=x.processo_id and a.coord=x.coordenacao_id);

UPDATE processos_coordenacoes_responsaveis x SET principal=a.principal FROM alvo a WHERE a.processo_id=x.processo_id AND a.coord=x.coordenacao_id AND x.principal<>a.principal;

INSERT INTO processos_coordenacoes_responsaveis(processo_id,coordenacao_id,principal)
select a.processo_id,a.coord,a.principal from alvo a where not exists (select 1 from processos_coordenacoes_responsaveis x where x.processo_id=a.processo_id and x.coordenacao_id=a.coord);

DELETE FROM processos_responsaveis x WHERE x.processo_id IN (select processo_id from alvo) AND x.coordenacao_id IS NOT NULL
 AND NOT EXISTS (select 1 from alvo a where a.processo_id=x.processo_id and a.coord=x.coordenacao_id);
CREATE TABLE public.backup_obs_copias_mantidas_20261127 AS
WITH n AS (SELECT id bid, titulo bt, data_fatal bf, substring(observacoes from 'Identificador Projuris: (TAR\.\d+)') cod FROM tarefas WHERE origem='projuris' AND created_at>='2026-11-25' AND observacoes LIKE 'Identificador Projuris: TAR.%')
SELECT o.id, o.coordenacao_id, o.observacoes, n.bid copia_nova_id, n.bt titulo_novo, n.bf vencimento_novo
FROM n JOIN tarefas o ON o.identificador_projuris=n.cod AND o.id<>n.bid AND o.created_at<'2026-11-25';
GRANT ALL ON public.backup_obs_copias_mantidas_20261127 TO service_role;
GRANT SELECT ON public.backup_obs_copias_mantidas_20261127 TO authenticated;
ALTER TABLE public.backup_obs_copias_mantidas_20261127 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Somente admin le backup" ON public.backup_obs_copias_mantidas_20261127 FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

DO $$
BEGIN
  IF (SELECT count(*) FROM public.backup_obs_copias_mantidas_20261127) <> 1404 THEN
    RAISE EXCEPTION 'Contagem inesperada';
  END IF;
END $$;

INSERT INTO public.etiquetas (nome, cor, coordenacao_id, modulos, ativo)
SELECT DISTINCT 'DUPLICADA – MANTIDA POR SEGURANÇA', '#f97316', b.coordenacao_id, ARRAY['tarefas']::text[], true
FROM public.backup_obs_copias_mantidas_20261127 b
WHERE NOT EXISTS (SELECT 1 FROM public.etiquetas e WHERE e.nome='DUPLICADA – MANTIDA POR SEGURANÇA' AND e.coordenacao_id=b.coordenacao_id);

SET LOCAL session_replication_role = replica;

INSERT INTO public.etiquetas_itens (etiqueta_id, entidade, entidade_id)
SELECT e.id, 'tarefa', b.id FROM public.backup_obs_copias_mantidas_20261127 b
JOIN public.etiquetas e ON e.nome='DUPLICADA – MANTIDA POR SEGURANÇA' AND e.coordenacao_id=b.coordenacao_id;

UPDATE public.tarefas t SET observacoes = coalesce(nullif(t.observacoes,'') || E'\n\n','') ||
  'Tarefa duplicada na migração Projuris. Não foi apagada por segurança porque a equipe fez alterações nela. A cópia de 25/11 é a tarefa "' || coalesce(b.titulo_novo,'') || '"' ||
  coalesce(' com vencimento em ' || to_char(b.vencimento_novo,'DD/MM/YYYY'), ' sem vencimento') || '.'
FROM public.backup_obs_copias_mantidas_20261127 b WHERE t.id=b.id;
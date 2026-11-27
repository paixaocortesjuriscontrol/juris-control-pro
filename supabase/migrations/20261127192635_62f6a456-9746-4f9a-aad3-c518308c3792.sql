INSERT INTO public.backup_obs_copias_mantidas_20261127 (id, coordenacao_id, observacoes, copia_nova_id, titulo_novo, vencimento_novo)
SELECT t.id, t.coordenacao_id, t.observacoes, b.copia_25_11_id, n.titulo, n.data_fatal
FROM public.tarefas t JOIN public.backup_copias_antigas_duplicadas_20261127 b ON b.id=t.id JOIN public.tarefas n ON n.id=b.copia_25_11_id
WHERE t.id IN ('c800ca54-4384-4303-8200-5101d303a516','213f73a9-b0ea-49e0-bc5b-86aa3ba9ee56')
AND NOT EXISTS (SELECT 1 FROM public.backup_obs_copias_mantidas_20261127 x WHERE x.id=t.id);

SET LOCAL session_replication_role = replica;

INSERT INTO public.etiquetas_itens (etiqueta_id, entidade, entidade_id)
SELECT e.id, 'tarefa', t.id FROM public.tarefas t JOIN public.etiquetas e ON e.nome='DUPLICADA – MANTIDA POR SEGURANÇA' AND e.coordenacao_id=t.coordenacao_id
WHERE t.id IN ('c800ca54-4384-4303-8200-5101d303a516','213f73a9-b0ea-49e0-bc5b-86aa3ba9ee56')
AND NOT EXISTS (SELECT 1 FROM public.etiquetas_itens i WHERE i.etiqueta_id=e.id AND i.entidade_id=t.id);

UPDATE public.tarefas t SET observacoes = coalesce(t.observacoes,'') || E'\n\n' ||
 'Tarefa duplicada na migração Projuris. Não foi apagada por segurança porque a equipe fez alterações nela. A cópia de 25/11 é a tarefa "' || b.titulo_novo || '" ' ||
 coalesce('com vencimento em ' || to_char(b.vencimento_novo,'DD/MM/YYYY'), 'sem vencimento') || '.'
FROM public.backup_obs_copias_mantidas_20261127 b
WHERE b.id=t.id AND t.id IN ('c800ca54-4384-4303-8200-5101d303a516','213f73a9-b0ea-49e0-bc5b-86aa3ba9ee56')
AND t.observacoes NOT LIKE '%Não foi apagada por segurança%';
CREATE TABLE public.backup_leitura_djen_santander_civel_20261125 AS
SELECT p.id, p.lida FROM public.publicacoes_djen p
LEFT JOIN public.monitoramentos_djen m ON m.id = p.monitoramento_id
WHERE coalesce(p.coordenacao_id, m.coordenacao_id) = '968631d0-6659-46f1-b45d-899892cb0121'
  AND coalesce(p.data_disponibilizacao, p.data_publicacao) < '2026-11-01 00:00-03';
GRANT ALL ON public.backup_leitura_djen_santander_civel_20261125 TO service_role;
ALTER TABLE public.backup_leitura_djen_santander_civel_20261125 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin le backup" ON public.backup_leitura_djen_santander_civel_20261125 FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

SET LOCAL app.sem_notificacao = '1';
INSERT INTO public.publicacoes_djen_leituras (publicacao_id, tabela_origem, usuario_id, usuario_nome, lida_em)
SELECT b.id, 'termo', 'e731382b-ab60-4809-afd2-127446a2ffd8', 'Isabela Constantino', now()
FROM public.backup_leitura_djen_santander_civel_20261125 b
WHERE NOT EXISTS (SELECT 1 FROM public.publicacoes_djen_leituras l WHERE l.publicacao_id = b.id AND l.usuario_id = 'e731382b-ab60-4809-afd2-127446a2ffd8');

SET LOCAL session_replication_role = replica;
UPDATE public.publicacoes_djen p SET lida = true
FROM public.backup_leitura_djen_santander_civel_20261125 b
WHERE p.id = b.id AND p.lida IS DISTINCT FROM true;
SET LOCAL session_replication_role = origin;
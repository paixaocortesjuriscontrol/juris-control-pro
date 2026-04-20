-- Atribui user_id aos registros órfãos de dados_benner para que o RLS não bloqueie atualizações
-- Estratégia: usar o coordenador da coordenação do registro; fallback para o primeiro admin
UPDATE public.dados_benner db
SET user_id = COALESCE(
  (SELECT c.coordenador_id FROM public.coordenacoes c WHERE c.id = db.coordenacao_id AND c.coordenador_id IS NOT NULL),
  (SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.created_at LIMIT 1)
)
WHERE db.user_id IS NULL;
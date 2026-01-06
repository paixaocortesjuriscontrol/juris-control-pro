-- Inserir configuração para monitoramento de termos (Monitoração 360)
INSERT INTO public.configuracoes_monitoramento (tipo, frequencia, ativo, coordenacao_id)
SELECT 'termos', 'diario', true, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.configuracoes_monitoramento WHERE tipo = 'termos' AND coordenacao_id IS NULL
);
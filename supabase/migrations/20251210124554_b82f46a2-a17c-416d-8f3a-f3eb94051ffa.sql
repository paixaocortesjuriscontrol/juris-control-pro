-- Insert configuration for andamentos monitoring
INSERT INTO public.configuracoes_monitoramento (tipo, frequencia, ativo)
VALUES ('andamentos', 'diario', true)
ON CONFLICT DO NOTHING;
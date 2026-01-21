
-- 1. Limpar tabela alertas_monitoramento
TRUNCATE TABLE public.alertas_monitoramento;

-- 2. Adicionar colunas na tabela coordenacoes para configurar monitoramentos
ALTER TABLE public.coordenacoes 
ADD COLUMN IF NOT EXISTS monitorar_redistribuicoes boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS monitorar_distribuicoes boolean NOT NULL DEFAULT true;

-- Comentários explicativos
COMMENT ON COLUMN public.coordenacoes.monitorar_redistribuicoes IS 'Define se a coordenação recebe alertas de redistribuições de processos';
COMMENT ON COLUMN public.coordenacoes.monitorar_distribuicoes IS 'Define se a coordenação recebe alertas de novas distribuições de processos';


-- 1) Opt-in por monitoramento
ALTER TABLE public.monitoramentos_djen
  ADD COLUMN IF NOT EXISTS busca_stf_ativa boolean NOT NULL DEFAULT false;

-- 2) Expandir CHECK de tipo em execucoes_agendadas para aceitar 'djen_stf_servidor'
ALTER TABLE public.execucoes_agendadas
  DROP CONSTRAINT IF EXISTS execucoes_agendadas_tipo_check;
ALTER TABLE public.execucoes_agendadas
  ADD CONSTRAINT execucoes_agendadas_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'djen','djen_processos','djen_termos','djen_termos_pro','djen_termos_flash',
    'djen_termos_paralela','djen_paralela','djet_pautas','djet_pautas_paralela',
    'djet_pautas_servidor','stf_termos','stf','stf_flash','andamentos',
    'redistribuicoes','distribuicoes','termos','datajud_termos','djen_pro',
    'djen_flash','kurier','djen_kurier','djen_kurier_servidor','djen_stf_servidor'
  ]));

-- 3) Seed da configuração do motor STF Servidor (desligada por padrão)
INSERT INTO public.configuracoes_monitoramento_servidor (tipo, frequencia, ativo, horarios_execucao, metadata)
SELECT 'djen_stf_servidor', 'diario', false, ARRAY['05:00','15:00'], '{"dias_semana":[1,2,3,4,5]}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.configuracoes_monitoramento_servidor WHERE tipo = 'djen_stf_servidor'
);

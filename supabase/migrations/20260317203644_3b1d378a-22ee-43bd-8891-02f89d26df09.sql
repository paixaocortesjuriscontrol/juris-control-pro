
-- Add missing TST-specific columns to processos
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS decisao_tst text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS formulario_tst text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS providencias_tst text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS deposito_judicial_tst text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS preparo_tst text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS multa_custas_tst text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS responsavel_tst text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS data_fatal_tst date;

-- Migrate prazos_tst data to processos (where linked to existing processo)
UPDATE public.processos p
SET
  dossie_tst = COALESCE(pt.dossie, p.dossie_tst),
  equipe_tst = COALESCE(pt.equipe, p.equipe_tst),
  decisao_tst = COALESCE(pt.decisao, p.decisao_tst),
  formulario_tst = COALESCE(pt.formulario, p.formulario_tst),
  providencias_tst = COALESCE(pt.providencias, p.providencias_tst),
  deposito_judicial_tst = COALESCE(pt.deposito_judicial, p.deposito_judicial_tst),
  preparo_tst = COALESCE(pt.preparo, p.preparo_tst),
  multa_custas_tst = COALESCE(pt.multa_custas, p.multa_custas_tst),
  responsavel_tst = COALESCE(pt.responsavel, p.responsavel_tst),
  data_fatal_tst = COALESCE(pt.data_fatal, p.data_fatal_tst)
FROM public.prazos_tst pt
WHERE pt.processo_id = p.id;

-- Create processos for prazos_tst rows without a linked processo
INSERT INTO public.processos (
  numero, coordenacao_id, area, status, polo_ativo, polo_passivo,
  dossie_tst, equipe_tst, decisao_tst, formulario_tst, providencias_tst,
  deposito_judicial_tst, preparo_tst, multa_custas_tst, responsavel_tst, data_fatal_tst
)
SELECT
  COALESCE(NULLIF(pt.numero_processo, ''), 'SEM-NUMERO-' || pt.id::text),
  pt.coordenacao_id,
  'trabalhista',
  'ativo',
  pt.autor,
  pt.reu,
  pt.dossie,
  pt.equipe,
  pt.decisao,
  pt.formulario,
  pt.providencias,
  pt.deposito_judicial,
  pt.preparo,
  pt.multa_custas,
  pt.responsavel,
  pt.data_fatal
FROM public.prazos_tst pt
WHERE pt.processo_id IS NULL;

-- Drop the prazos_tst table
DROP TABLE IF EXISTS public.prazos_tst;

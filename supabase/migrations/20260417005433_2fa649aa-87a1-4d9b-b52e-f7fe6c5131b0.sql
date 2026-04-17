
ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS aba_origem text,
  ADD COLUMN IF NOT EXISTS equipe text,
  ADD COLUMN IF NOT EXISTS reclamante text,
  ADD COLUMN IF NOT EXISTS reclamada text,
  ADD COLUMN IF NOT EXISTS tipo_recurso_reclamante text,
  ADD COLUMN IF NOT EXISTS materias_recurso_reclamante text,
  ADD COLUMN IF NOT EXISTS aparelhamento_reclamante text,
  ADD COLUMN IF NOT EXISTS chance_exito_reclamante text,
  ADD COLUMN IF NOT EXISTS tipo_recurso_banco text,
  ADD COLUMN IF NOT EXISTS materias_recurso_banco text,
  ADD COLUMN IF NOT EXISTS aparelhamento_banco text,
  ADD COLUMN IF NOT EXISTS chance_exito_banco text,
  ADD COLUMN IF NOT EXISTS honra text,
  ADD COLUMN IF NOT EXISTS tema text,
  ADD COLUMN IF NOT EXISTS execucao text,
  ADD COLUMN IF NOT EXISTS midia_negativa text,
  ADD COLUMN IF NOT EXISTS decisao_quarteirizado text,
  ADD COLUMN IF NOT EXISTS recurso_terceiros text,
  ADD COLUMN IF NOT EXISTS benner_atualizado boolean,
  ADD COLUMN IF NOT EXISTS transito_julgado boolean,
  ADD COLUMN IF NOT EXISTS judit_preenchido boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS judit_preenchido_em timestamptz,
  ADD COLUMN IF NOT EXISTS judit_preenchido_por uuid,
  ADD COLUMN IF NOT EXISTS parte_recorrente_origem text;

CREATE INDEX IF NOT EXISTS idx_dados_benner_aba_origem ON public.dados_benner(aba_origem) WHERE aba_origem IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dados_benner_judit_preenchido ON public.dados_benner(judit_preenchido);

INSERT INTO public.dados_benner (
  processo, dossie, recorrente, relator, turma, tipo_recurso, data_distribuicao,
  aba_origem, equipe, reclamante, reclamada,
  tipo_recurso_reclamante, materias_recurso_reclamante, aparelhamento_reclamante, chance_exito_reclamante,
  tipo_recurso_banco, materias_recurso_banco, aparelhamento_banco, chance_exito_banco,
  honra, tema, execucao, midia_negativa, decisao_quarteirizado, recurso_terceiros,
  benner_atualizado, transito_julgado,
  judit_preenchido, judit_preenchido_em, judit_preenchido_por,
  posicao_relator_favoravel, posicao_relator_desfavoravel,
  posicao_turma_favoravel, posicao_turma_desfavoravel,
  status, tribunal, coordenacao_id, created_at
)
SELECT
  d.processo_numero,
  d.dossie,
  d.parte_recorrente,
  d.relator,
  d.turma,
  COALESCE(d.tipo_recurso_reclamante, d.tipo_recurso_banco),
  d.data_distribuicao,
  d.aba_origem,
  d.equipe,
  d.reclamante,
  d.reclamada,
  d.tipo_recurso_reclamante, d.materias_recurso_reclamante, d.aparelhamento_reclamante, d.chance_exito_reclamante,
  d.tipo_recurso_banco, d.materias_recurso_banco, d.aparelhamento_banco, d.chance_exito_banco,
  d.honra, d.tema, d.execucao, d.midia_negativa, d.decisao_quarteirizado, d.recurso_terceiros,
  d.benner_atualizado, d.transito_julgado,
  COALESCE(d.judit_preenchido, false), d.judit_preenchido_em, d.judit_preenchido_por,
  CASE WHEN lower(coalesce(d.relator_favorabilidade,'')) IN ('positiva','positivo','favoravel','favorável') THEN true ELSE NULL END,
  CASE WHEN lower(coalesce(d.relator_favorabilidade,'')) IN ('negativa','negativo','desfavoravel','desfavorável') THEN true ELSE NULL END,
  CASE WHEN lower(coalesce(d.turma_favorabilidade,'')) IN ('positiva','positivo','favoravel','favorável') THEN true ELSE NULL END,
  CASE WHEN lower(coalesce(d.turma_favorabilidade,'')) IN ('negativa','negativo','desfavoravel','desfavorável') THEN true ELSE NULL END,
  'rascunho',
  'TST',
  (SELECT p.coordenacao_id FROM public.processos p WHERE p.numero = d.processo_numero LIMIT 1),
  d.created_at
FROM public.distribuicoes_tst d
WHERE NOT EXISTS (
  SELECT 1 FROM public.dados_benner b
  WHERE b.processo = d.processo_numero
    AND COALESCE(b.dossie,'') = COALESCE(d.dossie,'')
);

UPDATE public.dados_benner b
SET
  aba_origem = COALESCE(b.aba_origem, d.aba_origem),
  equipe = COALESCE(b.equipe, d.equipe),
  reclamante = COALESCE(b.reclamante, d.reclamante),
  reclamada = COALESCE(b.reclamada, d.reclamada),
  tipo_recurso_reclamante = COALESCE(b.tipo_recurso_reclamante, d.tipo_recurso_reclamante),
  materias_recurso_reclamante = COALESCE(b.materias_recurso_reclamante, d.materias_recurso_reclamante),
  aparelhamento_reclamante = COALESCE(b.aparelhamento_reclamante, d.aparelhamento_reclamante),
  chance_exito_reclamante = COALESCE(b.chance_exito_reclamante, d.chance_exito_reclamante),
  tipo_recurso_banco = COALESCE(b.tipo_recurso_banco, d.tipo_recurso_banco),
  materias_recurso_banco = COALESCE(b.materias_recurso_banco, d.materias_recurso_banco),
  aparelhamento_banco = COALESCE(b.aparelhamento_banco, d.aparelhamento_banco),
  chance_exito_banco = COALESCE(b.chance_exito_banco, d.chance_exito_banco),
  honra = COALESCE(b.honra, d.honra),
  tema = COALESCE(b.tema, d.tema),
  execucao = COALESCE(b.execucao, d.execucao),
  midia_negativa = COALESCE(b.midia_negativa, d.midia_negativa),
  decisao_quarteirizado = COALESCE(b.decisao_quarteirizado, d.decisao_quarteirizado),
  recurso_terceiros = COALESCE(b.recurso_terceiros, d.recurso_terceiros),
  benner_atualizado = COALESCE(b.benner_atualizado, d.benner_atualizado),
  transito_julgado = COALESCE(b.transito_julgado, d.transito_julgado),
  judit_preenchido = COALESCE(b.judit_preenchido, d.judit_preenchido, false),
  judit_preenchido_em = COALESCE(b.judit_preenchido_em, d.judit_preenchido_em),
  judit_preenchido_por = COALESCE(b.judit_preenchido_por, d.judit_preenchido_por),
  recorrente = COALESCE(NULLIF(b.recorrente,''), d.parte_recorrente),
  relator = COALESCE(NULLIF(b.relator,''), d.relator),
  turma = COALESCE(NULLIF(b.turma,''), d.turma),
  tipo_recurso = COALESCE(NULLIF(b.tipo_recurso,''), d.tipo_recurso_reclamante, d.tipo_recurso_banco),
  data_distribuicao = COALESCE(b.data_distribuicao, d.data_distribuicao),
  posicao_relator_favoravel = COALESCE(b.posicao_relator_favoravel,
    CASE WHEN lower(coalesce(d.relator_favorabilidade,'')) IN ('positiva','positivo','favoravel','favorável') THEN true END),
  posicao_relator_desfavoravel = COALESCE(b.posicao_relator_desfavoravel,
    CASE WHEN lower(coalesce(d.relator_favorabilidade,'')) IN ('negativa','negativo','desfavoravel','desfavorável') THEN true END),
  posicao_turma_favoravel = COALESCE(b.posicao_turma_favoravel,
    CASE WHEN lower(coalesce(d.turma_favorabilidade,'')) IN ('positiva','positivo','favoravel','favorável') THEN true END),
  posicao_turma_desfavoravel = COALESCE(b.posicao_turma_desfavoravel,
    CASE WHEN lower(coalesce(d.turma_favorabilidade,'')) IN ('negativa','negativo','desfavoravel','desfavorável') THEN true END),
  tribunal = COALESCE(b.tribunal, 'TST')
FROM public.distribuicoes_tst d
WHERE b.processo = d.processo_numero
  AND COALESCE(b.dossie,'') = COALESCE(d.dossie,'');

ALTER TABLE public.distribuicoes_tst RENAME TO distribuicoes_tst_legacy;

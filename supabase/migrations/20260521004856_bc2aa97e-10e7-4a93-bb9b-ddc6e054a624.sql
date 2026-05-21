UPDATE public.publicacoes_djen_descartadas
SET coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121'::uuid
WHERE id IN (
  'cbd68eff-85ed-4391-8a0e-a2bb84983f15'::uuid,
  'bb27f72b-019c-4bcf-afc4-d4f75cd48504'::uuid
);

INSERT INTO public.publicacoes_djen (
  monitoramento_id,
  coordenacao_id,
  hash_conteudo,
  data_publicacao,
  processo_numero,
  conteudo,
  fonte,
  lida,
  importada_de_descartada,
  data_disponibilizacao,
  tribunal,
  orgao,
  tipo_comunicacao,
  meio,
  advogados_json,
  partes_json,
  status,
  tipo_publicacao
)
SELECT
  '94c34b0e-1a3f-4bd5-8dab-9258d0f6757c'::uuid,
  'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'::uuid,
  d.hash_conteudo,
  d.data_publicacao,
  d.processo_numero,
  d.conteudo,
  COALESCE(d.fonte, 'DJEN-PARALELA'),
  false,
  true,
  d.data_disponibilizacao,
  d.tribunal,
  d.orgao,
  d.tipo_comunicacao,
  d.meio,
  d.advogados_json,
  d.partes_json,
  'encontrada'::public.djen_status,
  'intimacao'
FROM public.publicacoes_djen_descartadas d
WHERE d.id = 'cbd68eff-85ed-4391-8a0e-a2bb84983f15'::uuid
ON CONFLICT DO NOTHING;
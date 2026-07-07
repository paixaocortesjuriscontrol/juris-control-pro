
-- Preencher processo_numero e advogados nas linhas do OSMAR (id_djen=661811046)
-- que a API PJE Comunica confirma ter esses dados mesmo em sigiloso.
UPDATE public.publicacoes_djen_servidor
SET processo_numero = '40289773320268260224'
WHERE id_djen = '661811046'
  AND (processo_numero IS NULL OR length(trim(processo_numero)) = 0);

UPDATE public.publicacoes_djen_servidor
SET advogados_json = jsonb_build_array(
  jsonb_build_object('nome','OSMAR MENDES PAIXÃO CORTES','numero_oab','310314','uf_oab','SP','advogado_id',2326504),
  jsonb_build_object('nome','CAIO VICTÓRIO DE SOUZA','numero_oab','305282','uf_oab','SP','advogado_id',3835659)
)
WHERE id_djen = '661811046'
  AND (advogados_json IS NULL OR jsonb_array_length(COALESCE(advogados_json, '[]'::jsonb)) = 0);

UPDATE public.publicacoes_djen
SET processo_numero = '40289773320268260224'
WHERE id_djen = '661811046'
  AND fonte = 'servidor'
  AND (processo_numero IS NULL OR length(trim(processo_numero)) = 0);

UPDATE public.publicacoes_djen
SET advogados_json = jsonb_build_array(
  jsonb_build_object('nome','OSMAR MENDES PAIXÃO CORTES','numero_oab','310314','uf_oab','SP','advogado_id',2326504),
  jsonb_build_object('nome','CAIO VICTÓRIO DE SOUZA','numero_oab','305282','uf_oab','SP','advogado_id',3835659)
)
WHERE id_djen = '661811046'
  AND fonte = 'servidor'
  AND (advogados_json IS NULL OR jsonb_array_length(COALESCE(advogados_json, '[]'::jsonb)) = 0);

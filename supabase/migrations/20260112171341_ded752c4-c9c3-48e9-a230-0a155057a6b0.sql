-- Corrigir processo_id nas audiências que têm processo correspondente
UPDATE audiencias_detectadas ad
SET processo_id = p.id,
    origem = COALESCE(ad.origem, 'detectado')
FROM processos p
WHERE ad.processo_numero = p.numero
AND ad.processo_id IS NULL;

-- Corrigir processo_id nas intimações que têm processo correspondente
UPDATE intimacoes_detectadas id
SET processo_id = p.id,
    origem = COALESCE(id.origem, 'detectado')
FROM processos p
WHERE id.processo_numero = p.numero
AND id.processo_id IS NULL;
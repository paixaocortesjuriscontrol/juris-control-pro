DELETE FROM publicacoes_djen p
USING monitoramentos_djen m
WHERE p.monitoramento_id = m.id
  AND m.coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'
  AND m.tipo = 'parte'
  AND upper(unaccent(coalesce(p.partes_json::text, ''))) NOT LIKE '%' || upper(unaccent(m.termo_busca)) || '%';
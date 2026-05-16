DELETE FROM public.publicacoes_djen a
 USING public.publicacoes_djen b
 WHERE a.ctid > b.ctid
   AND a.coordenacao_id IS NOT NULL
   AND a.coordenacao_id = b.coordenacao_id
   AND a.hash_conteudo  = b.hash_conteudo;
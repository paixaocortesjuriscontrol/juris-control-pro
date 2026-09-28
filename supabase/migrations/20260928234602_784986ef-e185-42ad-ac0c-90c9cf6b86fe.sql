UPDATE public.membros_coordenacao mc
SET cargo = 'coordenador'
FROM public.coordenacoes c, public.profiles p
WHERE mc.coordenacao_id = c.id
  AND mc.usuario_id = p.id
  AND c.nome = 'Coordenação Dra. Renata Oficial'
  AND p.nome = 'Lienne Vasconcelos';
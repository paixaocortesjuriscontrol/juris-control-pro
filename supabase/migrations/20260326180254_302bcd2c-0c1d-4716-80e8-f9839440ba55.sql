UPDATE public.processos
SET monitorar_andamentos = true,
    monitorar_djen = true,
    prioridade_djen = true
WHERE coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f';
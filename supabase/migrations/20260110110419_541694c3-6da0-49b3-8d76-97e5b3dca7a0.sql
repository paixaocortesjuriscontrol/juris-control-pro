-- Adicionar coluna nome_cliente_envolvido na tabela processos
ALTER TABLE public.processos 
ADD COLUMN IF NOT EXISTS nome_cliente_envolvido text;

-- Popular com o nome do cliente vinculado
UPDATE public.processos p
SET nome_cliente_envolvido = c.nome
FROM public.clientes c
WHERE p.cliente_id = c.id
  AND (p.nome_cliente_envolvido IS NULL OR p.nome_cliente_envolvido = '');
-- Corrigir FK em publicacoes_djen_global_hash para ON DELETE CASCADE
-- Primeiro, remover a constraint existente
ALTER TABLE public.publicacoes_djen_global_hash 
DROP CONSTRAINT IF EXISTS publicacoes_djen_global_hash_primeiro_monitoramento_id_fkey;

-- Recriar com ON DELETE CASCADE
ALTER TABLE public.publicacoes_djen_global_hash 
ADD CONSTRAINT publicacoes_djen_global_hash_primeiro_monitoramento_id_fkey 
FOREIGN KEY (primeiro_monitoramento_id) 
REFERENCES public.monitoramentos_djen(id) 
ON DELETE CASCADE;
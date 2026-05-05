-- Corrigir RLS para permitir UPSERT em publicacoes_djen_leituras
-- O upsert precisa de permissão de atualização quando a leitura já existe para o mesmo usuário.

ALTER TABLE public.publicacoes_djen_leituras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upd_leituras" ON public.publicacoes_djen_leituras;

CREATE POLICY "upd_leituras"
ON public.publicacoes_djen_leituras
FOR UPDATE
TO authenticated
USING (usuario_id = auth.uid())
WITH CHECK (usuario_id = auth.uid());
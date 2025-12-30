-- Adicionar colunas para campos da planilha de audiências
ALTER TABLE public.audiencias_detectadas
ADD COLUMN IF NOT EXISTS hora text,
ADD COLUMN IF NOT EXISTS vara_camara text,
ADD COLUMN IF NOT EXISTS comarca text,
ADD COLUMN IF NOT EXISTS polo_ativo text,
ADD COLUMN IF NOT EXISTS cliente text,
ADD COLUMN IF NOT EXISTS terceirizado text,
ADD COLUMN IF NOT EXISTS resumo_objeto text,
ADD COLUMN IF NOT EXISTS funcao text,
ADD COLUMN IF NOT EXISTS preposto text,
ADD COLUMN IF NOT EXISTS testemunhas text,
ADD COLUMN IF NOT EXISTS advogado text,
ADD COLUMN IF NOT EXISTS origem text DEFAULT 'detectado',
ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES auth.users(id);

-- Atualizar política para permitir inserção manual
DROP POLICY IF EXISTS "Usuários podem inserir audiências manualmente" ON public.audiencias_detectadas;
CREATE POLICY "Usuários podem inserir audiências manualmente"
ON public.audiencias_detectadas
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND
  (origem = 'manual' AND criado_por = auth.uid())
  OR origem = 'detectado'
);
-- Função temporária para limpar publicações DJEN (para testes)
CREATE OR REPLACE FUNCTION public.limpar_publicacoes_djen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM publicacoes_djen;
END;
$$;

-- Executar a limpeza
SELECT limpar_publicacoes_djen();

-- Remover a função após uso
DROP FUNCTION public.limpar_publicacoes_djen();
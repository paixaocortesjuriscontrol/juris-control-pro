-- Adicionar coluna buscar_parte para busca complementar por nome de parte
ALTER TABLE monitoramentos_djen 
ADD COLUMN IF NOT EXISTS buscar_parte boolean DEFAULT false;

COMMENT ON COLUMN monitoramentos_djen.buscar_parte IS 
  'Quando true, realiza busca adicional pelo termo como nome de parte além da busca por palavra-chave';
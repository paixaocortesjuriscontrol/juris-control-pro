CREATE TABLE IF NOT EXISTS public.djen_diario_index_tribunais (
  diario_ymd date NOT NULL,
  tribunal text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'erro', 'cancelado')),
  paginas_processadas integer DEFAULT 0,
  max_pages integer DEFAULT 0,
  atualizado_em timestamptz DEFAULT now(),
  erro_mensagem text,
  PRIMARY KEY (diario_ymd, tribunal)
);

CREATE TABLE public.djen_cadernos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tribunal text NOT NULL,
  data date NOT NULL,
  meio text NOT NULL DEFAULT 'E',
  status text NOT NULL DEFAULT 'pendente',
  tamanho_bytes bigint,
  total_comunicacoes integer,
  tentativas integer NOT NULL DEFAULT 0,
  duracao_ms integer,
  erro text,
  url_arquivo text,
  solicitado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tribunal, data, meio)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.djen_cadernos TO authenticated;
GRANT ALL ON public.djen_cadernos TO service_role;
ALTER TABLE public.djen_cadernos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin djen_cadernos" ON public.djen_cadernos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.djen_cadernos_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caderno_id uuid NOT NULL REFERENCES public.djen_cadernos(id) ON DELETE CASCADE,
  via text,
  http_status integer,
  mensagem text,
  sucesso boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.djen_cadernos_tentativas TO authenticated;
GRANT ALL ON public.djen_cadernos_tentativas TO service_role;
ALTER TABLE public.djen_cadernos_tentativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin djen_cadernos_tentativas" ON public.djen_cadernos_tentativas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.djen_cadernos_comunicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caderno_id uuid NOT NULL REFERENCES public.djen_cadernos(id) ON DELETE CASCADE,
  comunicacao_id text,
  numero_processo text,
  numero_digitos text,
  partes text,
  advogados text,
  orgao text,
  tipo text,
  data_disponibilizacao date,
  texto text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_djen_cad_com_caderno ON public.djen_cadernos_comunicacoes(caderno_id);
CREATE INDEX idx_djen_cad_com_digitos ON public.djen_cadernos_comunicacoes(numero_digitos);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.djen_cadernos_comunicacoes TO authenticated;
GRANT ALL ON public.djen_cadernos_comunicacoes TO service_role;
ALTER TABLE public.djen_cadernos_comunicacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin djen_cadernos_comunicacoes" ON public.djen_cadernos_comunicacoes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_djen_cadernos_updated BEFORE UPDATE ON public.djen_cadernos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
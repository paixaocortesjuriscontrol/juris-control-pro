
CREATE TABLE public.kurier_credencial_coordenacoes (
  credencial_id uuid NOT NULL REFERENCES public.kurier_credenciais(id) ON DELETE CASCADE,
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (credencial_id, coordenacao_id)
);

CREATE INDEX idx_kcc_coordenacao ON public.kurier_credencial_coordenacoes(coordenacao_id);
CREATE INDEX idx_kcc_credencial ON public.kurier_credencial_coordenacoes(credencial_id);

ALTER TABLE public.kurier_credencial_coordenacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kcc admin/coord read"
ON public.kurier_credencial_coordenacoes
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "kcc admin/coord insert"
ON public.kurier_credencial_coordenacoes
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "kcc admin/coord delete"
ON public.kurier_credencial_coordenacoes
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

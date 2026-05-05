CREATE TABLE IF NOT EXISTS public.judit_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_numero text NOT NULL,
  cnj text,
  instance text,
  attachment_id text NOT NULL,
  step_id text,
  attachment_name text,
  attachment_date text,
  extension text,
  raw_attachment jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT judit_anexos_processo_attachment_uniq UNIQUE (processo_numero, instance, attachment_id)
);

CREATE INDEX IF NOT EXISTS idx_judit_anexos_processo ON public.judit_anexos (processo_numero, created_at DESC);

ALTER TABLE public.judit_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view judit_anexos" ON public.judit_anexos;
CREATE POLICY "Authenticated can view judit_anexos"
  ON public.judit_anexos FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can insert judit_anexos" ON public.judit_anexos;
CREATE POLICY "Authenticated can insert judit_anexos"
  ON public.judit_anexos FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated can update judit_anexos" ON public.judit_anexos;
CREATE POLICY "Authenticated can update judit_anexos"
  ON public.judit_anexos FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_judit_anexos_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_judit_anexos_updated_at ON public.judit_anexos;
CREATE TRIGGER update_judit_anexos_updated_at
  BEFORE UPDATE ON public.judit_anexos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_judit_anexos_updated_at();
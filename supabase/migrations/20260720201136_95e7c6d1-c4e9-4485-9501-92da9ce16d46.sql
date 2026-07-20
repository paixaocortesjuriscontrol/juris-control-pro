
CREATE TYPE public.tipo_item_prompt_ia AS ENUM ('prazo','tarefa','evento','audiencia');

CREATE TABLE public.prompts_ia_publicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  tipo_item public.tipo_item_prompt_ia NOT NULL,
  prompt text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE (coordenacao_id, tipo_item)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prompts_ia_publicacoes TO authenticated;
GRANT ALL ON public.prompts_ia_publicacoes TO service_role;

ALTER TABLE public.prompts_ia_publicacoes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_prompts_ia_pub_coord ON public.prompts_ia_publicacoes(coordenacao_id);
CREATE INDEX idx_prompts_ia_pub_tipo ON public.prompts_ia_publicacoes(tipo_item);

CREATE POLICY "prompts_ia_pub_select"
ON public.prompts_ia_publicacoes FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao mc
    WHERE mc.coordenacao_id = prompts_ia_publicacoes.coordenacao_id
      AND mc.usuario_id = auth.uid()
  )
);

CREATE POLICY "prompts_ia_pub_insert"
ON public.prompts_ia_publicacoes FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao mc
    WHERE mc.coordenacao_id = prompts_ia_publicacoes.coordenacao_id
      AND mc.usuario_id = auth.uid()
  )
);

CREATE POLICY "prompts_ia_pub_update"
ON public.prompts_ia_publicacoes FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao mc
    WHERE mc.coordenacao_id = prompts_ia_publicacoes.coordenacao_id
      AND mc.usuario_id = auth.uid()
  )
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao mc
    WHERE mc.coordenacao_id = prompts_ia_publicacoes.coordenacao_id
      AND mc.usuario_id = auth.uid()
  )
);

CREATE POLICY "prompts_ia_pub_delete"
ON public.prompts_ia_publicacoes FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.membros_coordenacao mc
    WHERE mc.coordenacao_id = prompts_ia_publicacoes.coordenacao_id
      AND mc.usuario_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.prompts_ia_pub_set_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prompts_ia_pub_updated
BEFORE UPDATE ON public.prompts_ia_publicacoes
FOR EACH ROW EXECUTE FUNCTION public.prompts_ia_pub_set_updated();

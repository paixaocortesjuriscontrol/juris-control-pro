CREATE TABLE IF NOT EXISTS public.evento_processos (
  evento_id uuid NOT NULL REFERENCES public.eventos_agenda(id) ON DELETE CASCADE,
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (evento_id, processo_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evento_processos TO authenticated;
GRANT ALL ON public.evento_processos TO service_role;

ALTER TABLE public.evento_processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see evento_processos of their events"
ON public.evento_processos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.eventos_agenda e
    WHERE e.id = evento_processos.evento_id
      AND (e.criado_por = auth.uid()
           OR EXISTS (SELECT 1 FROM public.participantes_evento pe WHERE pe.evento_id = e.id AND pe.usuario_id = auth.uid()))
  )
);

CREATE POLICY "Users manage evento_processos of their events"
ON public.evento_processos FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.eventos_agenda e WHERE e.id = evento_processos.evento_id AND e.criado_por = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.eventos_agenda e WHERE e.id = evento_processos.evento_id AND e.criado_por = auth.uid())
);

CREATE INDEX IF NOT EXISTS idx_evento_processos_processo ON public.evento_processos(processo_id);
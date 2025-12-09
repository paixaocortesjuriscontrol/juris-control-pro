-- Create table for task comments/conversation
CREATE TABLE public.comentarios_prazos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prazo_id UUID NOT NULL REFERENCES public.prazos(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES public.profiles(id),
  conteudo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.comentarios_prazos ENABLE ROW LEVEL SECURITY;

-- Users can view comments on tasks they have access to
CREATE POLICY "Users can view comments on accessible tasks"
ON public.comentarios_prazos
FOR SELECT
USING (
  prazo_id IN (
    SELECT p.id FROM prazos p WHERE can_access_processo(auth.uid(), p.processo_id)
  )
);

-- Users can create comments on tasks they have access to
CREATE POLICY "Users can create comments on accessible tasks"
ON public.comentarios_prazos
FOR INSERT
WITH CHECK (
  autor_id = auth.uid() AND
  prazo_id IN (
    SELECT p.id FROM prazos p WHERE can_access_processo(auth.uid(), p.processo_id)
  )
);

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
ON public.comentarios_prazos
FOR UPDATE
USING (autor_id = auth.uid());

-- Users can delete their own comments or admins can delete any
CREATE POLICY "Users can delete own comments"
ON public.comentarios_prazos
FOR DELETE
USING (autor_id = auth.uid() OR is_admin_or_coordenador(auth.uid()));

-- Create index for faster queries
CREATE INDEX idx_comentarios_prazos_prazo_id ON public.comentarios_prazos(prazo_id);
CREATE INDEX idx_comentarios_prazos_autor_id ON public.comentarios_prazos(autor_id);
-- Criar tabela de comentários para eventos (parcelamentos, audiências, etc)
CREATE TABLE IF NOT EXISTS public.comentarios_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id UUID NOT NULL REFERENCES public.eventos_agenda(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES auth.users(id),
  conteudo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comentarios_eventos ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Usuários autenticados podem ver comentários de eventos"
  ON public.comentarios_eventos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar comentários em eventos"
  ON public.comentarios_eventos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = autor_id);

CREATE POLICY "Usuários podem editar seus próprios comentários"
  ON public.comentarios_eventos
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = autor_id);

CREATE POLICY "Usuários podem excluir seus próprios comentários"
  ON public.comentarios_eventos
  FOR DELETE
  TO authenticated
  USING (auth.uid() = autor_id);

-- Índice para performance
CREATE INDEX idx_comentarios_eventos_evento_id ON public.comentarios_eventos(evento_id);
CREATE INDEX idx_comentarios_eventos_autor_id ON public.comentarios_eventos(autor_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_comentarios_eventos_updated_at
  BEFORE UPDATE ON public.comentarios_eventos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
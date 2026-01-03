
-- Create eventos_agenda table for calendar events
CREATE TABLE public.eventos_agenda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'evento',
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  data_fim TIMESTAMP WITH TIME ZONE,
  dia_inteiro BOOLEAN DEFAULT false,
  local TEXT,
  recorrente BOOLEAN DEFAULT false,
  recorrencia_tipo TEXT,
  recorrencia_intervalo INTEGER DEFAULT 1,
  recorrencia_fim DATE,
  recorrencia_dias_semana INTEGER[],
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  criado_por UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  concluido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for event participants
CREATE TABLE public.participantes_evento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id UUID NOT NULL REFERENCES public.eventos_agenda(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  notificar BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(evento_id, usuario_id)
);

-- Create table for event alerts/reminders
CREATE TABLE public.alertas_evento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id UUID NOT NULL REFERENCES public.eventos_agenda(id) ON DELETE CASCADE,
  minutos_antes INTEGER NOT NULL DEFAULT 30,
  enviado BOOLEAN DEFAULT false,
  enviado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.eventos_agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participantes_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_evento ENABLE ROW LEVEL SECURITY;

-- RLS Policies for eventos_agenda
CREATE POLICY "Users can view events they created or participate in"
ON public.eventos_agenda FOR SELECT
USING (
  criado_por = auth.uid() 
  OR id IN (SELECT evento_id FROM public.participantes_evento WHERE usuario_id = auth.uid())
  OR is_admin_or_coordenador(auth.uid())
);

CREATE POLICY "Users can create events"
ON public.eventos_agenda FOR INSERT
WITH CHECK (criado_por = auth.uid());

CREATE POLICY "Users can update own events or admins"
ON public.eventos_agenda FOR UPDATE
USING (criado_por = auth.uid() OR is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Users can delete own events or admins"
ON public.eventos_agenda FOR DELETE
USING (criado_por = auth.uid() OR is_admin_or_coordenador(auth.uid()));

-- RLS Policies for participantes_evento
CREATE POLICY "Users can view participants of accessible events"
ON public.participantes_evento FOR SELECT
USING (
  evento_id IN (SELECT id FROM public.eventos_agenda WHERE criado_por = auth.uid())
  OR usuario_id = auth.uid()
  OR is_admin_or_coordenador(auth.uid())
);

CREATE POLICY "Event creators can manage participants"
ON public.participantes_evento FOR ALL
USING (
  evento_id IN (SELECT id FROM public.eventos_agenda WHERE criado_por = auth.uid())
  OR is_admin_or_coordenador(auth.uid())
);

-- RLS Policies for alertas_evento
CREATE POLICY "Users can view alerts for their events"
ON public.alertas_evento FOR SELECT
USING (
  evento_id IN (
    SELECT id FROM public.eventos_agenda 
    WHERE criado_por = auth.uid() 
    OR id IN (SELECT evento_id FROM public.participantes_evento WHERE usuario_id = auth.uid())
  )
  OR is_admin_or_coordenador(auth.uid())
);

CREATE POLICY "Event creators can manage alerts"
ON public.alertas_evento FOR ALL
USING (
  evento_id IN (SELECT id FROM public.eventos_agenda WHERE criado_por = auth.uid())
  OR is_admin_or_coordenador(auth.uid())
);

-- Add updated_at trigger
CREATE TRIGGER update_eventos_agenda_updated_at
BEFORE UPDATE ON public.eventos_agenda
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

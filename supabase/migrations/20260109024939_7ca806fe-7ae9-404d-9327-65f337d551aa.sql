-- Remover tabela anterior e criar nova estrutura por coordenação
DROP TABLE IF EXISTS public.alertas_monitoramento_djen;

-- Tabela para configuração de alertas WhatsApp por coordenação
CREATE TABLE public.alertas_coordenacao_djen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coordenacao_id UUID NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  horario_envio TIME NOT NULL DEFAULT '08:00:00',
  membros_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(coordenacao_id)
);

-- Enable RLS
ALTER TABLE public.alertas_coordenacao_djen ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver alertas de coordenações que têm acesso"
ON public.alertas_coordenacao_djen
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM membros_coordenacao mc
    WHERE mc.coordenacao_id = alertas_coordenacao_djen.coordenacao_id
    AND mc.usuario_id = auth.uid()
  )
  OR is_admin_or_coordenador(auth.uid())
);

CREATE POLICY "Admins e coordenadores podem inserir alertas"
ON public.alertas_coordenacao_djen
FOR INSERT
WITH CHECK (is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Admins e coordenadores podem atualizar alertas"
ON public.alertas_coordenacao_djen
FOR UPDATE
USING (is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Admins e coordenadores podem deletar alertas"
ON public.alertas_coordenacao_djen
FOR DELETE
USING (is_admin_or_coordenador(auth.uid()));

-- Trigger para updated_at
CREATE TRIGGER update_alertas_coordenacao_djen_updated_at
BEFORE UPDATE ON public.alertas_coordenacao_djen
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
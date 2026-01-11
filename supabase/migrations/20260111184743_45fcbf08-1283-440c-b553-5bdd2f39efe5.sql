-- Corrigir coordenador da coordenação Dr. Jhonatan para o perfil correto
UPDATE public.coordenacoes
SET coordenador_id = '41294d81-47c9-40f4-9ad5-37f431c702a2'  -- Jhonatan Gonçalves
WHERE id = '968631d0-6659-46f1-b45d-899892cb0121';

-- Atualizar o cargo do membro Jhonatan Gonçalves para 'coordenador'
UPDATE public.membros_coordenacao
SET cargo = 'coordenador'
WHERE coordenacao_id = '968631d0-6659-46f1-b45d-899892cb0121'
  AND usuario_id = '41294d81-47c9-40f4-9ad5-37f431c702a2';

-- Garantir que todos os coordenadores estejam como membros de suas coordenações
INSERT INTO public.membros_coordenacao (coordenacao_id, usuario_id, cargo)
SELECT c.id, c.coordenador_id, 'coordenador'
FROM public.coordenacoes c
WHERE NOT EXISTS (
  SELECT 1 FROM public.membros_coordenacao mc 
  WHERE mc.coordenacao_id = c.id AND mc.usuario_id = c.coordenador_id
)
ON CONFLICT DO NOTHING;

-- Criar trigger para garantir que novos coordenadores sejam automaticamente membros
CREATE OR REPLACE FUNCTION public.ensure_coordenador_is_member()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o coordenador mudou, adicionar como membro se ainda não for
  IF NEW.coordenador_id IS NOT NULL AND 
     (OLD.coordenador_id IS NULL OR NEW.coordenador_id != OLD.coordenador_id) THEN
    INSERT INTO public.membros_coordenacao (coordenacao_id, usuario_id, cargo)
    VALUES (NEW.id, NEW.coordenador_id, 'coordenador')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Remover trigger se existir e criar novamente
DROP TRIGGER IF EXISTS trigger_ensure_coordenador_is_member ON public.coordenacoes;
CREATE TRIGGER trigger_ensure_coordenador_is_member
AFTER INSERT OR UPDATE ON public.coordenacoes
FOR EACH ROW
EXECUTE FUNCTION public.ensure_coordenador_is_member();
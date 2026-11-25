DROP POLICY IF EXISTS "Participantes de atividades veem o processo ligado" ON public.processos;
DROP FUNCTION IF EXISTS public.sou_participante_item_do_processo(uuid);
-- Política para admins/coordenadores verem TODAS as tarefas
DROP POLICY IF EXISTS "Admins e coordenadores podem ver todas as tarefas" ON public.tarefas;
CREATE POLICY "Admins e coordenadores podem ver todas as tarefas"
ON public.tarefas
FOR SELECT
USING (public.is_admin_or_coordenador(auth.uid()));

-- Política para admins/coordenadores verem TODOS os eventos
DROP POLICY IF EXISTS "Admins e coordenadores podem ver todos os eventos" ON public.eventos_agenda;
CREATE POLICY "Admins e coordenadores podem ver todos os eventos"
ON public.eventos_agenda
FOR SELECT
USING (public.is_admin_or_coordenador(auth.uid()));
-- Permitir que usuários autenticados criem execuções de monitoramento
CREATE POLICY "Usuarios autenticados podem criar execucoes"
ON public.execucoes_agendadas
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permitir que usuários autenticados atualizem execuções (para cancelar)
CREATE POLICY "Usuarios autenticados podem atualizar execucoes"
ON public.execucoes_agendadas
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
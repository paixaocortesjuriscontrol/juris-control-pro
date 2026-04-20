-- Permite que qualquer usuário autenticado possa atualizar, inserir e deletar
-- registros em dados_benner. Antes, somente o dono (user_id) ou admin/coordenador podia editar,
-- o que bloqueava operações legítimas de membros de equipe sobre dados compartilhados.

DROP POLICY IF EXISTS dados_benner_update ON public.dados_benner;
DROP POLICY IF EXISTS dados_benner_insert ON public.dados_benner;
DROP POLICY IF EXISTS dados_benner_delete ON public.dados_benner;

CREATE POLICY dados_benner_update
ON public.dados_benner
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY dados_benner_insert
ON public.dados_benner
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY dados_benner_delete
ON public.dados_benner
FOR DELETE
TO authenticated
USING (is_admin_or_coordenador(auth.uid()));
-- PROCESSOS: consolidar 3 políticas de leitura em 1 com auth cacheado
DROP POLICY IF EXISTS "Users can view accessible processos" ON public.processos;
DROP POLICY IF EXISTS "processos_select_scoped" ON public.processos;
DROP POLICY IF EXISTS "Clients can view their own processos" ON public.processos;

CREATE POLICY "processos_select_scoped" ON public.processos
FOR SELECT
USING (
  (select public.is_admin_or_coordenador(auth.uid()))
  OR advogado_responsavel_id = (select auth.uid())
  OR coordenacao_id IN (
    select mc.coordenacao_id from public.membros_coordenacao mc where mc.usuario_id = (select auth.uid())
  )
  OR EXISTS (
    select 1 from public.processos_responsaveis pr
    where pr.processo_id = processos.id and pr.usuario_id = (select auth.uid()) and pr.ativo = true
  )
  OR cliente_id IN (
    select cu.cliente_id from public.clientes_usuarios cu where cu.user_id = (select auth.uid()) and cu.ativo = true
  )
);

-- TAREFAS
DROP POLICY IF EXISTS "Admins e coordenadores podem ver todas as tarefas" ON public.tarefas;
DROP POLICY IF EXISTS "Users can view prazos of accessible processos or own" ON public.tarefas;

CREATE POLICY "tarefas_select_scoped" ON public.tarefas
FOR SELECT
USING (
  (select public.is_admin_or_coordenador(auth.uid()))
  OR (
    (select public.is_user_active(auth.uid()))
    AND (
      processo_id IS NULL
      OR responsavel_id = (select auth.uid())
      OR criado_por = (select auth.uid())
      OR public.can_access_processo((select auth.uid()), processo_id)
    )
  )
);

-- EVENTOS_AGENDA
DROP POLICY IF EXISTS "Admins e coordenadores podem ver todos os eventos" ON public.eventos_agenda;
DROP POLICY IF EXISTS "Agenda: view events" ON public.eventos_agenda;

CREATE POLICY "eventos_agenda_select_scoped" ON public.eventos_agenda
FOR SELECT
USING (
  (select public.is_admin_or_coordenador(auth.uid()))
  OR public.can_access_evento((select auth.uid()), id)
);

-- AUDIENCIAS_DETECTADAS
DROP POLICY IF EXISTS "Usuários podem ver audiências acessíveis" ON public.audiencias_detectadas;

CREATE POLICY "Usuários podem ver audiências acessíveis" ON public.audiencias_detectadas
FOR SELECT
USING (
  (select public.is_admin_or_coordenador(auth.uid()))
  OR (origem = 'manual' AND criado_por = (select auth.uid()))
  OR (coordenacao_id IS NOT NULL AND coordenacao_id IN (
        select mc.coordenacao_id from public.membros_coordenacao mc where mc.usuario_id = (select auth.uid())
      ))
  OR monitoramento_id IN (
    select m.id from public.monitoramentos_djen m
    where m.criado_por = (select auth.uid())
       or m.coordenacao_id IN (
          select mc.coordenacao_id from public.membros_coordenacao mc where mc.usuario_id = (select auth.uid())
       )
  )
);

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON public.profiles;
CREATE POLICY "Users can view own profile or admins can view all" ON public.profiles
FOR SELECT
USING (id = (select auth.uid()) OR (select public.is_admin_or_coordenador(auth.uid())));

-- MEMBROS_COORDENACAO
DROP POLICY IF EXISTS "Users can view membros of their coordenacoes" ON public.membros_coordenacao;
CREATE POLICY "Users can view membros of their coordenacoes" ON public.membros_coordenacao
FOR SELECT TO authenticated
USING (
  (select public.is_admin_or_coordenador(auth.uid()))
  OR usuario_id = (select auth.uid())
  OR public.is_member_of_coordenacao((select auth.uid()), coordenacao_id)
);

-- PARTICIPANTES_EVENTO
DROP POLICY IF EXISTS "Agenda: view participants" ON public.participantes_evento;
CREATE POLICY "Agenda: view participants" ON public.participantes_evento
FOR SELECT TO authenticated
USING (
  (select public.is_admin_or_coordenador(auth.uid()))
  OR public.can_access_evento((select auth.uid()), evento_id)
);

-- CLIENTES: consolidar 2 políticas de leitura
DROP POLICY IF EXISTS "Users can view clientes linked to accessible processos" ON public.clientes;
DROP POLICY IF EXISTS "clientes_select_scoped" ON public.clientes;
CREATE POLICY "clientes_select_scoped" ON public.clientes
FOR SELECT
USING (
  (select public.is_admin_or_coordenador(auth.uid()))
  OR EXISTS (
    select 1 from public.clientes_usuarios cu
    where cu.cliente_id = clientes.id and cu.user_id = (select auth.uid()) and cu.ativo = true
  )
  OR ((select public.is_user_active(auth.uid())) AND id IN (
    select p.cliente_id from public.processos p
    where p.cliente_id is not null
      and (p.advogado_responsavel_id = (select auth.uid())
           or p.coordenacao_id IN (select mc.coordenacao_id from public.membros_coordenacao mc where mc.usuario_id = (select auth.uid())))
  ))
);

ANALYZE public.processos;
ANALYZE public.tarefas;
ANALYZE public.audiencias_detectadas;
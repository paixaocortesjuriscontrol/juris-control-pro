-- Permite cancelar uma execução do DJEN Servidor.
create or replace function public.cancelar_execucao_servidor(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.execucoes_servidor
     set status = 'cancelado',
         finalizado_em = coalesce(finalizado_em, now()),
         erro = coalesce(erro, 'Cancelado pelo usuário')
   where id = p_id
     and status in ('pendente','executando');
end;
$$;

grant execute on function public.cancelar_execucao_servidor(uuid) to authenticated;
grant execute on function public.cancelar_execucao_servidor(uuid) to service_role;

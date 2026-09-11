revoke execute on function public.escopo_acompanhamento_especial(uuid) from anon, public;
revoke execute on function public.get_acomp_especial_divergencias(boolean, timestamptz, timestamptz, integer) from anon, public;
revoke execute on function public.get_acomp_especial_eventos(boolean, timestamptz, timestamptz, integer) from anon, public;
grant execute on function public.escopo_acompanhamento_especial(uuid) to authenticated;
grant execute on function public.get_acomp_especial_divergencias(boolean, timestamptz, timestamptz, integer) to authenticated;
grant execute on function public.get_acomp_especial_eventos(boolean, timestamptz, timestamptz, integer) to authenticated;
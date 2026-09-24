alter function public.get_inteligencia_dashboard set statement_timeout = '90s';
alter function public.get_inteligencia_processos set statement_timeout = '90s';
alter function public.get_inteligencia_ofensores set statement_timeout = '90s';
alter function public.get_inteligencia_judit(uuid,text) set statement_timeout = '90s';
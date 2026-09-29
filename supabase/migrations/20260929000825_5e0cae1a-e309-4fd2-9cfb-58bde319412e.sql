DROP POLICY IF EXISTS "Admins gerenciam situacoes_envio_carga" ON public.situacoes_envio_carga;
CREATE POLICY "Admins e coordenadores gerenciam situacoes_envio_carga" ON public.situacoes_envio_carga FOR ALL TO authenticated USING (public.is_admin_or_coordenador(auth.uid())) WITH CHECK (public.is_admin_or_coordenador(auth.uid()));

DROP POLICY IF EXISTS "Admins podem ver arquivados" ON public.dados_benner_arquivados;
CREATE POLICY "Admins e coordenadores veem arquivados" ON public.dados_benner_arquivados FOR SELECT TO authenticated USING (public.is_admin_or_coordenador(auth.uid()));
DROP POLICY IF EXISTS "Admins podem deletar arquivados" ON public.dados_benner_arquivados;
CREATE POLICY "Admins e coordenadores deletam arquivados" ON public.dados_benner_arquivados FOR DELETE TO authenticated USING (public.is_admin_or_coordenador(auth.uid()));

DROP POLICY IF EXISTS "Admins podem ver auditoria da distribuicao TST" ON public.auditoria_distribuicao_tst;
CREATE POLICY "Admins e coordenadores veem auditoria da distribuicao TST" ON public.auditoria_distribuicao_tst FOR SELECT TO authenticated USING (public.is_admin_or_coordenador(auth.uid()));

DROP POLICY IF EXISTS "equipes_tst admin insere" ON public.equipes_tst;
CREATE POLICY "equipes_tst admin ou coordenador insere" ON public.equipes_tst FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_coordenador(auth.uid()));
DROP POLICY IF EXISTS "equipes_tst admin remove" ON public.equipes_tst;
CREATE POLICY "equipes_tst admin ou coordenador remove" ON public.equipes_tst FOR DELETE TO authenticated USING (public.is_admin_or_coordenador(auth.uid()));

DROP POLICY IF EXISTS "Admins e coordenadores gerenciam pedidos por dossie" ON public.pedidos_por_dossie;
CREATE POLICY "Admins e coordenadores gerenciam pedidos por dossie" ON public.pedidos_por_dossie FOR ALL TO authenticated USING (public.is_admin_or_coordenador(auth.uid())) WITH CHECK (public.is_admin_or_coordenador(auth.uid()));

CREATE OR REPLACE FUNCTION public.restaurar_dados_benner_arquivado(_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _snapshot jsonb; _restored_id uuid;
BEGIN
  IF NOT public.is_admin_or_coordenador(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores e coordenadores podem restaurar';
  END IF;
  SELECT snapshot INTO _snapshot FROM public.dados_benner_arquivados WHERE id = _id;
  IF _snapshot IS NULL THEN RAISE EXCEPTION 'Arquivo não encontrado'; END IF;
  INSERT INTO public.dados_benner SELECT * FROM jsonb_populate_record(NULL::public.dados_benner, _snapshot) RETURNING id INTO _restored_id;
  DELETE FROM public.dados_benner_arquivados WHERE id = _id;
  RETURN _restored_id;
END;
$function$;
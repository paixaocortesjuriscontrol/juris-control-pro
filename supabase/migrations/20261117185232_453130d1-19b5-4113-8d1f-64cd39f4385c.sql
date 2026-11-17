CREATE OR REPLACE FUNCTION public.trg_pautas_tst_padrao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pj jsonb; adv text;
BEGIN
  IF NEW.relator IS NOT NULL AND NEW.relator !~* '^sem informa' THEN
    NEW.relator := pauta_relator_padrao(NEW.relator);
  END IF;
  IF coalesce(NEW.advogado_interno,'') <> '' AND EXISTS (
       SELECT 1 FROM profiles pr WHERE coalesce(pr.nome,'') <> ''
         AND position(upper(pr.nome) in upper(NEW.advogado_interno)) > 0) THEN
    NEW.advogado_interno := NULL;
  END IF;
  IF coalesce(NEW.advogado_interno,'') = '' AND NEW.dados_benner_id IS NOT NULL THEN
    SELECT nullif(upper(array_to_string(advogados_internos, ', ')), '') INTO adv FROM dados_benner WHERE id = NEW.dados_benner_id;
    NEW.advogado_interno := adv;
  END IF;
  IF coalesce(NEW.parte_recorrente,'') = '' AND NEW.publicacao_djen_id IS NOT NULL THEN
    SELECT partes_json::jsonb INTO pj FROM publicacoes_djen WHERE id = NEW.publicacao_djen_id;
    IF pj IS NOT NULL THEN NEW.parte_recorrente := nullif(pauta_partes_polo(pj,'A'),''); END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.trg_pautas_tst_padrao() FROM PUBLIC, anon, authenticated;
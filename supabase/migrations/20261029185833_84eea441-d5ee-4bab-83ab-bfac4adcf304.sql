CREATE OR REPLACE FUNCTION public.sync_etiqueta_captura()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_etq uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.acompanhamento_especial IS DISTINCT FROM NEW.acompanhamento_especial
      OR OLD.coordenacao_id IS DISTINCT FROM NEW.coordenacao_id) THEN
    DELETE FROM etiquetas_itens ei USING etiquetas e
     WHERE ei.etiqueta_id = e.id AND lower(e.nome) = 'captura'
       AND ei.entidade = 'processo' AND ei.entidade_id = NEW.id;
  END IF;
  IF NEW.acompanhamento_especial AND NEW.coordenacao_id IS NOT NULL THEN
    SELECT id INTO v_etq FROM etiquetas WHERE coordenacao_id = NEW.coordenacao_id AND lower(nome) = 'captura';
    IF v_etq IS NULL THEN
      INSERT INTO etiquetas (coordenacao_id, nome, cor) VALUES (NEW.coordenacao_id, 'CAPTURA', '#dc2626')
      ON CONFLICT (coordenacao_id, lower(nome)) DO NOTHING RETURNING id INTO v_etq;
      IF v_etq IS NULL THEN
        SELECT id INTO v_etq FROM etiquetas WHERE coordenacao_id = NEW.coordenacao_id AND lower(nome) = 'captura';
      END IF;
    END IF;
    INSERT INTO etiquetas_itens (etiqueta_id, entidade, entidade_id) VALUES (v_etq, 'processo', NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_etiqueta_captura() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sync_etiqueta_captura ON public.processos;
CREATE TRIGGER trg_sync_etiqueta_captura
AFTER INSERT OR UPDATE OF acompanhamento_especial, coordenacao_id ON public.processos
FOR EACH ROW EXECUTE FUNCTION public.sync_etiqueta_captura();

INSERT INTO public.etiquetas (coordenacao_id, nome, cor)
SELECT DISTINCT coordenacao_id, 'CAPTURA', '#dc2626' FROM public.processos
 WHERE acompanhamento_especial AND coordenacao_id IS NOT NULL
ON CONFLICT (coordenacao_id, lower(nome)) DO NOTHING;

INSERT INTO public.etiquetas_itens (etiqueta_id, entidade, entidade_id)
SELECT e.id, 'processo', p.id FROM public.processos p
JOIN public.etiquetas e ON e.coordenacao_id = p.coordenacao_id AND lower(e.nome) = 'captura'
WHERE p.acompanhamento_especial
ON CONFLICT DO NOTHING;
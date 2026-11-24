CREATE OR REPLACE FUNCTION public.projuris_corte_ativo(_uid uuid)
RETURNS TABLE(data_corte date, lote_criado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (m.mapeamento->>'data_corte')::date, m.created_at
  FROM public.migracoes_projuris m
  WHERE _uid IS NOT NULL AND m.criado_por = _uid AND m.status = 'em_andamento'
    AND m.created_at >= now() - interval '6 hours'
    AND coalesce(m.mapeamento->>'data_corte','') ~ '^\d{4}-\d{2}-\d{2}$'
  ORDER BY m.created_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.guarda_corte_projuris()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c date; _lote timestamptz; _d timestamptz; _uid uuid;
BEGIN
  BEGIN _uid := auth.uid(); EXCEPTION WHEN OTHERS THEN _uid := NULL; END;
  IF _uid IS NULL THEN RETURN NEW; END IF;
  SELECT data_corte, lote_criado_em INTO _c, _lote FROM public.projuris_corte_ativo(_uid);
  IF _c IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.created_at < _lote THEN
      RAISE EXCEPTION 'Migração com data de corte em andamento: atividades já existentes não podem ser alteradas.';
    END IF;
    RETURN NEW;
  END IF;
  IF coalesce(NEW.origem,'') <> 'projuris' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'tarefas' THEN
    _d := coalesce(NEW.data_fatal::timestamptz, NEW.data_vencimento::timestamptz, NEW.data_prevista::timestamptz);
    IF _d IS NOT NULL AND coalesce(NEW.data_fatal, NEW.data_vencimento, NEW.data_prevista)::date > _c THEN
      RAISE EXCEPTION 'Atividade depois da data de corte (%).', to_char(_c,'DD/MM/YYYY');
    END IF;
  ELSIF TG_TABLE_NAME = 'audiencias_detectadas' THEN
    IF NEW.data_audiencia IS NOT NULL AND (NEW.data_audiencia AT TIME ZONE 'America/Sao_Paulo')::date > _c THEN
      RAISE EXCEPTION 'Audiência depois da data de corte (%).', to_char(_c,'DD/MM/YYYY');
    END IF;
  ELSIF TG_TABLE_NAME = 'eventos_agenda' THEN
    IF NEW.data_inicio IS NOT NULL AND (NEW.data_inicio AT TIME ZONE 'America/Sao_Paulo')::date > _c THEN
      RAISE EXCEPTION 'Evento depois da data de corte (%).', to_char(_c,'DD/MM/YYYY');
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guarda_corte_projuris ON public.tarefas;
CREATE TRIGGER trg_guarda_corte_projuris BEFORE INSERT OR UPDATE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.guarda_corte_projuris();
DROP TRIGGER IF EXISTS trg_guarda_corte_projuris ON public.audiencias_detectadas;
CREATE TRIGGER trg_guarda_corte_projuris BEFORE INSERT OR UPDATE ON public.audiencias_detectadas FOR EACH ROW EXECUTE FUNCTION public.guarda_corte_projuris();
DROP TRIGGER IF EXISTS trg_guarda_corte_projuris ON public.eventos_agenda;
CREATE TRIGGER trg_guarda_corte_projuris BEFORE INSERT OR UPDATE ON public.eventos_agenda FOR EACH ROW EXECUTE FUNCTION public.guarda_corte_projuris();

CREATE OR REPLACE FUNCTION public.enfileirar_aviso_item(_tipo text, _entidade text, _id uuid, _ator uuid, _contexto jsonb DEFAULT '{}'::jsonb, _extra uuid[] DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  RAISE EXCEPTION 'placeholder';
END $fn$;

-- 1) Tabela de falhas por item para refila no mesmo dia
CREATE TABLE public.execucoes_servidor_falhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  execucao_id uuid REFERENCES public.execucoes_servidor(id) ON DELETE SET NULL,
  item_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ultimo_erro text,
  tentativas int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pendente',
  dia_brt date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, dia_brt, item_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.execucoes_servidor_falhas TO authenticated;
GRANT ALL ON public.execucoes_servidor_falhas TO service_role;

ALTER TABLE public.execucoes_servidor_falhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "falhas_select_authenticated" ON public.execucoes_servidor_falhas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "falhas_service_role_all" ON public.execucoes_servidor_falhas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX execucoes_servidor_falhas_pendentes_idx
  ON public.execucoes_servidor_falhas (tipo, dia_brt, status, tentativas)
  WHERE status = 'pendente';

CREATE TRIGGER trg_execucoes_servidor_falhas_updated
  BEFORE UPDATE ON public.execucoes_servidor_falhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Colunas de rodada / slot horário em execucoes_servidor
ALTER TABLE public.execucoes_servidor
  ADD COLUMN IF NOT EXISTS rodada_do_dia int,
  ADD COLUMN IF NOT EXISTS slot_horario text;

-- 3) RPC atualizada para gravar rodada/slot opcionalmente
CREATE OR REPLACE FUNCTION public.enfileirar_execucao_servidor(
  p_tipo text,
  p_agendado_para timestamp with time zone DEFAULT now(),
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_rodada int DEFAULT NULL,
  p_slot text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
  v_id uuid;
BEGIN
  IF COALESCE((p_payload->>'manual')::boolean, false) THEN
    v_key := p_tipo || '|manual|' || gen_random_uuid()::text;
  ELSE
    v_key := p_tipo || '|' || to_char(date_trunc('hour', p_agendado_para) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24');
  END IF;

  INSERT INTO public.execucoes_servidor (tipo, agendado_para, payload, dedupe_key, rodada_do_dia, slot_horario)
  VALUES (p_tipo, p_agendado_para, p_payload, v_key, p_rodada, p_slot)
  ON CONFLICT (dedupe_key) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

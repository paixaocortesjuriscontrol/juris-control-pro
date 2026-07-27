CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_dedup_grupo
  ON public.publicacoes_djen (dedup_processo_digits, dedup_data_ref, coordenacao_id);

CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_processos_dedup_grupo
  ON public.publicacoes_djen_processos (dedup_processo_digits, dedup_data_ref, coordenacao_id);

CREATE OR REPLACE FUNCTION public.propagar_leitura_djen_grupo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tabela_origem = 'termo' THEN
    INSERT INTO public.publicacoes_djen_leituras (publicacao_id, tabela_origem, usuario_id, usuario_nome, lida_em)
    SELECT irmao.id, 'termo', NEW.usuario_id, NEW.usuario_nome, NEW.lida_em
    FROM public.publicacoes_djen origem
    JOIN public.publicacoes_djen irmao
      ON irmao.dedup_processo_digits IS NOT DISTINCT FROM origem.dedup_processo_digits
     AND irmao.dedup_data_ref IS NOT DISTINCT FROM origem.dedup_data_ref
     AND irmao.coordenacao_id IS NOT DISTINCT FROM origem.coordenacao_id
     AND irmao.dedup_head_norm IS NOT DISTINCT FROM origem.dedup_head_norm
    WHERE origem.id = NEW.publicacao_id
      AND irmao.id <> NEW.publicacao_id
    ON CONFLICT (publicacao_id, tabela_origem, usuario_id) DO NOTHING;
  ELSIF NEW.tabela_origem = 'processo' THEN
    INSERT INTO public.publicacoes_djen_leituras (publicacao_id, tabela_origem, usuario_id, usuario_nome, lida_em)
    SELECT irmao.id, 'processo', NEW.usuario_id, NEW.usuario_nome, NEW.lida_em
    FROM public.publicacoes_djen_processos origem
    JOIN public.publicacoes_djen_processos irmao
      ON irmao.dedup_processo_digits IS NOT DISTINCT FROM origem.dedup_processo_digits
     AND irmao.dedup_data_ref IS NOT DISTINCT FROM origem.dedup_data_ref
     AND irmao.coordenacao_id IS NOT DISTINCT FROM origem.coordenacao_id
     AND irmao.dedup_head_norm IS NOT DISTINCT FROM origem.dedup_head_norm
    WHERE origem.id = NEW.publicacao_id
      AND irmao.id <> NEW.publicacao_id
    ON CONFLICT (publicacao_id, tabela_origem, usuario_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagar_leitura_djen_grupo ON public.publicacoes_djen_leituras;
CREATE TRIGGER trg_propagar_leitura_djen_grupo
AFTER INSERT ON public.publicacoes_djen_leituras
FOR EACH ROW
WHEN (pg_trigger_depth() = 1)
EXECUTE FUNCTION public.propagar_leitura_djen_grupo();
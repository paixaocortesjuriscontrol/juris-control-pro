-- 1. Remover índice único por texto exato (permite máscara e dígitos coexistirem)
DROP INDEX IF EXISTS public.processos_numero_uidx;

-- 2. Normalizar números de processo para a máscara CNJ
UPDATE public.processos
SET numero = substr(regexp_replace(numero,'\D','','g'),1,7) || '-' ||
             substr(regexp_replace(numero,'\D','','g'),8,2) || '.' ||
             substr(regexp_replace(numero,'\D','','g'),10,4) || '.' ||
             substr(regexp_replace(numero,'\D','','g'),14,1) || '.' ||
             substr(regexp_replace(numero,'\D','','g'),15,2) || '.' ||
             substr(regexp_replace(numero,'\D','','g'),17,4)
WHERE numero IS NOT NULL
  AND length(regexp_replace(numero,'\D','','g')) = 20
  AND numero <> substr(regexp_replace(numero,'\D','','g'),1,7) || '-' ||
             substr(regexp_replace(numero,'\D','','g'),8,2) || '.' ||
             substr(regexp_replace(numero,'\D','','g'),10,4) || '.' ||
             substr(regexp_replace(numero,'\D','','g'),14,1) || '.' ||
             substr(regexp_replace(numero,'\D','','g'),15,2) || '.' ||
             substr(regexp_replace(numero,'\D','','g'),17,4);

-- 3. Função de unificação de processos duplicados (mesmo número por dígitos)
CREATE OR REPLACE FUNCTION public.merge_processos_duplicados()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_grp record;
  v_principal uuid;
  v_dup record;
  v_tab record;
  v_col record;
  v_ctid tid;
  v_grupos int := 0;
  v_removidos int := 0;
  v_coords int := 0;
  v_placeholders text[] := ARRAY['a identificar','autor não identificado','réu não identificado','não identificado'];
BEGIN
  FOR v_grp IN
    SELECT regexp_replace(numero,'\D','','g') AS d
    FROM public.processos
    WHERE numero IS NOT NULL AND numero <> ''
    GROUP BY 1
    HAVING count(*) > 1
  LOOP
    SELECT p.id INTO v_principal
    FROM public.processos p
    WHERE regexp_replace(p.numero,'\D','','g') = v_grp.d
    ORDER BY (
        (CASE WHEN coalesce(lower(btrim(p.polo_ativo)),'') <> '' AND lower(btrim(p.polo_ativo)) <> ALL (v_placeholders) THEN 1 ELSE 0 END)
      + (CASE WHEN coalesce(lower(btrim(p.polo_passivo)),'') <> '' AND lower(btrim(p.polo_passivo)) <> ALL (v_placeholders) THEN 1 ELSE 0 END)
      + (CASE WHEN p.cliente_id IS NOT NULL THEN 1 ELSE 0 END)
    ) DESC,
      (SELECT count(*) FROM public.movimentacoes m WHERE m.processo_id = p.id) DESC,
      p.created_at ASC
    LIMIT 1;

    v_grupos := v_grupos + 1;

    FOR v_dup IN
      SELECT id, coordenacao_id
      FROM public.processos
      WHERE regexp_replace(numero,'\D','','g') = v_grp.d
        AND id <> v_principal
    LOOP
      -- coordenações responsáveis passam para o processo principal
      INSERT INTO public.processos_coordenacoes_responsaveis (processo_id, coordenacao_id, principal)
      SELECT v_principal, v_dup.coordenacao_id, false
      WHERE v_dup.coordenacao_id IS NOT NULL
      ON CONFLICT (processo_id, coordenacao_id) DO NOTHING;

      INSERT INTO public.processos_coordenacoes_responsaveis (processo_id, coordenacao_id, principal)
      SELECT v_principal, r.coordenacao_id, false
      FROM public.processos_coordenacoes_responsaveis r
      WHERE r.processo_id = v_dup.id AND r.coordenacao_id IS NOT NULL
      ON CONFLICT (processo_id, coordenacao_id) DO NOTHING;

      v_coords := v_coords + 1;

      -- completar campos vazios do principal com dados do duplicado
      FOR v_col IN
        SELECT a.attname
        FROM pg_attribute a
        WHERE a.attrelid = 'public.processos'::regclass
          AND a.attnum > 0 AND NOT a.attisdropped
          AND a.attgenerated = ''
          AND a.attname NOT IN ('id','numero','created_at','updated_at','coordenacao_id')
      LOOP
        EXECUTE format(
          'UPDATE public.processos p SET %1$I = d.%1$I FROM public.processos d
             WHERE p.id = $1 AND d.id = $2 AND d.%1$I IS NOT NULL
               AND (p.%1$I IS NULL OR btrim(p.%1$I::text) = '''' OR lower(btrim(p.%1$I::text)) = ANY($3))',
          v_col.attname)
        USING v_principal, v_dup.id, v_placeholders;
      END LOOP;

      -- repontar todos os vínculos (linha a linha, removendo o que colidir com chave única)
      FOR v_tab IN
        SELECT c.conrelid::regclass::text AS tab, a.attname AS col
        FROM pg_constraint c
        JOIN unnest(c.conkey) k ON true
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
        WHERE c.contype = 'f'
          AND c.confrelid = 'public.processos'::regclass
          AND c.conrelid <> 'public.processos_coordenacoes_responsaveis'::regclass
      LOOP
        FOR v_ctid IN EXECUTE format('SELECT ctid FROM %s WHERE %I = $1', v_tab.tab, v_tab.col) USING v_dup.id
        LOOP
          BEGIN
            EXECUTE format('UPDATE %s SET %I = $1 WHERE ctid = $2', v_tab.tab, v_tab.col) USING v_principal, v_ctid;
          EXCEPTION WHEN unique_violation THEN
            EXECUTE format('DELETE FROM %s WHERE ctid = $1', v_tab.tab) USING v_ctid;
          END;
        END LOOP;
      END LOOP;

      DELETE FROM public.processos_coordenacoes_responsaveis WHERE processo_id = v_dup.id;
      DELETE FROM public.processos WHERE id = v_dup.id;
      v_removidos := v_removidos + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('grupos', v_grupos, 'removidos', v_removidos, 'coordenacoes_migradas', v_coords);
END;
$fn$;

REVOKE ALL ON FUNCTION public.merge_processos_duplicados() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_processos_duplicados() TO service_role;

-- 4. Executar a unificação
DO $$
DECLARE r jsonb;
BEGIN
  r := public.merge_processos_duplicados();
  RAISE NOTICE 'merge_processos_duplicados: %', r;
END $$;

-- 5. Unicidade passa a ser pelos dígitos do número
CREATE UNIQUE INDEX IF NOT EXISTS processos_numero_digits_uidx
  ON public.processos ((regexp_replace(coalesce(numero,''),'\D','','g')))
  WHERE numero IS NOT NULL AND numero <> '';
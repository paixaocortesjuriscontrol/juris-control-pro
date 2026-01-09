-- Função para contar tarefas urgentes de uma coordenação (próximos 7 dias)
-- Usa SECURITY DEFINER para bypassar RLS e garantir contagem correta
CREATE OR REPLACE FUNCTION count_tarefas_urgentes_coordenacao(p_coordenacao_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_hoje DATE;
  v_sete_dias DATE;
BEGIN
  v_hoje := CURRENT_DATE;
  v_sete_dias := v_hoje + INTERVAL '7 days';
  
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM tarefas t
  INNER JOIN processos p ON t.processo_id = p.id
  WHERE p.coordenacao_id = p_coordenacao_id
    AND t.status = 'pendente'
    AND t.data_vencimento >= v_hoje
    AND t.data_vencimento <= v_sete_dias;
  
  RETURN COALESCE(v_count, 0);
END;
$$;
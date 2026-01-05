-- Índices para melhorar performance do dashboard

-- Índice para contagem por status
CREATE INDEX IF NOT EXISTS idx_processos_status ON public.processos(status);

-- Índice para contagem de processos sem coordenação
CREATE INDEX IF NOT EXISTS idx_processos_coordenacao_id_null ON public.processos(coordenacao_id) WHERE coordenacao_id IS NULL;

-- Índice para contagem de processos distribuídos
CREATE INDEX IF NOT EXISTS idx_processos_advogado_responsavel_null ON public.processos(advogado_responsavel_id) WHERE advogado_responsavel_id IS NULL;

-- Índice para prazos pendentes por data
CREATE INDEX IF NOT EXISTS idx_prazos_pendentes_data ON public.prazos(data_vencimento) WHERE status = 'pendente';

-- Índice para movimentações recentes
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data_desc ON public.movimentacoes(data_movimentacao DESC);

-- Função RPC otimizada para estatísticas do dashboard
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_processos INTEGER;
  v_processos_ativos INTEGER;
  v_processos_distribuidos INTEGER;
  v_processos_sem_coordenacao INTEGER;
  v_prazos_urgentes INTEGER;
  v_total_advogados INTEGER;
  v_total_coordenacoes INTEGER;
  v_status_ativo INTEGER;
  v_status_pendente INTEGER;
  v_status_urgente INTEGER;
  v_status_encerrado INTEGER;
  v_status_arquivado INTEGER;
  v_data_limite DATE;
BEGIN
  -- Data limite para prazos urgentes (7 dias)
  v_data_limite := CURRENT_DATE + INTERVAL '7 days';

  -- Contagens agregadas em uma única passagem
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('ativo', 'urgente', 'pendente')),
    COUNT(*) FILTER (WHERE advogado_responsavel_id IS NOT NULL),
    COUNT(*) FILTER (WHERE coordenacao_id IS NULL),
    COUNT(*) FILTER (WHERE status = 'ativo'),
    COUNT(*) FILTER (WHERE status = 'pendente'),
    COUNT(*) FILTER (WHERE status = 'urgente'),
    COUNT(*) FILTER (WHERE status = 'encerrado'),
    COUNT(*) FILTER (WHERE status = 'arquivado')
  INTO 
    v_total_processos,
    v_processos_ativos,
    v_processos_distribuidos,
    v_processos_sem_coordenacao,
    v_status_ativo,
    v_status_pendente,
    v_status_urgente,
    v_status_encerrado,
    v_status_arquivado
  FROM processos;

  -- Prazos urgentes
  SELECT COUNT(*)
  INTO v_prazos_urgentes
  FROM prazos
  WHERE status = 'pendente' 
    AND data_vencimento IS NOT NULL 
    AND data_vencimento <= v_data_limite;

  -- Totais auxiliares
  SELECT COUNT(*) INTO v_total_advogados FROM profiles;
  SELECT COUNT(*) INTO v_total_coordenacoes FROM coordenacoes;

  RETURN json_build_object(
    'totalProcessos', v_total_processos,
    'processosAtivos', v_processos_ativos,
    'processosDistribuidos', v_processos_distribuidos,
    'processosSemCoordenacao', v_processos_sem_coordenacao,
    'statusCount', json_build_object(
      'ativo', v_status_ativo,
      'pendente', v_status_pendente,
      'urgente', v_status_urgente,
      'encerrado', v_status_encerrado,
      'arquivado', v_status_arquivado
    ),
    'prazosUrgentes', v_prazos_urgentes,
    'totalAdvogados', v_total_advogados,
    'totalCoordenacoes', v_total_coordenacoes
  );
END;
$$;
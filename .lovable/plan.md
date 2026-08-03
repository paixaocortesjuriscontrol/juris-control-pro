# Processo 0193900-65.2004.5.02.0053 — por que a Judit não marca trânsito

## O que os dados mostram (verificado)

Consultei os logs da Judit desse processo (`judit_logs`, 4 consultas hoje, todas `sucesso`) e abri as movimentações das 2 instâncias devolvidas. Resultado:

- Nenhum step com código CNJ `848`.
- Nenhum step com o texto "trânsito/transitado/transitou em julgado".
- Nenhum step "Remetidos os autos para Tribunal Regional do Trabalho".
- O movimento mais recente é `ARQUIVADOS OS AUTOS DEFINITIVAMENTE` (14/07/2026, 1ª instância), e a fase da Judit é `ARQUIVADO`.
- A resposta gravou `situacao_processo = "Arquivado"`, `processo_baixado = "S"`, `transito_julgado_detectado = false`, `motivo_transito = null`.

Ou seja: diferente do caso 0191985-64.2001.5.12.0034 (onde havia certidão 848 e o sistema lia o campo errado), aqui **a Judit não devolve nenhuma certidão de trânsito**. As três regras de detecção hoje vigentes não têm em que se apoiar, então o `false` é o comportamento esperado do código atual — o único dado disponível é o arquivamento definitivo.

## Correção proposta

Tratar arquivamento definitivo como trânsito, com motivo próprio para deixar claro que é inferência e não certidão:

- Em `supabase/functions/buscar-judit/index.ts`, acrescentar à detecção o motivo `arquivamento_definitivo`, reconhecido por:
  - texto "ARQUIVADOS OS AUTOS DEFINITIVAMENTE" / "ARQUIVAMENTO DEFINITIVO" / "BAIXA DEFINITIVA"; ou
  - código CNJ `246` acompanhado de texto de arquivamento.
- Prioridade: certidão real (`848` / texto de trânsito) continua vencendo. O arquivamento definitivo só é usado quando nenhuma certidão existe, e a data do trânsito passa a ser a data do próprio arquivamento.
- Manter intacta a regra de reativação posterior: se depois do arquivamento houver redistribuição, novo recurso ou inclusão em pauta, o processo volta a Ativo e o trânsito é descartado.
- Não alterar nada na atribuição de recorrente, partes, relator ou turma.

## Verificação

- Reconsultar 0193900-65.2004.5.02.0053 com "Forçar atualização" e confirmar `transito_julgado_detectado = true`, `motivo_transito = arquivamento_definitivo` e data 14/07/2026.
- Reconsultar 0191985-64.2001.5.12.0034 e confirmar que continua com motivo `movimento_848` e data 15/05/2026 (sem regressão).
- Conferir nos novos registros de `judit_logs` que os campos vieram preenchidos.
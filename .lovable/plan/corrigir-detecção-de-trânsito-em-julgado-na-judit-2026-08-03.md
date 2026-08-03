# Corrigir detecção de trânsito em julgado na Judit

## Diagnóstico (confirmado nos dados)

O log da consulta Judit desse processo (`judit_logs`, 03/08 14:54, status `sucesso`) traz a movimentação:

```text
step_type: "848"
content : "TRANSITADO EM JULGADO EM 15.05.2026"
step_date: 2026-07-02
```

E, ainda assim, a resposta gravou `transito_julgado_detectado = false`, `motivo_transito = null`, `data_transito_julgado_detectada = null` (a situação veio como "Arquivado" apenas pela `phase`).

Motivo: a função `detectarTransitoJulgado` em `buscar-judit` falha nos dois testes que deveriam pegar esse caso:

1. Código CNJ — o teste lê `step.code`, mas a Judit devolve o código em `step_type`. Como `code` não existe, o `848` nunca é reconhecido.
2. Texto — o regex exige a palavra "trânsito"/"transito em julgado". O texto real é "TRANSITADO EM JULGADO", que não casa com o padrão.

Ou seja, não é limitação da Judit: o dado está na resposta e o sistema deixa passar. Isso afeta todos os processos cuja certidão aparece como "TRANSITADO EM JULGADO ..." ou apenas com código 848.

## Correção proposta

Em `supabase/functions/buscar-judit/index.ts`, na detecção de trânsito:

- Ler o código do movimento também de `step_type` (além de `code`, `movement_code`), tratando como string numérica; manter `848` como trânsito confirmado.
- Ampliar o regex de texto para cobrir "TRANSITADO EM JULGADO", "TRANSITOU EM JULGADO" e "CERTIDÃO DE TRÂNSITO EM JULGADO", além da forma atual.
- Aproveitar a data escrita no próprio texto ("EM 15.05.2026") quando presente, em vez de usar somente `step_date` — o `step_date` (02/07/2026) é a data de captura/registro, não a data real do trânsito (15/05/2026).
- Manter intacta a regra de reativação posterior (redistribuição, novo recurso, inclusão em pauta continuam derrubando o trânsito).

## Verificação

- Reconsultar o processo 0191985-64.2001.5.12.0034 (Dossiê 07.02.008.0000370227/01) com "Forçar atualização" e confirmar `transito_julgado_detectado = true`, motivo `movimento_848` e data 15/05/2026.
- Conferir no log da nova consulta em `judit_logs` que os campos vieram preenchidos.

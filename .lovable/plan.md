# Publicação 0001439-68.2026.5.18.0241 — parte "UNIAO QUIMICA" TRT18

## Diagnóstico (confirmado no banco)

- Monitoramento da coord. Dra. Beatriz Costa: `9b41a6c8-25ce-4a00-aec8-0526d73db309`, `tipo=parte`, `termo_busca=UNIAO QUIMICA`, `tribunais` contém TRT1..TRT24, `ativo=true`, `arquivado=false`, `condicao_concomitante=null`, `exclusoes=[]`.
- A publicação foi disponibilizada no TRT18 em 22/07 e capturada 3× via **Kurier** (em outras coordenações que usam `__CAPTURA_TOTAL_KURIER__`) — a coord. da Dra. Beatriz não tem Kurier ativo.
- No motor DJEN Paralela Servidor (fonte esperada para essa busca por parte), verifiquei `publicacoes_djen_servidor` do monitoramento `9b41a6c8…` entre 20-23/07: só apareceram publicações de **TRT2, TRT3, TRT4 e TRT10**. **TRT18 nunca foi consultado** para esse monitoramento, apesar de estar na lista `tribunais`.
- No mesmo período, o motor processou TRT18 normalmente para outros 11 monitoramentos, então TRT18 não está desabilitado globalmente.
- Não há registro em `execucoes_servidor_falhas` para esse monitoramento.
- `partes_json`/`advogados_json` das cópias capturadas por Kurier estão vazios (Kurier não parseia metadados estruturados), o que é esperado e não impede validação da paralela (que usa os metadados vindos direto da API DJEN).

Conclusão: o problema não é validação/exclusão nem termo — é o motor paralela **parando de iterar os tribunais** desse monitoramento antes de chegar em TRT18 (a lista com 24 TRTs é longa e a iteração aparentemente é abortada por limite de tempo/página/lote por rodada, sem registrar falha).

## Plano

1. **Auditoria do loop de tribunais em `monitor-servidor/engines/paralela.js`**
   - Confirmar como o motor distribui/itera `mon.tribunais` por rodada: se há corte por tempo total, por número de páginas por rodada ou por `MAX_TRIBUNAIS_POR_MON` implícito.
   - Verificar ordem de iteração (fixa? aleatória?) — a evidência mostra que só os 4 primeiros TRTs foram processados, sugerindo ordem sequencial + corte precoce.
   - Verificar se há checkpoint para continuar de onde parou na próxima rodada (não há: a rodada seguinte também só cobriu TRT2/3/4/10).

2. **Correção do motor paralela**
   - Registrar em `execucoes_servidor_falhas` (ou log estruturado da execução) todo tribunal do monitoramento que foi **pulado** por corte de tempo/páginas, com motivo, para diagnóstico futuro.
   - Persistir checkpoint por monitoramento (último tribunal processado) e continuar do próximo TRT na rodada seguinte, evitando que sempre os últimos TRTs da lista fiquem de fora.
   - Alternativa: embaralhar a ordem de tribunais por rodada, garantindo cobertura estatística.
   - Não alterar regra de validação por parte (já correta: `nomeParte` + validação em `partes_json`/seção Partes).

3. **Resgate manual da publicação da Dra. Beatriz**
   - Reprocessar a publicação existente (`60a544ff-b1f9-4a49-9ff6-eae0d599e127` / `a0b9b8da…` / `461fbb5c…`) contra o monitoramento `9b41a6c8…` para inserir uma cópia em `publicacoes_djen` com `coordenacao_id=d997ca10…` e `monitoramento_id=9b41a6c8…`, respeitando dedup e o padrão de "cross-coordination rescue" já existente. Isso torna a publicação visível na Análise DJEN da coord. da Dra. Beatriz sem esperar a próxima rodada.

4. **Verificação**
   - Rodar a paralela manualmente para o monitoramento `9b41a6c8…` restrito a TRT18 no dia 22/07 e confirmar que a publicação é encontrada e gravada normalmente.
   - Checar que a nova telemetria de "tribunal pulado" aparece nos logs quando o corte ocorrer.

## Detalhes técnicos

- Arquivo principal: `monitor-servidor/engines/paralela.js` (iteração `for tribunal of mon.tribunais`, chamada `buscarPagina({ ...baseParams, nomeParte })`).
- Tabelas: `publicacoes_djen`, `publicacoes_djen_servidor`, `execucoes_servidor`, `execucoes_servidor_falhas`, `monitoramentos_djen`.
- Migração: adicionar coluna `checkpoint_tribunal` em `monitoramentos_djen` (ou tabela auxiliar `djen_paralela_checkpoints`) se optarmos pela abordagem de checkpoint.
- Regras de validação de parte permanecem intactas (memória `djen-paralela-parte-sem-palavra-chave`, `djen-content-validation-logic`).
- Nenhum secret novo necessário.

# Processo 0193900-65.2004.5.02.0053 — trânsito do TST não chega ao sistema

## O que os dados mostram (verificado nos logs)

A Dra. Lienne está certa: o trânsito está no andamento do **TST** ("Transitado em Julgado em 07/02/2025", e em 12/02/2025 "Remetidos os Autos para o TRT da 2ª Região"). Nas 4 consultas de hoje em `judit_logs` (todas `sucesso`, duas delas com "Forçar atualização"), a Judit devolveu **apenas as instâncias do TRT2**:

```text
página 1 → TRT2, instância 2, 74 steps  (fonte: PJE - TRT - SP ... 2 instance)
página 2 → TRT2, instância 1, 210 steps (fonte: PJE - TRT - SP ... 1 instance)
```

`_judit_meta` confirma: `tribunal_selecionado = TRT2`, `fonte = fallback_outra_instancia`, mesmo com `tribunal: "TST"` no pedido e `force_refresh: true`. Nenhuma página do TST veio (as respostas do crawler vieram marcadas como `cached: true`).

Nos steps que chegaram não existe nenhum `848` nem texto de trânsito. O mais próximo é o par do TRT2: "REMETIDOS OS AUTOS PARA ÓRGÃO JURISDICIONAL COMPETENTE PARA PROSSEGUIR" e "RECEBIDOS OS AUTOS PARA PROSSEGUIR" (13/02/2025) — exatamente a contrapartida da remessa do TST, mas com texto que a regra atual não reconhece (ela só cobre "Remetidos os autos para Tribunal Regional do Trabalho"). Depois há "ARQUIVADOS OS AUTOS DEFINITIVAMENTE" (14/07/2026) e a fase da Judit é `ARQUIVADO`.

Ou seja, são duas falhas somadas: **a instância TST não é buscada/aproveitada** e, sem ela, **nenhum sinal indireto do TRT é aceito**.

## Correção proposta

Em `supabase/functions/buscar-judit/index.ts`:

1. Garantir a instância TST na consulta
   - Quando o pedido vem com `tribunal: "TST"` e o crawler só devolve instâncias do TRT, disparar uma busca adicional dirigida ao TST (crawler com TTL 0 e sem cache) antes de responder, em vez de cair direto no `fallback_outra_instancia`.
   - Incluir todas as páginas obtidas nessa segunda tentativa no conjunto analisado para trânsito (hoje só entram as páginas da primeira resposta).
   - Registrar no `_judit_meta` que houve retentativa TST e se ela trouxe steps, para auditoria.

2. Ampliar os sinais de trânsito reconhecidos (usados só quando não há certidão)
   - "Recebidos os autos para prosseguir" / "Remetidos os autos para órgão jurisdicional competente" partindo de instância superior — mesma semântica do "remessa_trt" já homologado.
   - "Arquivados os autos definitivamente" / "arquivamento definitivo" / "baixa definitiva", como motivo próprio `arquivamento_definitivo`.
   - A certidão real (`848` ou texto "transitado/trânsito em julgado") continua tendo prioridade absoluta, e a data preferida segue sendo a escrita no texto da certidão.

3. Manter intacta a regra de reativação posterior (redistribuição, novo recurso, inclusão em pauta derrubam o trânsito) e não mexer em partes, relator, turma ou recorrente.

## Verificação

- Reconsultar 0193900-65.2004.5.02.0053 com "Forçar atualização" e confirmar no novo registro de `judit_logs` que apareceu página do TST e que `transito_julgado_detectado = true` com data 07/02/2025 (certidão do TST) — ou, se o TST realmente não vier da Judit, com o motivo indireto e a data de 12–13/02/2025.
- Reconsultar 0191985-64.2001.5.12.0034 e confirmar que segue com motivo `movimento_848` e data 15/05/2026 (sem regressão).
- Conferir em `_judit_meta` qual instância foi usada e se a retentativa TST ocorreu.
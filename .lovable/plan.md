# Botão Judit na Distribuição TST — diagnóstico revisado

Você está certo, e o plano não diz o contrário: **a tela sempre pede TST** (`tribunal: "TST"` em toda consulta). O problema está na **resposta**: cada processo trabalhista tem várias instâncias na Judit sob o mesmo número CNJ (a de origem, no TRT, e a do TST). A tela pede TST, mas a função devolve a instância do TRT do mesmo processo — e com dado de TRT ela não pode preencher tipo de recurso, relator e turma do TST.

## O que foi verificado

**1. Os registros que a Kellen marcou como "problema Judit" têm sempre o mesmo perfil.**
Consultei `dados_benner` onde `problema_judit = true`: nesses processos há relator e turma (vindos da planilha), mas **`tipo_recurso` está nulo** em praticamente todos — inclusive os que estão com `judit_preenchido = true`. Exemplos dela: 1001927-21.2024.5.02.0435 (4ª Turma, sem tipo de recurso), 1000940-55.2023.5.02.0035 (1ª Turma, sem tipo de recurso), 0010737-94.2024.5.18.0131, 0010514-89.2024.5.15.0143, 0010386-22.2024.5.15.0094. Ou seja, "não preenche completamente" = **tipo de recurso (e situação) não vêm**.

**2. O log mostra por que o tipo de recurso não vem.**
Em `judit_logs`, os cliques dela com sucesso voltam com `_judit_meta.tribunal_selecionado = TRT2 / TRT15 / TRT3` e `instancia_tst: false`. No caso 1000940-55.2023.5.02.0035 (27/08 18:43) o meta é explícito: `fonte: "cache_instant"`, `instancia_tst: false`, `fonte_tipo_recurso: "classe_nao_recursal_ignorada"`.
No código de `buscar-judit`, `tipo_recurso` só é preenchido quando a instância selecionada é TST (`classeRecursal = foiTst ? classe : null`). Como a instância escolhida foi a do TRT, o campo sai nulo **por regra** — não é falha da Judit.

**3. A instância TST só é buscada quando se clica em "Forçar atualização".**
Três camadas conspiram para devolver o TRT no clique normal:
- `cacheUsavel` (linhas ~818-836) aceita o cache de qualquer instância desde que tenha partes e algum sinal, mesmo com `tribunal: "TST"` no pedido — e responde na hora sem consultar o crawler, que é quem traz todas as instâncias (incluindo TST).
- `juditAppCache` (linhas ~157-171) reaproveita respostas anteriores de TRT gravadas em `judit_logs`, apenas marcando `_instancia_tst: false` — congelando o processo no dado incompleto por 3 dias.
- A retentativa dirigida ao TST (`retentativaTst`, linha ~874) está condicionada a `forceRefresh === true`.
Comprovação no mesmo processo 1002068-91.2023.5.02.0203, em 28/08: clique normal às 20:13:48 → cache TRT2, relator/turma/tipo de recurso nulos; clique com "Forçar atualização" às 20:14:22 → relator, 6ª Turma e "Agravo de Instrumento" preenchidos.

**4. "Às vezes não funciona" são dois erros distintos, também no log.**
- `Failed to send a request to the Edge Function` — a função não respondeu no tempo do navegador (Kellen 1 vez; no escritório 39 vezes em 30 dias). Coerente com o orçamento de 25-30s do crawler.
- `Judit não retornou dados para este processo` — 17 vezes com a Kellen (ex.: 1000352-38.2016.5.02.0053, três cliques seguidos em 26/08, às 00:40). Nesses logs `_judit_meta` vem nulo: não houve cache nem página do crawler.

## Correção proposta

**A. Para pedido `tribunal: "TST"`, resposta de instância não-TST não encerra a consulta.**
Em `buscar-judit`: quando `tribunalHint === "TST"`, o cache-first passa a valer **somente** se o cache é da instância TST. Se o cache é do TRT, ele é guardado (serve para partes de origem e detecção de trânsito) e a função segue para o crawler, que agrega todas as instâncias e usa `selecionarTst` — sem exigir clique em "Forçar atualização".

**B. Retentativa dirigida ao TST no clique normal.**
Soltar a retentativa da condição `forceRefresh`: se depois do crawler nenhuma página é TST e ainda há orçamento de tempo, refaz uma vez com `cache_ttl_in_days=0`. Mantida a proteção de orçamento para não estourar o tempo do clique.

**C. App-cache não pode servir TRT quando se pede TST.**
Em `juditAppCache`, descartar respostas cujo `tribunal` não é TST quando `tribunalHint === "TST"`, em vez de devolvê-las marcadas como `_instancia_tst: false`. Isso remove o congelamento de 3 dias no dado incompleto.

**D. Orçamento de tempo maior e sem erro de rede seco.**
Elevar `POLL_TIMEOUT_MS`/`REQUEST_BUDGET_MS` o suficiente para a instância TST (crawler TST leva 8-25s, e a retentativa soma outra rodada), e no cliente repetir uma vez automaticamente quando o erro for de rede/timeout (`Failed to send a request to the Edge Function`), em vez de mostrar erro no primeiro tropeço.

**E. Aviso honesto quando a instância TST realmente não existir.**
Se após crawler + retentativa nenhuma instância TST aparecer, exibir alerta fixo no formulário: "A Judit ainda não tem a instância TST deste processo — tipo de recurso e situação não podem ser preenchidos automaticamente", com o botão "Forçar atualização" ao lado. Assim a advogada distingue "Judit incompleta" de "botão falhou", e o `problema_judit` passa a ser marcado com informação.

**F. Log com autoria e duração.**
O insert em `judit_logs` feito por esta tela não grava `user_email`, `origem`, `duracao_ms` nem `tipo_cobranca` (1009 registros com esses campos nulos, atribuíveis só via `created_by`). Passar a usar `logJudit` de `src/lib/juditLog.ts` com `origem: "distribuicao-tst"`, registrando também se houve retentativa TST — permite medir no /consumo-judit quantos cliques ficam incompletos e quanto tempo levam.

## Detalhes técnicos

- `supabase/functions/buscar-judit/index.ts`: condicionar `cacheUsavel` a `isTstRd(cached)` quando `tribunalHint === "TST"`; remover a exceção de `juditAppCache` (linhas 169-171); retirar `forceRefresh` da guarda da retentativa TST (linha ~874) mantendo `orcamentoRestante`; ajustar `POLL_TIMEOUT_MS` e `REQUEST_BUDGET_MS`; expor em `_judit_meta` um campo `tst_indisponivel` para a UI.
- `src/components/distribuicao-tst/DistribuicaoTstForm.tsx`: retry único em erro de rede; alerta persistente de instância TST indisponível; trocar o insert manual de `judit_logs` (linhas ~710-723) por `logJudit`.
- Sem alteração de schema.
- Custo: o clique normal passa a poder disparar crawler em processos cujo cache é só TRT. Como `com_anexos` continua `false` e o TTL padrão de 3 dias é mantido na primeira rodada, o custo fica na faixa datalake/on-demand — e substitui o duplo clique (normal + forçar) que a advogada faz hoje, que já cobrava duas consultas.

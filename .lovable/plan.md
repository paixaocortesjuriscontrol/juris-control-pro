

# Eliminar perdas no DJEN Termos Flash sem virar um "Pro lento"

## Diagnóstico da perda

A publicação que o Pro pegou e o Flash não pegou é do monitoramento `OSMAR MENDES` (OAB 21572, **UF=TODAS**, 25 tribunais TST+TRTs). O processo `0020298-14.2024.5.04.0332` está no **TRT4**.

Comparando os dois engines linha a linha, a perda vem de **3 otimizações do Flash que sacrificam cobertura por velocidade**:

1. **Busca global única para UF=TODAS** (Flash linha 815-834): em vez de 25 chamadas (1 por tribunal), faz 1 chamada sem `siglaTribunal` e filtra localmente. Quando a API PJE devolve a página com truncagem ou simplesmente omite resultados de um TRT específico (comportamento conhecido da API), o tribunal inteiro fica "invisível".
2. **Paginação para no primeiro indício de fim** (`continueUntilEmpty: false`, linha 715): se a primeira página vier "parecendo cheia" mas o `totalExpected` falhar, o Flash não confirma com mais uma página. O Pro sempre confirma (`continueUntilEmpty: true`).
3. **Circuit breaker pula tribunais após 3 hits 429** (linhas 682-695): sob pressão, tribunais inteiros são abandonados sem nova tentativa.

## Solução: cobertura sem inflar o número de chamadas

### Mudança 1 — Busca global UF=TODAS vira **híbrida com fallback automático**
- Mantém a chamada global única (rápida) como **primeira tentativa**.
- Para cada tribunal configurado que **não apareceu** no retorno global, faz **1 chamada por tribunal** apenas naqueles ausentes.
- Em condição normal (API saudável), continua sendo 1 chamada (todos os TRTs aparecem na global).
- Quando a API omite um TRT, o fallback resgata só aquele, sem multiplicar tudo por 25.

### Mudança 2 — Confirmar fim de paginação só quando há ambiguidade
- Hoje: `continueUntilEmpty: false` — pode parar cedo.
- Novo: ativar `continueUntilEmpty: true` **somente quando** a última página retornou `pageSize` itens e o servidor não enviou `totalExpected`/`hasMore=false`. Casos tranquilos (página com poucos itens) continuam parando imediatamente.
- Custo médio: +0,2 página por busca (irrelevante).

### Mudança 3 — Circuit breaker vira **soft-skip com retry no fim**
- Em vez de abandonar tribunais após 3 hits 429, marca-os para **reexecução no fim do termo**, com delay reforçado.
- Garantia: nenhum tribunal é definitivamente pulado; só é adiado para quando a janela de pressão da API passou.

### Mudança 4 — Telemetria de paridade Flash×Pro
- Cada execução Flash registra: `tribunaisResgatadosFallback`, `tribunaisRetomadosCircuit`, `paginasConfirmadas`. Se chegar a zero por várias execuções, sabemos que as garantias raramente custam algo.

## Resposta direta sobre velocidade

**Não vai ficar lento como o Pro.** O Pro hoje sofre porque ele faz **sempre** 1 chamada por tribunal (25× para UF=TODAS) **e** confirma fim de paginação **e** não tem circuit breaker. As mudanças propostas mantêm o Flash em **1 chamada por monitoramento UF=TODAS no caminho normal**, e só pagam o custo extra quando há sinal real de perda. Estimativa para os ~236 termos atuais:

| Cenário | Chamadas estimadas | Tempo total |
|---|---|---|
| Flash atual (perde publicações) | ~280 | ~6-8 min |
| Flash novo (cobertura total) | ~310 (+10%) | ~7-9 min |
| Pro atual | ~1.800 | 30-50 min |

## Arquivos afetados

- `src/hooks/useDjenTermosFlashEngine.ts` — lógica híbrida UF=TODAS, ativação condicional de `continueUntilEmpty`, soft-skip do circuit breaker, novos campos de telemetria.
- `src/utils/pjeComunicaClientFlash.ts` — pequeno ajuste para expor sinal "página cheia sem totalExpected" ao engine.
- Componente do card "DJEN Termos Flash" (a localizar) — mostrar nova telemetria de cobertura.

## Validação após deploy

Reexecutar o mesmo dia (23/04) só com o monitoramento `OSMAR MENDES` (id `6c5edcf1`) no Flash. A publicação `74461448-4414-48e5-b2b2-3031fe94f5b5` (TRT4) deve aparecer. Comparar contagem total Flash×Pro: deve ficar idêntica.


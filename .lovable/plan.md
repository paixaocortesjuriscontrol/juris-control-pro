# Card "Pronto sem pendência" x lista: alinhar o que é exibido

## O que foi verificado

O processo da sua tela (`0000990-31.2024.5.05.0019`, dossiê `07.02.033.0004198925/24`) está no banco com:

- `status = rascunho` (não é "pronto para enviar")
- `data_distribuicao_real`, reclamante, reclamada, relator, parte recorrente e matéria de honra vazios
- `em_analise = true`, `subida_em_massa = true`, `problema_judit = true`

Ou seja: as 11 pendências mostradas na linha estão corretas. O erro é ele **aparecer na lista** quando o card "Pronto sem pendência" está acionado, porque o card só considera registros com `status = pronto_envio`.

Ainda não está confirmado qual dos caminhos coloca essa linha na lista, então o primeiro passo do trabalho é identificá-lo antes de mexer na regra.

## Causas candidatas (a confirmar)

1. **Linha "fixada" (sticky):** o último registro aberto/salvo é sempre reinserido no topo da lista, mesmo quando não bate com o filtro atual. Isso faz um rascunho cheio de pendências aparecer junto dos "prontos sem pendência".
2. **Segundo clique no card:** clicar no card que já está ativo desliga o filtro e volta a listar tudo — visualmente parece que o card "abriu" a lista errada.
3. **Falha parcial na carga em lotes:** a lista busca os IDs permitidos em blocos; se um bloco falhar/retornar em ordem diferente, linhas fora do conjunto podem entrar.

## Correções previstas

- Diagnóstico: instrumentar temporariamente a tela para registrar, no clique do card, quantos IDs o card entregou e quais IDs a lista recebeu/renderizou; comparar com o ID do processo do exemplo. Isso aponta a causa em uma execução.
- Quando o card "Pronto sem pendência" (ou qualquer filtro por conjunto de IDs) estiver ativo, **não** reinserir a linha fixada que não pertence ao conjunto — o destaque do registro recém-salvo continua valendo apenas quando ele bate com o filtro.
- Filtro final de segurança na renderização: com o card ativo, descartar qualquer linha cujo ID não esteja no conjunto calculado, e sinalizar erro claro caso um lote de carga falhe (em vez de mostrar resultado incompleto/errado).
- Deixar o card explicitamente "ligado/desligado" com rótulo de filtro ativo, para que o segundo clique não pareça um resultado inconsistente.
- Alinhar os rótulos: hoje a lista trata só "outro escritório" e "segredo de justiça" como "Não precisa fazer", enquanto o card também isenta CEJUSC, Acordo e Trânsito em Julgado. Passar a usar a mesma regra nas duas partes.

## Detalhes técnicos

- Card: `src/hooks/useProntoSemPendenciaCount.ts` (pagina `dados_benner` com `status = pronto_envio` e cruza com `fetchAllDistribuicaoTstIds`).
- Lista: `src/hooks/useDistribuicoesTst.ts` — bloco `stickyId` (linhas ~996-1005) e carga em chunks de 200 IDs (`chunkSource`).
- Tela: `src/pages/DistribuicaoTst.tsx` — `listFilters` (idsAllowed), `handleCardClick`/`activeCardKey` e a célula de badges de pendências (~2869).
- Regra de pendência compartilhada: `src/utils/distribuicaoTstPendencias.ts` (sem alteração das regras de negócio, apenas uso consistente das isenções).

## Objetivo

Remover a trava entre bandas no DJEN Browser (`useDjenTermosParalelaEngine.ts`), aplicando a mesma estratégia já validada no DJEN Servidor (`monitor-servidor/engines/paralela.js`, linhas 1281–1298). Hoje o STJ (banda 1) executa sozinho enquanto a VPS Hostinger fica ociosa porque a banda 2 (TRF3/TRF6/etc.) está bloqueada até a banda 1 esvaziar por completo.

## O que mudar

Arquivo: `src/hooks/useDjenTermosParalelaEngine.ts`

1. `pickNextUnit` (linhas 2256–2264): trocar a lógica "só avança quando banda atual drena" por "pega a unidade da banda de maior prioridade que tiver itens". Sem espera entre bandas.

   ```ts
   const pickNextUnit = (): WorkUnit | null => {
     for (let b = 0; b < bands.length; b++) {
       if (bands[b].length > 0) {
         bandAtual = b; // só para fins de label/progresso
         return bands[b].shift()!;
       }
     }
     return null;
   };
   ```

2. Loop do worker (linhas 2272–2281): remover o `if (bandAtual < bands.length && emProcessamentoPorBand[bandAtual] > 0) { await sleep(500); continue; }`. Se `pickNextUnit` retornar `null`, verificar se **qualquer** banda ainda tem unidades em processamento (`emProcessamentoPorBand.some(n => n > 0)`); se sim, aguardar 500 ms e tentar de novo; se não, encerrar.

3. Manter `emProcessamentoPorBand[unit.band]++/--` apenas para diagnóstico/progresso — não usar mais como gate de despacho.

Nenhuma outra mudança: prioridade continua sendo respeitada (STF/STJ continuam sendo escolhidos antes de TRFs/TJs sempre que houver unidade pendente), mas qualquer worker ocioso pode pegar imediatamente da próxima banda em vez de ficar parado.

## Validação

- Rodar uma execução do DJEN Browser com TST já concluído e STJ em curso: a segunda VPS deve começar imediatamente a processar TRF3/TRF6 em paralelo, sem "Aguardando slot…".
- Conferir que o card de progresso continua mostrando a banda correta da unidade em execução.
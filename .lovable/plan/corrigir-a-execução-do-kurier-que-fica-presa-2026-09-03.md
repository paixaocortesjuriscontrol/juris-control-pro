# Corrigir a execução do Kurier que fica presa

## Diagnóstico confirmado

A execução atual não está realmente avançando: começou às 16:47 BRT e teve a última atualização às 16:53 BRT, mas continua marcada como `executando`. O banco também contém execuções antigas no mesmo estado desde agosto.

A causa está no desenho atual de `executar-kurier-agendado`: uma única Edge Function inicia um trabalho em segundo plano que pode fazer até 200 chamadas por credencial. Quando o runtime encerra essa função longa, nenhuma rotina grava o erro ou a conclusão, e a interface continua exibindo indefinidamente a última mensagem — no caso, “Limite do servidor; retomando em 1×10...”. A chamada interna para `kurier-consultar-publicacoes` também não possui timeout próprio.

## Correção

1. **Transformar a execução em etapas curtas e retomáveis.** Cada invocação processará apenas um bloco limitado, salvará no banco qual credencial/lote deve continuar e encerrará normalmente.
2. **Encadear somente quando houver trabalho restante.** Após um pequeno intervalo, a próxima etapa será chamada apenas se a fila ainda não estiver vazia; `fila_vazia` passará a encerrar a credencial imediatamente.
3. **Adicionar trava de execução e orçamento de etapas.** Uma retomada não poderá correr em paralelo com outra, e cada cadeia terá limite de etapas; ao atingir o limite, ficará registrada como pausada/erro em vez de aparecer eternamente em execução.
4. **Controlar 546 sem ciclo agressivo.** Aplicar timeout à chamada interna, reduzir o lote após 546/503/504 e manter o tamanho reduzido para aquela credencial. Não voltar automaticamente para 4×50 depois de apenas três sucessos.
5. **Detectar e finalizar órfãs.** Na abertura do painel e antes de iniciar uma nova execução, qualquer execução sem atualização recente será marcada como interrompida, com mensagem clara e opção de retomar.
6. **Corrigir a execução já presa.** Finalizar o registro atual como interrompido, preservando os 926 recebidos, 492 novos e o progresso de cada login; uma retomada continuará somente o que falta.

## Validação

- Simular 546 e timeout e confirmar que há redução controlada, persistência do ponto atual e retomada.
- Confirmar que nenhuma execução permanece `executando` sem atualização.
- Confirmar que cancelamento e Force Kill interrompem toda a cadeia.
- Executar uma rodada real e acompanhar até `concluido`, verificando que os contadores não duplicam itens entre etapas.

## Detalhes técnicos

- `supabase/functions/executar-kurier-agendado/index.ts`: substituir o `waitUntil` de longa duração por hops limitados, com cursor persistido, lease, cooldown, orçamento de profundidade, timeout de `fetch` e próximo hop condicionado a trabalho restante.
- `supabase/functions/kurier-consultar-publicacoes/index.ts`: usar `fila_vazia` como sinal definitivo e manter cada chamada pequena e idempotente.
- `src/hooks/useDjenTermosKurierEngine.ts`: reconhecer heartbeat vencido e mostrar “Execução interrompida”, parando o cronômetro falso.
- Banco: adicionar operação atômica de lease/retomada para impedir duas etapas simultâneas da mesma execução; sem alterar dados de publicações.

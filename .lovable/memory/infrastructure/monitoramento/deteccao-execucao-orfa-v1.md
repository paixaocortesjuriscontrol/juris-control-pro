# Memory: infrastructure/monitoramento/deteccao-execucao-orfa-v1
Updated: 02/02/2026

## Detecção de Execução Órfã

O monitoramento DJEN Termos agora detecta automaticamente execuções "órfãs" - aquelas que travaram porque a aba do navegador foi fechada durante a execução.

### Critérios de Detecção

Uma execução é considerada órfã quando:
1. O engine local (singleton) NÃO está rodando (`isRunning = false`)
2. O banco de dados ainda mostra status `executando`
3. A execução foi iniciada há mais de **10 minutos** sem atualização

### Comportamento

Quando uma execução órfã é detectada:
1. O status do card muda para `timeout` (badge vermelha)
2. Um alerta visual é exibido explicando o problema
3. O usuário é orientado a clicar no botão "Caveira" (Forçar Cancelamento) para limpar o estado e poder reiniciar

### Causa Raiz

O motor DJEN Termos roda como singleton no navegador. Se a aba é fechada, a conexão cai, ou o browser congela, a execução para mas o status no banco não é atualizado automaticamente (não há como detectar fechamento de aba de forma confiável no JavaScript).

### Solução Aplicada

O componente `DjenTermosDashboardCardV2.tsx` calcula o tempo desde o início da execução e, se exceder o threshold de 10 minutos sem atividade do engine local, exibe o alerta de execução órfã com instruções claras para o usuário.

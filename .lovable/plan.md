# DJEN Servidor: barra em 100% enquanto a execução continua

## O que está acontecendo (conferido na execução de agora)
A rodada iniciada às 07:42 BRT (07/10 a 09/10) terminou os tribunais, e por isso a barra mostra 207/208 arredondado para 100%. Mas ela ainda não acabou: entrou na **drenagem final**, a última passada que repete as buscas que falharam antes, em geral por limite do PJE Comunica. Neste momento está em "DRENAGEM — LABORATIL FARMACÊUTICA (TJRS)".

A drenagem usa só uma VPS por vez, para não provocar novos bloqueios, e a barra não conta essa etapa. Por isso o relógio continua andando (92 min) com a barra cheia. A execução não travou, porque o heartbeat continua chegando.

## O que vou mudar
1. **Barra honesta:** a porcentagem fica no máximo em 99% enquanto a execução não termina de verdade. Ela só chega a 100% quando a rodada é finalizada.
2. **Etapa visível:** durante a drenagem, aparece abaixo da barra "Drenagem final: X de Y buscas repetidas" e o nome do termo e do tribunal que estão sendo repetidos.
3. **Tribunal que falta:** o texto 207/208 passa a mostrar qual tribunal ainda não terminou.

Não muda nada na coleta, nos dados nem nos horários do agendamento.

## Detalhes técnicos
- `DjenServidorParalelaCard.tsx`: `percentage = isRunning ? min(99, …) : …`; identificar tracks com `id` iniciando em `drain|` e calcular concluídas/total separadamente das tracks normais (excluí-las de `done/total`); exibir `progresso.atual.label`.
- O worker (`monitor-servidor/engines/paralela.js`) já grava as tracks `drain|…` no progresso via `flushProgresso`; nenhuma mudança no worker nem no banco.

# 🚀 DJEN Termos Paralela — Plano Aprovado

## Objetivo
Criar um terceiro motor totalmente separado chamado "DJEN Termos Paralela" que executa 5 tribunais em paralelo, com uma barra de progresso por tribunal ordenada (TST → STF → STJ → TRFs → TRTs → TJs). Não mexe no Pro, Flash nem STF Flash.

## Arquitetura
- Inversão da lógica: de `dia → termo → tribunal` (Pro) para `tribunal → (dia × termo)` (Paralela)
- Semáforo manual de concorrência = 5 tribunais simultâneos
- Ordem: TST → STF → STJ → TRF1..TRF6 → TRT1..TRT24 → TJxx (alfabético)
- Mantém cooldown global do PJE Comunica como guarda-rail anti-429
- 100% da lógica de validação/dedup/persistência reaproveitada do Pro

## Arquivos a criar
1. `src/hooks/useDjenTermosParalelaEngine.ts` — singleton derivado do Pro com loop invertido, TrackProgress por tribunal, semáforo de 5, checkpoint próprio (`djen_termos_paralela_checkpoint`)
2. `src/hooks/useDjenTermosParalela.ts` — wrapper React reativo
3. `src/components/configuracoes/MonitoramentoTermosParalelaCard.tsx` — card separado com lista de tracks (uma Progress por tribunal), cores por status, resumo agregado

## Arquivos a editar
4. `src/pages/TermosDjen.tsx` — botão "Executar Paralela" + render do novo card

## Migração SQL
5. Adicionar `'djen_paralela'` ao CHECK constraint de `execucoes_agendadas.tipo`

## Configuração
- Concorrência: 5 (fixo)
- Delay entre termos: 1500ms
- Delay entre páginas: 1200ms

## Critérios de aceitação
1. Card separado dos cards Pro e Flash em `/termos-djen`
2. Botão "Executar Paralela" não interfere em execuções Pro/Flash
3. Uma barra de progresso por tribunal na ordem TST→STF→STJ→TRFs→TRTs→TJs
4. Até 5 tribunais simultâneos; demais "Pendente"
5. Cancelar/retomar/forçar parada com checkpoint próprio
6. Mesmo formato de gravação do Pro (dedup via `get_djen_publicacoes_unificadas`)
7. Toast final com total agregado

## Fora de escopo
- Concorrência ajustável via UI (v2)
- Scheduler/cron automático para Paralela
- Remoção de qualquer motor existente
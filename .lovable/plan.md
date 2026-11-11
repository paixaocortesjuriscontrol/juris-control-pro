# Acelerar a importação de fluxos do Projuris

## O que está errado
Nada travou. A etapa "Localizando tarefas e processos migrados" procura dezenas de milhares de tarefas, 150 por vez e uma consulta depois da outra (centenas de consultas). Durante esse tempo a barra não anda, e parece que parou. A busca no banco é rápida (já existe índice); o tempo se perde na espera de cada ida e volta.

## O que muda
1. Fazer as buscas de tarefas, processos e fluxos já importados em vários pedidos ao mesmo tempo (6 simultâneos), com lotes um pouco maiores.
2. A barra e o texto passam a mostrar o avanço dentro de cada etapa (ex.: "Localizando tarefas: 12.000 de 30.000").
3. A gravação dos fluxos também usa 3 lotes simultâneos, mantendo a ordem: fluxo, etapas e registro para "Desfazer".
4. Pode recarregar e rodar de novo com segurança: os fluxos já gravados são pulados.

## Detalhes técnicos
- Em `ImportarExecucoesWorkflowProjuris.tsx`: `mapaChaves` e a busca de `tarefas.processo_id` passam a usar um pool de concorrência (6) com lote de 300 e um callback de progresso; o laço de gravação usa pool de 3 com contadores agregados.
- Sem mudança no banco.

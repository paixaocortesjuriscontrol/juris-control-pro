# Retirar Beatriz Costa de tarefas de outras coordenações

## O que será feito
Retirar a Beatriz Costa como envolvida ou responsável das tarefas destas coordenações:
- Execução GOL – Dra B. Anjos: 29
- Coordenação GOL: 9
- GOL – Norte e Nordeste: 4
- Santander Trabalhista: 3

Total: 45 tarefas. Ficam como estão: Coordenação Dr. Carlos Elias (10) e Coordenação Fernanda (10).

## Depois
- Conferir que sobrou 0 nessas 4 coordenações.
- O histórico de alterações registra cada retirada como "sistema".

## Detalhes técnicos
Comando de exclusão em `tarefa_envolvidos` e `tarefa_responsaveis`, filtrado pelo id da Beatriz Costa e pelos ids das 4 coordenações (`tarefas.coordenacao_id`).

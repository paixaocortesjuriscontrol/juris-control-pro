# Mover os processos da Dra. Beatriz Anjos da Coordenação GOL para a Execução GOL

## O que conferi
- Na Coordenação GOL, a Dra. Beatriz Anjos é a responsável principal em 1.842 processos.
- Em quase todos, há também outra pessoa como responsável.
- Esses processos têm 288 prazos e tarefas em aberto na Coordenação GOL.

## O que será feito
- Os 1.842 processos em que ela é a responsável principal passam para a "Execução GOL - Dra B. Anjos".
- A Coordenação GOL fica como coordenação responsável adicional nesses processos. Assim a equipe GOL continua vendo os processos e podendo trabalhar neles. Os responsáveis atuais não mudam.
- Os 288 prazos e tarefas em aberto passam para a Execução GOL. Os já concluídos ficam como estão, para manter o histórico e o ranking da GOL.
- Os processos em que ela é só responsável adicional continuam na Coordenação GOL e ganham a Execução GOL como segunda coordenação responsável. Assim ficam nas duas coordenações:
  - 0001839-93.2026.5.18.0011, sem responsável principal
  - 0000839-36.2026.5.23.0038, principal: Sarah Campos
  - 0001706-64.2026.5.10.0014, principal: Sarah Campos
  - 0012012-81.2025.5.03.0092, Nathalee Felix de Oliveira x GOL, principal: Sarah Campos
  - 0001484-12.2023.5.17.0013, Djalma Julio Goncalves x GOL, principal: Sarah Campos
  - 0010643-04.2021.5.18.0083, principal: Sarah Campos
- No fim, confiro quantos processos foram movidos e se algum ficou para trás.

## Detalhes técnicos
- `processos.coordenacao_id`: de f5a0ac48 para 408d691a, onde `advogado_responsavel_id` = be971b52. Inserção da GOL em `processos_coordenacoes_responsaveis` (principal=false), com `ON CONFLICT DO NOTHING`.
- Nos 6 processos adicionais, inserção da Execução GOL em `processos_coordenacoes_responsaveis`.
- `tarefas.coordenacao_id` atualizado só nos itens em aberto dos 1.842 processos.
- Só mudança de dados, via run_sql. Sem mudança de código.

# Mover os processos da Dra. Beatriz Anjos da Coordenação GOL para a Execução GOL

## O que conferi
- Na Coordenação GOL há 1.848 processos com a Dra. Beatriz Anjos como responsável:
  - Em 1.842, ela é a responsável principal.
  - Em 5, ela é só responsável adicional.
- Em quase todos (1.847), há também outra pessoa como responsável.
- Esses processos têm 9.668 prazos e tarefas da Coordenação GOL. Desses, 288 estão em aberto.

## O que será feito
- Os 1.842 processos em que ela é a responsável principal passam para a "Execução GOL - Dra B. Anjos".
- A Coordenação GOL fica como coordenação responsável adicional nesses processos. Assim a equipe GOL continua vendo esses processos e podendo trabalhar neles. Os responsáveis atuais não mudam.
- Os 5 processos em que ela é só responsável adicional ficam na Coordenação GOL.
- Os 288 prazos e tarefas em aberto passam para a Execução GOL. Os já concluídos ficam como estão, para manter o histórico e o ranking da GOL.
- No fim, confiro quantos processos foram movidos e se algum ficou para trás.

## Pontos a confirmar
1. Mover também os 5 processos em que ela é só responsável adicional?
2. Manter a Coordenação GOL como responsável adicional? Se não, a equipe GOL deixa de responder por esses processos.

## Detalhes técnicos
- `processos.coordenacao_id`: de f5a0ac48 para 408d691a, onde `advogado_responsavel_id` = be971b52.
- Inserção em `processos_coordenacoes_responsaveis` (GOL, principal=false), com `ON CONFLICT DO NOTHING`.
- `tarefas.coordenacao_id` atualizado só nos itens desses processos com situação pendente, atrasado, em_execucao ou a_confirmar.
- Só mudança de dados, via run_sql. Sem mudança de código.

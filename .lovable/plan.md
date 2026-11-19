# Santander Cível: responsáveis duplicados, histórico invisível e situação

## O que aconteceu nos dois processos
A reclamação procede, mas quem retirou as pessoas não foi o sistema.

**0149812-93.2026.8.05.0001 — CRAZ RI**
- 17/11 às 17h56: a Isabela trocou o responsável de Renata para Guilherme.
- 18/11 às 15h19: o sistema devolveu a Renata. Foi a devolução automática que deu errado.
- 19/11 às 10h14: a Geovana tirou a Renata.

O resultado é o que a Isabela tinha escolhido: só o Guilherme.

**1013534-64.2026.8.13.0480 — DEFESA**
- 17/11 às 15h20: a Geovana trocou o responsável de Ívina para Renata.
- 18/11 às 15h19: o sistema devolveu a Ívina.
- 18/11 às 17h31: a Geovana tirou a Ívina.

O resultado é o que a Geovana tinha escolhido: só a Renata. Esse prazo já está cumprido.

O "estava com as duas pessoas" veio da devolução automática de 18/11. Ainda há outras 47 atividades em aberto da Santander Cível nessa situação.

## Por que não conseguem ver o histórico
O histórico de alterações aparece para três tipos de pessoa:
- admins;
- quem tem o perfil geral de Coordenador ou de Assistente de coordenação;
- quem fez a própria alteração.

Quem é coordenadora só dentro da Santander Cível e tem outro perfil geral, como Advogada, não vê o histórico. Quem não fez a alteração também não vê.

## O que será feito
1. **Histórico:** liberar a leitura do histórico de uma atividade para:
   - os membros da coordenação daquela atividade;
   - os responsáveis e envolvidos nela.
   Só a leitura. Ninguém passa a poder alterar o histórico.
2. **Responsáveis duplicados na Santander Cível:** retirar as 47 pessoas colocadas pelo sistema em 18/11 às 15h19 que não são o responsável principal.
   - Só nas atividades em aberto.
   - Antes, guardo uma cópia, como foi feito nas outras coordenações.
3. **Mudança de situação:** desde 18/11 às 18h33 não houve nenhum erro gravado de alguém da Santander Cível. Os últimos foram da Lays, barrados pela regra de situação da própria coordenação. Vou mostrar qual regra barrou a Lays, sem alterá-la.

## Detalhes técnicos
- Migração: nova política SELECT em `auditoria_tarefas` para `authenticated`, com a condição:
  - `coordenacao_id` em `membros_coordenacao` do `auth.uid()`; **ou**
  - `sou_participante_tarefa(tarefa_id)`.
  As políticas existentes continuam como estão.
- Dados: inserir em `backup_responsaveis_devolvidos_20261118` e depois apagar de `tarefa_responsaveis` as linhas que atendem a todas estas condições:
  - `created_at` entre 18:18 e 18:21 UTC de 18/11;
  - coordenação Santander Cível;
  - `usuario_id <> tarefas.responsavel_id`;
  - status em aberto.
- Ler `permissoes_situacao_tipo_tarefa` da Santander Cível.

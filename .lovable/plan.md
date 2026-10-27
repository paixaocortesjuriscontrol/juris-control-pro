# Permitir escolher responsável de outra coordenação

## Diagnóstico (procede)
Na escolha de "Advogados Responsáveis" da audiência, quem não é admin só vê pessoas das coordenações das quais faz parte. Por isso a equipe do Citibank só consegue colocar a Dra. Beatriz Costa numa audiência de SP se ela também for membro da coordenação do Citibank. O seletor geral de responsáveis/envolvidos (tarefa, prazo, evento) já mostra todos os usuários ativos; a restrição está no seletor de audiências e no de tarefas da própria coordenação.

## O que muda
- O filtro de coordenação continua abrindo na coordenação de quem está cadastrando (lista curta, como hoje).
- Nova opção **"Todos os usuários"** no filtro, com busca por nome, para qualquer perfil, permitindo vincular alguém de outra coordenação sem incluí-la como membro.
- A pessoa vinculada passa a ver o item normalmente (ela vira responsável), recebe o aviso de inclusão e o item aparece na agenda dela.
- Nada muda nas regras de "Quem pode reagendar", responsáveis fixos ou isolamento das coordenações: o item continua pertencendo à coordenação de origem.

## Detalhes técnicos
- `SelecionarAdvogadosAudiencia.tsx`: para não-admin, carregar todas as coordenações no filtro (ou só a opção "todas" = todos os perfis ativos), mantendo o padrão inicial na primeira coordenação do usuário.
- Revisar os demais seletores de responsável que limitam a membros (`CriarTarefaAudienciaDialog`, `SelecionarResponsaveisProcesso`) e aplicar o mesmo comportamento.
- Conferir no banco que a regra de acesso a audiências/tarefas já libera o responsável vinculado (sem alterar o banco se já liberar).
- Teste: usuário não-admin consegue selecionar alguém fora das suas coordenações.

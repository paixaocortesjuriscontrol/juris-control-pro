# Desfazer a devolução indevida de responsáveis e conferir a edição

## O que os dados mostram
Às 15h19 (BRT) de 18/11 foram devolvidas 210 pessoas a 177 atividades em aberto. Conferi a retirada de cada uma no histórico:

- **150 retiradas** aconteceram num salvamento comum, sem troca de tipo. Na maioria, alguém foi colocado no lugar ao mesmo tempo. Eram trocas de propósito, e a devolução desfez essas trocas. É o caso da Geovana e da Sanny.
- **48 retiradas** aconteceram junto com a troca de tipo (tarefa para prazo, por exemplo). Esse foi o erro original, o caso da Dra. Janaina.
- **12 casos** não se encaixam em nenhum dos dois grupos e serão conferidos um a um.

Ninguém retirou de novo essas pessoas depois da devolução. Por isso o erro continua aparecendo para quem abre ou salva essas atividades.

## O que será feito
1. **Retirar de novo as 150 pessoas devolvidas por engano.** Só nas atividades em aberto, e sem mexer no responsável principal nem em quem alguém incluiu à mão depois das 15h19. Antes de apagar, guardo uma cópia para poder voltar atrás.
2. **Manter as 48 devolvidas da troca de tipo** e conferir os 12 casos restantes, decidindo cada um pelo histórico.
3. **Conferir a queixa "volta mesmo editando":** abrir as telas de Prazo, Tarefa e Agenda em modo de edição e ver se o formulário põe de volta quem criou a atividade ou a pessoa pré-cadastrada (responsáveis fixos do tipo ou do modelo) por cima da escolha salva. Se puser, corrigir para que, ao editar, os pré-cadastrados e o criador só entrem em atividade nova.
4. Mostrar a você a lista do que foi retirado, por coordenação.

## Detalhes técnicos
- As devolvidas são as linhas de `tarefa_responsaveis` com `created_at` entre 18:19 e 18:20 UTC. Uma retirada conta como troca de tipo quando, em até 5 segundos, existe um `atualizar` em `auditoria_tarefas` com `tipo` em `campos_alterados`.
- A cópia de segurança vai para uma tabela de backup antes do `DELETE`. Todo o resto continua como está.
- Para o passo 3: revisar onde `responsaveis_fixos_tipo_tarefa`, `padroes.responsaveis_ids` e `responsavel_id = usuário atual` alimentam o estado inicial em `PrazoDialog`, `NovaTarefaDialog` e `EdicaoItemPanel` quando `editar = true`.

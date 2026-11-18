# Pessoas somem dos prazos e tarefas ao salvar uma edição

## O que foi confirmado

A reclamação da Dra. Janaina procede. No processo 0001281-19.2026.5.10.0020, a tarefa "Juntar substabelecimento" foi criada em 11/11 com 3 responsáveis: Leandro, Júlia e Bruna. Em 18/11 às 13h27 (BRT), a Bruna mudou o tipo dela de Tarefa para Prazo e salvou. Nesse momento o sistema tirou as 3 pessoas e não as incluiu de volta. Às 15h12 (BRT) só o Leandro voltou.

**Por que isso acontece:** ao salvar, a tela apaga a lista de pessoas e grava a lista de novo. Assim que a lista é apagada, quem está salvando deixa de constar como responsável. Aí o banco bloqueia a nova gravação ("somente o responsável pode trocar o responsável") e a tela não avisa o erro. O item fica sem as pessoas e ninguém percebe.

**Alcance (últimos 30 dias):** 779 retiradas de pessoas em 572 atividades sem retorno logo em seguida. Esse número também inclui retiradas feitas de propósito, então ainda vou separar as que foram perda por esse erro.

## O que será feito

1. **Salvar sem apagar tudo:** a tela de Prazo, a de Tarefa e a da agenda passam a tirar só quem foi realmente desmarcado e a incluir só quem foi marcado. Quem continua na lista fica intocado.
2. **Mostrar o erro:** se o banco recusar alguma inclusão ou retirada, a pessoa vê a mensagem e o item não aparece como salvo.
3. **Regra do banco:** a verificação "somente o responsável pode trocar" passa a considerar quem era responsável antes da troca, para não bloquear quem está editando a própria atividade.
4. **Recuperar as pessoas perdidas:** gerar uma lista dos itens em que todas as pessoas saíram no mesmo salvamento e só parte voltou, como no caso da Dra. Janaina. Você confere a lista antes, e só depois de aprovada as pessoas voltam aos itens ainda abertos.

## Detalhes técnicos

- Telas: `PrazoDialog.tsx` (~710), `delegacao/NovaTarefaDialog.tsx` (~832), `agenda/TarefaAgendaPanel.tsx` (~898). Trocar o `delete` + `insert` por uma comparação: `delete ... in (removidos)` e `insert (adicionados)`, verificando `error` em cada chamada. Criar um auxiliar compartilhado `sincronizarParticipantesTarefa` com teste.
- Gatilho `trg_bloquear_troca_corresponsavel` / `bloquear_troca_responsavel_terceiros`: liberar a inclusão quando o usuário pode alterar a situação do item ou era participante antes da troca.
- Recuperação: consulta em `auditoria_tarefas` (`participante_removido` sem `participante_incluido` da mesma pessoa até 10 s depois, num lote em que todas as pessoas saíram ao mesmo tempo). A gravação de volta só acontece depois da sua aprovação.
- O caso da Isabela (data fatal x data limite) continua sem diagnóstico: nas 8 atividades recentes dela as duas datas foram gravadas iguais. Fica fora deste plano até aparecer um exemplo.

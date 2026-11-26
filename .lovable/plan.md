# Planilha de fatais com responsável antigo após repasse

## O que encontrei no processo 0000846-80.2013.5.08.0012
- Tarefa **RRAP** (data fatal 25/11/2026, pendente): responsáveis ainda são **Gisele Santos e Beatriz Costa**; a **Fernanda Sousa** entrou só como **envolvida**.
- A planilha mostra os responsáveis gravados na tarefa, então segue mostrando a Bia. Ou seja, a planilha está fiel ao cadastro; o problema é que o repasse para a Fernanda não trocou o responsável.
- Ainda não confirmei por qual tela foi feito o repasse (ficha da tarefa, reagendar ou remanejar em lote).

## O que vou fazer
1. Conferir no histórico da tarefa RRAP quem incluiu a Fernanda, quando e por qual tela.
2. Nessa tela, ao repassar/reagendar para outra pessoa, perguntar ao usuário: **"Substituir os responsáveis atuais?"**
   - **Sim**: a nova pessoa vira responsável e os anteriores saem de Responsáveis.
   - **Não**: mantém os responsáveis atuais e acrescenta a nova pessoa (como hoje).
3. Manter o registro na auditoria e a notificação para quem passa a ser responsável.
4. Planilha de fatais e Exportar Atividades continuam lendo os responsáveis atuais, já refletindo a troca.
5. Perguntar antes de corrigir tarefas antigas já repassadas desse jeito (não altero dados sem autorização).

## Detalhes técnicos
- Salvamento via `sincronizarParticipantesTarefa` (inserir novo, remover desmarcado) e atualizar `tarefas.responsavel_id`.
- Testes: com substituir, A para B deixa só B; sem substituir, ficam A e B.

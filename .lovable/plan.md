# Santander Cível: dois responsáveis nos prazos e mudança de situação

## O que os dados mostram
- **Dois responsáveis:** em 50 atividades em aberto da Santander Cível, uma segunda pessoa ainda aparece como responsável. Essas pessoas foram colocadas de volta pelo sistema em 18/11 às 15h19 (horário de Brasília). Nas outras coordenações elas já foram retiradas. A Santander Cível ficou de fora porque ainda estava decidindo, e por isso a confusão aparece nos prazos dela. A coordenação não tem responsáveis fixos configurados, então os nomes não vêm daí.
- **Mudança de situação:** desde 18/11 às 18h33 (horário de Brasília) não houve nenhum erro de mudança de situação gravado para pessoas da Santander Cível. Os últimos foram da Lays Santos, com o aviso "Sua coordenação só permite mudar a situação deste agendamento". Esse aviso vem da regra de situação configurada pela coordenação, que bloqueia a troca para aquele tipo de atividade.

## O que será feito
1. **Retirar os responsáveis extras da Santander Cível**, como já foi feito nas outras coordenações:
   - Saem só as pessoas que o sistema colocou em 18/11 às 15h19 e que não são o responsável principal (47 pessoas).
   - Só atividades em aberto. Cumpridas, canceladas, baixadas e protocoladas não mudam.
   - Antes de retirar, guardo uma cópia de tudo, para devolver se alguém pedir.
2. **Mudança de situação:**
   - Conferir a regra de situação da Santander Cível que bloqueou a Lays.
   - Conferir também se, depois da retirada, quem ficou como responsável principal consegue mudar a situação.
   - Não vou mudar regras sem a sua confirmação. Se houver outro bloqueio sem registro de erro, peço o nome da pessoa e o título da atividade.
3. Conferir depois: nenhuma atividade em aberto da Santander Cível deve continuar com o segundo responsável vindo de 18/11.

## Detalhes técnicos
- Backup: inserir em `backup_responsaveis_devolvidos_20261118` (`papel = 'responsavel'`) as linhas de `tarefa_responsaveis` que atendem a todas estas condições:
  - `created_at` entre 18:18 e 18:21 UTC de 18/11;
  - coordenação Santander Cível;
  - `usuario_id <> tarefas.responsavel_id`;
  - status em aberto.
- Em seguida, apagar essas linhas. O trigger de troca de responsável não é acionado, porque o responsável principal continua o mesmo.
- Ler `permissoes_situacao_tipo_tarefa` da Santander Cível para explicar o bloqueio.

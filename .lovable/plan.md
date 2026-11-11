# Registrar quem inclui ou retira responsáveis e envolvidos

## Como está hoje
- Mudanças no próprio item (situação, data, coordenação etc.) de tarefas, prazos, eventos e audiências já ficam registradas, com o nome de quem mudou.
- Já quem **inclui ou retira** responsáveis, envolvidos e advogados de um item **não fica registrado**. Por isso não deu para saber quem colocou a Jéssica.
- Ao salvar um item, algumas telas apagam a lista de pessoas e gravam tudo de novo. Foi isso que gravou a Jéssica de novo quando a Ana Júlia salvou a tarefa.

## O que vai mudar
1. A partir da publicação, toda vez que alguém **incluir ou retirar** uma pessoa de uma tarefa, prazo, evento ou audiência, o sistema grava:
   - quem fez a mudança, a data e a hora (horário de Brasília);
   - quem entrou ou saiu, com o papel dela (responsável, envolvido ou advogado);
   - o item, o processo e a coordenação;
   - se a pessoa foi incluída na mão ou de forma automática, pelos responsáveis fixos do tipo de tarefa.
2. Quando um salvamento apaga a lista e grava as mesmas pessoas de novo, isso fica registrado como **"mantido"**. Assim não parece que alguém incluiu a pessoa naquela hora.
3. No item, o histórico passa a mostrar também essas inclusões e retiradas, ao lado das outras alterações.

## Limite
- O que aconteceu antes da publicação não pode ser recuperado. Os casos da Jéssica continuam sem o nome de quem a incluiu.

## Detalhes técnicos
- Gatilhos AFTER INSERT/DELETE em `tarefa_responsaveis`, `tarefa_envolvidos`, `evento_responsaveis`, `evento_envolvidos`, `audiencia_envolvidos` e `audiencias_advogados`, gravando em `auditoria_tarefas` com `usuario_id = auth.uid()`, `tipo_item`, `acao` (`participante_incluido`/`participante_removido`), `coordenacao_id`, `processo_id` e `dados_entrada` {papel, usuario_id, origem}.
- Origem "automático" quando a gravação vem de `aplicar_fixos_audiencia` ou do fluxo de responsáveis fixos. Quem executa no servidor, sem sessão, fica como "sistema".
- Para marcar "mantido", uma inclusão é ligada a uma retirada do mesmo item, pessoa e papel na mesma transação.
- Na tela, o histórico do item lê também essas ações.
- Sem mudança nas regras de acesso: a função do gatilho é SECURITY DEFINER e só insere registros de auditoria.

# Retirar Eduardo Torres dos itens da Coordenação Dra. Beatriz Costa

## Por que ele recebe os avisos

O Eduardo Torres (edutorres1976@gmail.com) está cadastrado como **envolvido** em 28 tarefas da Coordenação Dra. Beatriz Costa. Quem é responsável ou envolvido recebe aviso de mudança de situação e de comentário — por isso ele recebeu os e-mails de hoje (CONTROLE FINANCEIRO, PERÍCIA etc., alterados por Felipe Leite). Ele é membro apenas da Coordenação Santander Trabalhista; o vínculo veio só dessa inclusão como envolvido.

## O que será feito

- Retirar o Eduardo Torres da lista de envolvidos das 28 tarefas da Coordenação Dra. Beatriz Costa.
- Nada mais é alterado: ele continua envolvido nos 7 itens da Santander Trabalhista e nos 3 da Santander Cível, e as tarefas em si (situação, responsável, comentários) ficam intactas.

Resultado: ele deixa de receber avisos dos itens da Coordenação Dra. Beatriz Costa e continua recebendo os das outras.

## Detalhes técnicos

- Exclusão em `tarefa_envolvidos` de `usuario_id = e98847c9-9583-43f7-b876-3a148077b8cf` apenas para tarefas cuja `coordenacao_id = d997ca10-0012-4a0e-8856-664812366fec`.
- Sem alteração de código, de regra de notificação ou de configuração de usuário.

# Pendências do Santander Cível

## 1. Cadastrar as 34 empresas do Grupo Santander
- Cadastrar como clientes (Pessoa Jurídica, com CNPJ) os nomes da planilha que ainda não existem. Hoje só o **Banco Santander (Brasil) S.A.** já está cadastrado; ele não será duplicado.
- Vincular cada um à **Coordenação Santander Cível** (item 2).
- Etiquetas: as 7 empresas que têm etiqueta na planilha (Santander Brasil, Getnet, Corretora de Seguros, Cultural, Institucional Corretora, Sociedade de Crédito, Zurich Seguros) ganham uma etiqueta com esse nome na Coordenação Santander Cível. Se já existir uma etiqueta com o mesmo nome, ela é reaproveitada.
- Arrumar CNPJs com erro de digitação: "14. 927.215/0001-67" vira 14.927.215/0001-67. O CNPJ do Banco Santander está incompleto na planilha (90.400.888/0001-4) e o cadastro atual fica como está.

## 2. Vincular clientes a coordenações
- No cadastro do cliente, novo campo **Coordenações**, com uma ou mais coordenações.
- A lista de clientes ganha filtro por coordenação.
- Os clientes que já existem continuam sem coordenação até alguém vincular. Nada é escondido de quem já os vê hoje.

## 3. Quem pode configurar agendamentos (por coordenação)
- Cada coordenação ganha o quadro **Quem pode configurar agendamentos**, em **Coordenações → (a coordenação) → Permissões e configurações**. Ele segue o modelo de "Acesso aos menus", com as abas **Por cargo** e **Por membro**.
- Para cada tipo (Tarefa, Prazo, Audiência, Evento), o coordenador liga ou desliga **Criar e configurar** para cada cargo ou membro.
- Quem tem a opção desligada só pode **mudar a situação** e comentar nos itens daquele tipo. Não pode criar nem alterar título, datas, responsáveis ou outros campos.
- **Começa tudo liberado:** todos os cargos podem criar e configurar qualquer agendamento, em todas as coordenações, inclusive o Santander Cível. Cada coordenação desliga depois o que quiser.
- O admin sempre pode tudo. A regra de um item vale pela coordenação do próprio item.
- A regra vale no banco de dados (não só na tela). Assim ela também vale para a Análise DJEN, as importações e os atalhos. Na tela, as opções bloqueadas somem do botão Adicionar e os campos aparecem travados, com só a Situação livre.
- Workflows continuam gerando as etapas normalmente.

## 4. Pedido do Jhon (Lista de Atividades)
Já foi feito na v10.0.2: o filtro **Tipo de tarefa (na agenda)** mostra só as atividades do dia escolhido, com a quantidade de cada uma, e a Lista mostra só o dia. Depois que for publicado, é só a equipe conferir. Não há nada novo a fazer.

## Detalhes técnicos
- Nova tabela `clientes_coordenacoes (cliente_id, coordenacao_id)` com GRANTs e RLS (leitura para quem já vê o cliente; escrita para admin e coordenadores da coordenação). Os cadastros do item 1 serão feitos via SQL.
- Item 3: nova tabela `permissoes_agendamento_coordenacao (coordenacao_id, cargo|user_id, tipo_item, permitido)`, sem registro = permitido, prioridade membro > cargo. Um trigger BEFORE INSERT/UPDATE em `tarefas` (prazo, tarefa, ATA) e `audiencias_detectadas`, que segue o padrão já usado por `bloquear_edicao_assistente_geral`. Para cargos sem permissão, ele recusa INSERT e só aceita UPDATE quando mudam apenas a situação, as datas de conclusão e os campos de controle. Processos automáticos sem sessão (service_role, cron, materialização de workflow) ficam isentos.
- A permissão vem de `user_roles` e de `membros_coordenacao.cargo`, nunca da tela. O helper do front, `podeConfigurarAgendamentos`, só esconde e trava os campos.

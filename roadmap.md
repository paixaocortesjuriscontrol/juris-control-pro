# Roadmap — pedidos da Isabela (Santander Cível)

- [x] 3 — relatório/correção de tipo, subtipo e título (Agenda Futura, código TAR.)
- [x] 1/4 — datas passadas: criação bloqueia; importações avisam no fim
- [x] 5 — diário marcado como lido só depois de salvar (botões manuais mantidos)
- [x] 6 — workflow: responsáveis, envolvidos e campos por etapa ao iniciar
- [x] 2a — data base visível em tarefa/prazo/ata + prevista/fatal automáticas
  - prazo ganhou o campo "Data base" editável (antes só interno, vindo da publicação)
  - prevista e fatal calculadas em dias úteis com os feriados da coordenação
  - sem prazo cadastrado: prevista e fatal = a própria data base
  - fatal do modelo tem prioridade; as duas continuam editáveis
  - testes em src/lib/datasBase.test.ts (8)
- [x] 2b — reorganizar a janela no padrão enviado (quadro do processo, abas, subatividade)
  - tarefa/ata: quadro do processo primeiro (tipo, coordenação, processo + resumo expansível),
    depois prioridade, título, base, prevista/fatal com hora, local, pessoas, observações,
    anexos, abas, alertas e recorrência
  - prazo: processo, título, base, prazo+data limite, fatal, pessoas, observações, abas,
    alertas e recorrência
  - subatividade já existe na aba "Atividades" (data, responsável, situação, observação)
- [ ] 7 — cores das situações (adiado pelo usuário: não mexer agora)

## Responsável ou envolvido obrigatório (23/11/2026)
- [ ] Exigir pelo menos um responsável ou envolvido em tarefa, prazo, ata, evento, audiência e parcelamento
- [ ] Aplicar a validação também em workflows e importações, sem preencher pessoas automaticamente
- [ ] Impedir que uma edição remova a última pessoa vinculada
- [ ] Gerar planilha das atividades antigas sem ninguém para correção manual, sem alterar esses registros
- [ ] Testar a regra e verificar a compilação

## Acompanhamento Especial — avisos (pedido de 18/11/2026)
- [x] Lista "Quem recebe os avisos" chega marcada: coordenadores por padrão e as pessoas já escolhidas
- [x] Coordenador pode ser desmarcado para deixar de receber (campo `coordenadores_excluidos_ids`)

## Minhas Responsabilidades — ficha ampliada do calendário (18/11/2026)
- [x] Painel largo exclusivo do clique no calendário, sem alterar o Painel de Controle
- [x] Abas Atividade, Processo, Publicações, Workflow e Documentos com dados sob demanda
- [x] Barra superior com Dados, Atividades, Checklist, Comentários, Anexos e Histórico de alterações
- [x] Somente a seção escolhida visível e uma única rolagem na ficha
- [x] Testes de datas/mesclagem e verificação da compilação
- [x] Aviso de que o seletor Tarefa/Prazo/Ata altera o tipo da atividade
- [x] Ficha completa em Agenda, Lista, Compacta, Kanban, Calendário e Atividades, sem alterar o Painel de Controle
- [x] Aba Acompanhamento Especial somente em processos monitorados, com configuração, movimentações e divergências já registradas
- [x] Processo vinculado gerenciado na aba superior, fora dos dados da atividade
- [x] Desvinculação somente após confirmação explícita dentro da aba Processo
- [x] Polos ativo e passivo do processo vinculado no cabeçalho da ficha
- [x] Padronizar as duas barras de abas com ícones, mesma distribuição e mesmo fundo
- [x] Reduzir a altura vertical das barras de abas da ficha

## Tag de Acompanhamento Especial nas atividades (18/11/2026)
- [x] Bolinha vermelha com "A" em atividades de processos com Acompanhamento Especial
- [x] Minhas Responsabilidades: Agenda, Lista, Compacta, Kanban, Calendário, Atividades e ficha lateral
- [x] Painel de Controle: cartões e listas (resposta do usuário: também no Painel)

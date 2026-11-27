# Roadmap — pedidos da Isabela (Santander Cível)

## Painel Judit e versão (27/11/2026)
- [x] Mostrar total, cobradas e custo por coordenação atual do processo, com linha separada para processos não cadastrados
- [x] Atualizar o menu para v10.5.0; 2 testes e compilação aprovados (conferência autenticada indisponível no Supabase externo)

## Relatórios da Auditoria (25/11/2026)
- [x] Reduzir a consulta do Excel/PDF e mostrar progresso real por etapa
- [x] Preencher o número do processo pelo `processo_id` no Excel e no PDF
- [x] Traduzir IDs em valores anteriores/novos e validar o PDF gerado
- [x] Testar 13 regras, arquivos gerados e compilação; clique autenticado indisponível no Supabase externo


## Observação do advogado no processo e na Análise DJEN (24/11/2026)
- [x] Disponibilizar a observação do advogado na visão geral de Processos e Casos
- [x] Exibir e editar a mesma observação no painel lateral direito da lista, antes da ficha completa
- [x] Abrir edição da mesma observação em painel lateral na Análise DJEN para processos cadastrados
- [x] Salvar somente o campo da observação, sem alterar publicação ou leitura
- [x] Testar a regra e verificar a compilação

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
- [x] Exigir pelo menos um responsável ou envolvido em tarefa, prazo, ata, evento, audiência e parcelamento
- [x] Aplicar a validação também em workflows e importações, sem preencher pessoas automaticamente
- [x] Impedir que uma edição remova a última pessoa vinculada
- [x] Gerar planilha das atividades antigas sem ninguém para correção manual, sem alterar esses registros
- [x] Testar a regra e verificar a compilação

## Eventos não visíveis para envolvidos (pedido de 24/11/2026)
- [x] Conferir os vínculos das quatro pessoas e a regra de acesso dos eventos
- [x] Verificar o acesso no Painel de Controle, Minhas Responsabilidades, Minha Agenda, busca global, ficha do processo e avisos automáticos
- [x] Corrigir somente a regra de acesso comprovada para eventos da mesma coordenação, sem alterar perfis ou coordenações indevidamente
  - `can_access_evento` agora reconhece responsáveis e envolvidos, além dos participantes antigos
  - 136 vínculos sem coordenador geral foram verificados: 136 liberados e 0 ainda bloqueados
  - as quatro pessoas ficaram com 0 eventos vinculados bloqueados; evento sem vínculo continua negado
  - 30 testes das agendas passaram; compilação do preview OK

## Acompanhamento Especial — avisos (pedido de 18/11/2026)
- [x] Lista "Quem recebe os avisos" chega marcada: coordenadores por padrão e as pessoas já escolhidas
- [x] Coordenador pode ser desmarcado para deixar de receber (campo `coordenadores_excluidos_ids`)

## Análise DJEN — Salvar e fechar sem leitura (24/11/2026)
- [x] Ler os caminhos dos botões na Análise DJEN: tarefa/ata, prazo, evento e audiência (cabeçalho e rodapé)
- [x] Corrigir a intenção de leitura que permanecia após validação/erro ao trocar de Salvar e ler para Salvar e fechar
- [x] Conferir os wrappers, os vínculos à publicação e os triggers das atividades/junções: não registram leitura automaticamente nesse fluxo
- [x] Conferir a cópia no processo e a resolução de publicações: cópia preserva a leitura da origem; resolução de legado cria cópia já lida, comportamento histórico fora do botão solicitado, não alterado
- [x] Rodar os 14 testes de salvamento e conferir compilação sem erros
- [x] Preservar publicações já lidas, configurações e permissões; acesso logado indisponível para verificar a tela com dados reais

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

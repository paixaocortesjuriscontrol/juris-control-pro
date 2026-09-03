# Roadmap — Considerações 02/09

Pulados por decisão do usuário: tarefas do Ástrea (item 15 do doc) e criação/desduplicação de usuários.

## Leva 1 — Bugs que quebram uso
- [x] 01 Nova tela "Reatribuir Processos" (paginação no servidor, filtros, seleção em massa, destino, gravação em lotes) + diálogo de Coordenações lendo `processos_responsaveis`
- [x] 17 "Marcar como ciente" não pode sumir da tela (divergências ficam visíveis com aparência de já visto, filtro pendentes/todas, contagem só de pendentes, botão Reabrir)
- [x] 08 Botão "Buscar mais do servidor" com número correto e só quando há mais no servidor
- [~] 10 Ranking TST — RPC conferida no banco (retorna dados em <1s); a tela passou a exibir o erro real com "Tentar novamente". Aguarda o print/mensagem do erro para fechar a causa.

## Leva 2 — Agenda e recorrências
- [x] 12 Divergência de calendário Dra. Janaina x Admin (admin com coordenação selecionada agora usa também os responsáveis/membros, igual ao perfil do coordenador)
- [x] 13 Recorrente em dias úteis: série começa em dia útil e o intervalo conta dias úteis (tarefas, prazos e eventos)
- [x] 11 Nova situação "Cancelar e ocultar da agenda" (`cancelado_oculto`, registro preservado no banco)
- [x] 14 Definir a data direto no calendário ("Criar nesta data" no painel do dia, pré-preenchendo tarefa/prazo/evento)
- [x] 18 Baixa da pendência pela tela principal com pop-up completo (situação, data de cumprimento, comentário e, em recorrentes, somente esta / toda a série)

## Leva 3 — Análise DJEN e processos
- [x] 02 Preservar filtros ao voltar da Análise DJEN
- [x] 05 "Ver processo" abrindo em nova aba
- [x] 06 Partes logo abaixo do número do processo
- [x] 09 Pesquisa global sem trazer todas as publicações fora da Análise DJEN
- [x] 03 Processos e casos com pendentes primeiro
- [x] 04 Balãozinho de comentários no Painel de Controle com bolinha de não vistos

## Leva 4 — Complementos
- [x] 07 Processos em comum Dr. Thonmás / Dra. Janaina em planilha
- [~] 17b Exportar comentários em XLSX (pulado pelo usuário)
- [x] 16 Botão "Acatar" ao lado de cada sugestão da Judit (Monitoramento → Divergências Judit)
- [ ] 19 Diagnóstico do erro ao criar/editar usuário

## Audiências — pessoas fixas
- [x] Trigger no banco aplica pessoas fixas de AUDIÊNCIA em toda audiência criada
- [x] Cards do Kanban de audiências mostram responsáveis e envolvidos
- [x] Diálogo de reagendar/nova audiência mostra as pessoas replicadas
- [ ] Editar audiência: campo de Envolvidos sempre visível, com fixos travados (cadeado)

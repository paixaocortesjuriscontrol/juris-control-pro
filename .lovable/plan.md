# Cartões do Painel de Controle no mesmo modelo da Distribuição TST

## Como a Distribuição TST funciona hoje
Ela não baixa todos os registros para contar. Os números dos cartões vêm de uma única consulta de totais, feita no banco (`get_distribuicao_tst_situacao_totais` / `get_distribuicao_tst_stats`), com os mesmos filtros da tela. A lista é carregada em partes, separadamente. Por isso os cartões aparecem rápido.

No Painel de Controle, os cartões só mostram os números depois que o calendário baixa todas as atividades do período, parte por parte. Por isso demora, e qualquer falha deixa os cartões em 0.

## Proposta
1. Criar uma consulta de totais no banco para o Painel, que devolve de uma vez: Tarefas, Atas, Eventos, Prazos, Audiências e Parcelamentos (e o total de atrasados). Ela conta **apenas as atividades em aberto**, como os cartões fazem hoje, e usa os mesmos filtros da tela: Pessoal/Escritório, coordenações, pessoas e período.
2. Os cartões passam a usar essa consulta e aparecem logo, sem esperar o calendário.
3. O calendário continua carregando como hoje, mas só o período que está na tela, sem travar os cartões.
4. Conferir, em várias combinações de filtro, se os números dos cartões batem com o que a lista mostra, antes de trocar.

## Por que não uma tabela de totais
Uma tabela com totais prontos precisaria ser atualizada a cada criação, mudança de situação, exclusão, troca de responsável e repetição de tarefas recorrentes. Qualquer descompasso mostraria números errados. A consulta de totais calcula na hora, com os índices que já existem, então fica sempre correta e rápida, como na Distribuição TST.

## Detalhes técnicos
- Nova função `get_painel_totais(filters jsonb)`, `SECURITY INVOKER` (respeita RLS e o perfil Assistente Jurídico Geral), `STABLE`. Conta `tarefas` (separando ATA, PRAZO, AUDIÊNCIA e demais por `tipo_tarefa`), `eventos_agenda` (por `tipo`, incluindo parcelamentos), `audiencias_detectadas` e `parcelas_evento`, aplicando o escopo: coordenação via `coordenacao_id`; pessoal/pessoas via `responsavel_id`, `criado_por`, `tarefa_responsaveis`, `tarefa_envolvidos` e `participantes_evento`; período; situação (`statusIn`/`statusNotIn`).
- Itens recorrentes (17 tarefas hoje): as ocorrências da janela são expandidas na própria função com `generate_series`, para o total bater com o calendário; ocorrências com situação própria seguem `ocorrencias_recorrentes_status`.
- Índices existentes (`idx_tarefas_coord_venc`, `idx_eventos_agenda_coord_status_data`, `idx_audiencias_coord_data`, `idx_tarefas_agenda_lookup`) cobrem as contagens. Medir com EXPLAIN e só criar índice se algum plano não usar índice.
- Front: hook `usePainelTotais` com React Query, chave com filtros e usuário, invalidada junto com a agenda após mudanças. `PainelControle.tsx` usa os totais nos cartões; a agenda unificada permanece como fonte da lista e do calendário.
- Teste comparando a classificação por tipo (ATA/PRAZO/AUDIÊNCIA/tarefa) do front com a da função.
- Registrar a regra em `AGENTS.md`, substituindo a atual "Control-panel totals use the unified agenda only".

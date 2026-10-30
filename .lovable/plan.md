# Tipos de tarefa como no Projuris

## Como é hoje
- Aqui o sistema tem uma lista fixa de 19 tipos (Prazo, Defesa, Recurso, Petição, Ata, Outros...), igual para todo mundo; ninguém consegue criar tipos novos pela tela.
- No Projuris (planilha enviada) há 302 tipos, sendo 212 ativos — 198 de tarefa e 14 de compromisso — como "APRESENTAR CÁLCULOS", "SIMULADOR 1ª FASE", "CRAZ APC". Cada tipo tem uma cor, um prazo padrão e um prazo fatal (em dias), um horário padrão e uma forma de contar o prazo (Dias corridos, CPC antigo, CPC novo ou Prazo inverso).

## O que vamos fazer
1. **Cadastro de tipos de tarefa por coordenação** — nova tela "Tipos de tarefa", no menu, ao lado de "Modelos de checklist". Nela dá para criar, renomear, escolher a cor, ativar/desativar e definir prazo padrão, prazo fatal, hora padrão, forma de contagem e um modelo de checklist opcional.
2. **Os 19 tipos atuais continuam valendo** para todas as coordenações, para não mudar tarefas, filtros, contagens, Atas e Ranking que já existem.
3. **Escolha do tipo ao criar uma tarefa** — o campo "Tipo de tarefa" vira uma lista com busca (como na imagem do Projuris): mostra os 19 tipos do sistema mais os da coordenação. Ao escolher o tipo, o sistema já sugere a data prevista e a fatal (pela contagem em dias úteis ou corridos), a hora e os itens do checklist; tudo pode ser alterado.
4. **Importar do Projuris** — novo quadro em Migração Projuris: você envia `tarefatipo` e `tarefaprazotipo`, e os 212 tipos ativos entram na Coordenação Santander Cível. Se rodar de novo, o que já entrou é pulado, e há o botão Desfazer.
5. **Tarefas já migradas** — passam a mostrar o tipo original do Projuris, ligado pelo código do tipo, quando ele existir na planilha de tarefas.
6. **Responsáveis fixos e permissões por tipo** (telas que já existem) passam a listar também os tipos novos.

## Pergunta em aberto
- Os tipos importados ficam só na Santander Cível ou valem para todas as coordenações? O plano assume só na Santander Cível.

## Detalhes técnicos
- Nova tabela `tipos_tarefa` (coordenacao_id, nome, cor, ativo, categoria tarefa/compromisso, prazo_padrao_dias, prazo_fatal_dias, hora_padrao, contagem: corridos/uteis_cpc/inverso, checklist_modelo_id, chave_externa `projuris:<cd>`), com GRANTs e RLS por coordenação (leitura: membros, admin e assistente geral; escrita: admin/coordenador/assistente de coordenação).
- `tarefas.tipo_tarefa` continua texto (nome do tipo), para não quebrar consultas, `corKeyItem`/`isItemAta` nem as RPCs da agenda; os tipos novos apenas somam opções.
- Hook `useTiposTarefa(coordenacaoId)` junta `TIPOS_TAREFA` + tabela; substitui as listas fixas em `NovoItemPanel`, `CriarTarefaAudienciaDialog`, `TarefaPublicacaoView`, filtros da `MinhaAgenda` e `MigracaoProjuris`.
- Cálculo de datas reutiliza `calcular_primeiro_dia_util`/regras de feriados existentes; o "Prazo inverso" conta para trás a partir da data fatal.
- Importador segue o padrão do de checklists/marcadores (auditoria em `migracoes_projuris_itens`, tipo `tarefa_tipo`).
- Testes: cálculo de datas por contagem e leitura/filtragem do CSV (ativos e não excluídos = 212).

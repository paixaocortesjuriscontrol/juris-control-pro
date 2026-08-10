# Resposta à nova coordenação — o que já existe e o que falta desenvolver

Levantamento item a item das 13 solicitações, verificado no sistema atual, com plano do que falta e um texto pronto para o e-mail de resposta.

## Situação atual (verificada no sistema)

| Solicitação | Situação | Observação |
|---|---|---|
| 1. Captura de movimentações (push TJs) | Já existe | Hub de Monitoração + DJEN Servidor por coordenação, Judit e Acompanhamento Especial (sincronização automática de partes, andamentos e campos, com aviso de divergências no Painel de Controle) |
| 2. Migração de históricos/documentos do Projuris | Parcial | Importação de processos e tarefas Projuris já existe; comentários, documentos, peças, comprovantes de protocolo e histórico das tarefas ainda não são migrados |
| 3. Tipos de tarefa parametrizáveis pelo admin | A desenvolver | Hoje a lista de tipos é fixa no código |
| 4. Auditoria das tarefas | Já existe | Trilha campo a campo por item (aba Histórico) e tela Auditoria de Itens, com usuário e data |
| 5. Ampliação de status | Já existe (parcial) | Em revisão, A confirmar, Verificado, Concluído com sucesso/sem sucesso, Cancelado, Reagendado, Protocolado, Baixado, Tratado. Falta justificativa obrigatória no cancelamento |
| 6. Restrição por perfil de acesso | Já existe | Perfis (admin, coordenador, assistente coordenador, advogado, estagiário, assistente, secretária), permissões de menu por usuário, situações restritas e bloqueio de alteração de datas |
| 7. Notificação de citação/menção por e-mail | A desenvolver | Existem notificações de criação, mudança de situação e comentários, mas não menção a colaborador |
| 8. Workflows (etapas encadeadas) | A desenvolver | Existem modelos de título com preenchimentos padrão, mas não geração automática da etapa seguinte |
| 9. TAGs em processos e tarefas | Já existe (parcial) | Etiquetas por coordenação em processos e itens + TAGs na Distribuição TST. Falta destaque da TAG na chegada de nova movimentação/publicação |
| 10. Campos Objeto e Assunto | Parcial | Existe "Objeto da ação (assunto)" em campo único de texto livre. Falta separar Objeto e Assunto como campos classificatórios com lista padronizada, filtro e relatório |
| 11. Campo do sistema judicial (PJe, e-SAJ, EPROC…) | Parcial | O campo existe na base e é preenchido pela Judit, mas não está exposto como seleção no formulário |
| 12. Relatórios em Excel | Parcial | Diversas exportações Excel já existem (Distribuição TST, atividades, indicadores, carga Benner). A tela Relatórios exporta somente PDF |
| 13. Auditoria de exclusão/reagendamento/troca de responsável | Já existe | Coberto pela trilha de auditoria do item 4 |

## O que será desenvolvido

### Bloco A — Parametrização e regras de tarefa
- Cadastro de tipos de tarefa em tabela própria, gerenciável por admin/coordenação (nome, cor, ativo, ordem, global ou por coordenação), substituindo a lista fixa nos formulários e filtros.
- Justificativa obrigatória apenas para "Cancelado" (demais situações seguem com comentário opcional), gravada no histórico do item.

### Bloco B — Menções e notificações
- Menção a colaborador nos comentários de tarefas, prazos, audiências e eventos, com seleção de usuários da coordenação.
- E-mail automático ao mencionado, no mesmo padrão detalhado já usado (autor, item, processo, coordenação, data/hora BRT e trecho do comentário).

### Bloco C — Workflows
- Cadastro de fluxos por coordenação: etapas sequenciais com tipo de tarefa, responsável padrão e prazo relativo à conclusão da etapa anterior.
- Ao concluir uma etapa, a próxima tarefa é criada automaticamente e vinculada ao mesmo processo.

### Bloco D — Cadastro do processo
- Campos "Objeto" e "Assunto" separados, com listas padronizadas administráveis, disponíveis em filtros e relatórios.
- Campo de seleção do sistema judicial (PJe, e-SAJ, EPROC, PROJUDI, Creta, outros) visível no formulário, preenchido automaticamente pela Judit quando vazio.

### Bloco E — TAGs em destaque
- Exibição destacada das TAGs do processo e da tarefa nos cards de nova movimentação e nas publicações DJEN.

### Bloco F — Relatórios em Excel
- Exportação em Excel na tela Relatórios, com as mesmas seções e filtros da versão PDF.

### Bloco G — Migração Projuris (histórico completo)
- Importador de comentários, documentos, peças, comprovantes de protocolo e histórico das tarefas desde 2024, em lotes com barra de progresso e cancelamento, vinculando ao processo e à tarefa de origem e preservando autor e data originais.
- Depende do formato de extração disponível no Projuris (planilhas e/ou pacote de arquivos) — a confirmar com o solicitante.

## Detalhes técnicos

- Novas tabelas: tipos de tarefa configuráveis, catálogos de objeto/assunto, definições e etapas de workflow, menções de item. Todas com RLS por coordenação e grants padrão.
- Workflow acionado na conclusão do item, reutilizando a criação de item já existente (um único card para o conjunto de responsáveis).
- Menções enviadas pela fila de notificações atual, sem novo canal de e-mail.
- Exportação Excel reaproveitando o utilitário de planilhas já usado nas demais telas, com datas em DD/MM/AAAA.
- Migração Projuris em worker de leitura de planilha, com upsert idempotente por identificador de origem para permitir reprocessamento sem duplicar.

## Ordem de entrega sugerida

1. Blocos A e D (baixo risco, uso imediato)
2. Blocos B e E
3. Bloco F
4. Bloco C
5. Bloco G (após definição do formato de extração do Projuris)

## Rascunho do e-mail de resposta

Assunto: Juris Control — análise das funcionalidades solicitadas

Prezados,

Analisamos as 13 funcionalidades solicitadas. Sete já estão disponíveis hoje: captura automática de movimentações dos tribunais (monitoramento push, com acompanhamento especial e sincronização automática), trilha de auditoria completa das tarefas (troca de responsável, reagendamento, edição e exclusão, com usuário e data), status ampliados (Em revisão, A confirmar, Concluída com sucesso, Concluída sem sucesso, Cancelada, Reagendada, Protocolada, entre outros), restrição de funcionalidades por perfil de acesso, TAGs/marcadores em processos e tarefas, exportações em Excel em diversas telas operacionais e importação de processos e tarefas do Projuris.

As demais serão desenvolvidas: parametrização dos tipos de tarefa pela Coordenação/Controladoria; justificativa obrigatória no cancelamento; notificação por e-mail ao colaborador mencionado em uma tarefa; workflows com geração automática das etapas subsequentes; campos "Objeto" e "Assunto" com classificação padronizada, filtros e relatórios; campo de identificação do sistema do tribunal (PJe, e-SAJ, EPROC, PROJUDI etc.); destaque das TAGs na chegada de nova movimentação ou publicação; e exportação em Excel também na tela de Relatórios.

Sobre a migração do histórico do Projuris desde 2024 (comentários, documentos, peças, comprovantes de protocolo e registros das tarefas), é viável e será feita em lotes com controle de progresso. Para isso, precisamos saber qual formato de extração está disponível no Projuris (planilhas e/ou pacote de arquivos) e receber uma amostra.

Ficamos à disposição.
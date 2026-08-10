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

## Escopo aprovado agora

Serão desenvolvidos os blocos A, B, E e F. Blocos C (workflows), D (Objeto/Assunto separados) e G (migração do histórico Projuris) ficam fora deste ciclo.

### Bloco A — Tipos de tarefa e situações por coordenação
- Novas tabelas de catálogo: tipos de tarefa e situações de item, ambas com coordenação, rótulo, ícone/cor, ordem e ativo.
- Carga inicial: todos os tipos e situações usados hoje são criados como padrão para todas as coordenações, sem mudança de comportamento no primeiro dia.
- Tela de administração (Admin/Coordenação): criar, renomear, reordenar, ativar/desativar e marcar situações como restritas (só admin/coordenador/assistente coordenador podem selecionar).
- Formulários e filtros de prazo, tarefa, audiência, evento e parcelamento passam a listar os tipos e situações da coordenação do item; sem catálogo próprio, usam o padrão.
- Justificativa obrigatória apenas na situação "Cancelado", gravada no histórico do item (as demais seguem com comentário opcional).

### Bloco B — Menções com @ e notificação por e-mail
- Ao digitar `@` no comentário de qualquer item, abre a lista de membros das coordenações às quais o usuário logado pertence (admin vê todas), com busca por nome.
- A menção é destacada no texto do comentário e registrada de forma estruturada.
- E-mail automático ao mencionado no mesmo padrão detalhado já usado: autor, item e título, processo vinculado, coordenação, data/hora em BRT e trecho do comentário, com link direto para o item.

### Bloco E — TAGs em destaque
- Exibição destacada das TAGs do processo e da tarefa nos cards de nova movimentação e nas publicações DJEN.

### Bloco F — Relatórios em Excel
- Exportação em Excel na tela Relatórios, com as mesmas seções e filtros da versão PDF.

## Detalhes técnicos

- Novas tabelas: catálogo de tipos de tarefa, catálogo de situações e menções de item — todas com RLS por coordenação e grants padrão.
- O seed replica as listas atuais (tipos de `tiposTarefa.ts` e situações de `situacoesItem.ts`) para cada coordenação existente; novas coordenações recebem o padrão automaticamente.
- Menções gravadas em tabela própria vinculada ao comentário e enviadas pela fila de notificações atual, sem novo canal de e-mail.
- O seletor de `@` reaproveita a regra de coordenações do usuário já existente (`useCoordenacoesDoUsuario` + membros da coordenação).
- Exportação Excel reaproveitando o utilitário de planilhas já usado nas demais telas, com datas em DD/MM/AAAA.

## Ordem de entrega

1. Bloco A (catálogos + tela de administração + justificativa de cancelamento)
2. Bloco B (menções com `@` + e-mail)
3. Bloco E
4. Bloco F

## Rascunho do e-mail de resposta

Assunto: Juris Control — análise das funcionalidades solicitadas

Prezados,

Analisamos as 13 funcionalidades solicitadas. Sete já estão disponíveis hoje: captura automática de movimentações dos tribunais (monitoramento push, com acompanhamento especial e sincronização automática), trilha de auditoria completa das tarefas (troca de responsável, reagendamento, edição e exclusão, com usuário e data), status ampliados (Em revisão, A confirmar, Concluída com sucesso, Concluída sem sucesso, Cancelada, Reagendada, Protocolada, entre outros), restrição de funcionalidades por perfil de acesso, TAGs/marcadores em processos e tarefas, exportações em Excel em diversas telas operacionais e importação de processos e tarefas do Projuris.

Serão desenvolvidas nesta etapa: parametrização dos tipos de tarefa e das situações por coordenação (mantendo as opções atuais como padrão em todas), com justificativa obrigatória no cancelamento; menção a colaboradores nos comentários usando "@", com lista dos membros das coordenações do usuário e envio automático de e-mail ao mencionado; destaque das TAGs na chegada de nova movimentação ou publicação; e exportação em Excel também na tela de Relatórios.

Ficam previstas para uma etapa posterior, conforme priorização: workflows com geração automática das etapas subsequentes, separação dos campos "Objeto" e "Assunto" e a migração do histórico do Projuris desde 2024 (comentários, documentos, peças e comprovantes de protocolo) — esta última dependerá do formato de extração disponível no Projuris.

Ficamos à disposição.
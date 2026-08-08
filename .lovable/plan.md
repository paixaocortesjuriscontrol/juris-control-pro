# Processo em múltiplas coordenações

Hoje cada processo pertence a uma única coordenação (`processos.coordenacao_id`) e há 242 números de processo cadastrados em duplicidade (484 registros), sempre em coordenações diferentes. O objetivo é ter **um único cadastro por processo**, compartilhado entre coordenações, com dados comuns editáveis por todas e agenda privada por coordenação.

## 1. Vínculo múltiplo de coordenações

- Nova tabela de vínculo `processos_coordenacoes` (processo + coordenação, com marcação de coordenação principal).
- Backfill: cada processo existente gera um vínculo com sua coordenação atual.
- `processos.coordenacao_id` continua existindo como "coordenação principal" (compatibilidade com telas e relatórios), mas a visibilidade passa a considerar todos os vínculos.

## 2. Unificação dos processos duplicados

Para cada número duplicado:
1. O registro **mais recente** vira o canônico.
2. Campos vazios no canônico são preenchidos com os valores do registro antigo (nada preenchido é sobrescrito).
3. Todos os dados filhos (tarefas, eventos, audiências, parcelamentos, publicações DJEN, movimentações, documentos, pedidos, partes, testemunhas, custas, depósitos, distribuições, auditoria, monitoramentos etc.) são repontados para o canônico.
4. O canônico recebe vínculo com **as duas coordenações**.
5. O registro duplicado é **excluído definitivamente**.
6. Itens de agenda sem coordenação definida recebem a coordenação **de quem criou o item**.

Um relatório da unificação (número, registros mesclados, itens movidos) fica registrado para conferência.

## 3. Regras de acesso

- **Comum a todas as coordenações vinculadas** (ver e editar): visão geral, partes, pedidos, andamentos, publicações DJEN, documentos, TST, Judit, auditoria.
- **Privado por coordenação** (cada uma vê apenas os seus): tarefas, prazos, eventos, audiências e parcelamentos.
- Administrador continua vendo tudo.

## 4. Ajustes de tela

- **Processos e Casos**: filtro de coordenação passa a considerar o vínculo múltiplo; a coluna/etiqueta de coordenação mostra todas as coordenações do processo.
- **Visão geral**: campo de coordenações com **seleção múltipla** ao criar e editar o processo.
- **Aba Agenda do processo** e cards de pendências: passam a filtrar itens pela coordenação do usuário logado (admin vê tudo, com indicação da coordenação de cada item).
- **Auditoria**: sem filtro por coordenação (registro único e comum).

## Detalhes técnicos

- Migração: `processos_coordenacoes` (PK própria, únique processo+coordenação, GRANTs para authenticated/service_role, RLS com leitura para admin/membros/coordenadores e escrita para usuário ativo).
- Função `public.usuario_ve_processo(processo_id)` (SECURITY DEFINER) para evitar recursão nas policies; `processos_select_scoped` reescrita para usar o vínculo múltiplo.
- Remoção/ajuste do índice único de número por coordenação, substituído por unicidade global de `numero` após a unificação (para impedir novas duplicidades) — importações passam a adicionar vínculo de coordenação em vez de criar novo registro.
- Frontend: `useProcessos`/`Processos.tsx` passam a trazer os vínculos agregados; novo hook `useProcessoCoordenacoes`; `ProcessoAgendaTab`, `PendenciasProcessoCard`, `useEventosAgenda`, `usePrazos` e `useAudienciasDetectadas` recebem filtro por coordenação do usuário.
- Scripts de merge executados em lotes, com log em tabela de auditoria.

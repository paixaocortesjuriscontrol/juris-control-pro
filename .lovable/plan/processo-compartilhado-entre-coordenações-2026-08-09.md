# Processo compartilhado entre coordenações

Novo modelo: **um único cadastro por número de processo**, visível para todas as coordenações. A coordenação deixa de ser chave de acesso e passa a ser apenas **responsabilidade** — uma ou mais coordenações podem ser responsáveis pelo mesmo processo.

## 1. Responsáveis por coordenação (sem chave de acesso)

- Nova tabela `processos_coordenacoes_responsaveis` (processo + coordenação), permitindo várias coordenações responsáveis pelo mesmo processo.
- Backfill: cada processo existente gera um vínculo com a coordenação que hoje está em `processos.coordenacao_id`.
- A visibilidade de processos deixa de depender de coordenação: **todos os usuários ativos veem todos os processos**. A coordenação responsável passa a ser informação e filtro, não restrição.
- Nenhum índice/regra de unicidade "número + coordenação". A unicidade passa a ser apenas pelo **número do processo**.

## 2. Situação encontrada nos duplicados

242 números duplicados (484 registros):

```text
Coordenação Dr. Thomás ............ 242 registros
Coordenação Dra. Janaina Catunda .. 241 registros
Coordenação Santander Cível ....... 1 registro
```

Ou seja: 241 pares Thomás x Janaina e 1 par Thomás x Santander Cível.

## 3. Unificação sem tocar na coordenação da Dra. Janaina

Para cada par:
1. O registro da **Dra. Janaina** (ou, no par restante, o da Santander Cível) é o **canônico e permanece intacto** — nenhum campo, item ou vínculo dela é alterado.
2. O registro duplicado do Dr. Thomás é absorvido: tarefas, prazos, audiências, eventos, parcelamentos, publicações DJEN, andamentos, documentos, pedidos, partes, testemunhas, custas, depósitos, distribuições, monitoramentos e auditoria são repontados para o canônico, mantendo cada item na sua coordenação de origem.
3. Campos da visão geral **vazios no canônico** são complementados com os dados do registro do Thomás; nada já preenchido é sobrescrito.
4. O canônico passa a ter **as duas coordenações como responsáveis**.
5. O registro duplicado do Thomás é **excluído definitivamente**.

Um relatório da unificação (número, coordenações, itens movidos) é gerado para conferência.

## 4. Regras de visualização e edição

- **Dados comuns do processo** (visão geral, partes, pedidos, andamentos, publicações DJEN, documentos, TST, Judit, auditoria): visíveis e editáveis por qualquer coordenação, com registro de autoria na auditoria.
- **Itens de agenda** (tarefas, prazos, audiências, eventos e parcelamentos): cada coordenação vê apenas os seus. Administrador vê todos, com a coordenação indicada em cada item.
- Itens antigos sem coordenação definida recebem a coordenação de **quem criou o item**.

## 5. Ajustes de tela

- **Processos e Casos**: filtro de coordenação passa a filtrar por coordenação responsável (podendo haver várias); a coluna mostra todas as responsáveis. Listagem não é mais restringida por coordenação.
- **Visão geral**: campo de coordenações responsáveis com **seleção múltipla**, na criação e na edição.
- **Aba Agenda do processo** e card de pendências: filtram os itens pela coordenação do usuário logado.
- **Auditoria**: registro único e comum, sem filtro por coordenação.

## Detalhes técnicos

- Migração: `processos_coordenacoes_responsaveis` (unique processo+coordenação, GRANTs para authenticated e service_role, RLS de leitura para usuário ativo e escrita para admin/coordenador/membro).
- `processos_select_scoped` substituída por leitura aberta a usuário ativo (`is_user_active(auth.uid())`), mantendo o acesso do portal do cliente restrito aos seus próprios processos.
- Remoção do índice único de número por coordenação; criação de índice único global em `numero` após a unificação, para impedir novas duplicidades. Importações passam a atualizar o processo existente e adicionar a coordenação responsável em vez de criar novo registro.
- `processos.coordenacao_id` é mantido apenas como coordenação de origem/principal para compatibilidade de telas e relatórios; a fonte de verdade passa a ser a nova tabela.
- Frontend: `useProcessos` e `Processos.tsx` trazem as coordenações responsáveis agregadas; novo hook `useProcessoCoordenacoes`; `ProcessoAgendaTab`, `PendenciasProcessoCard`, `useEventosAgenda`, `usePrazos` e `useAudienciasDetectadas` filtram por coordenação do usuário.
- Merge executado em lotes, com log em tabela de auditoria e contagens antes/depois.

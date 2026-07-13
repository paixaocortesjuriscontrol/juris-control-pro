## Objetivo

Na tela **Análise DJEN**, ao criar Tarefa / Prazo / Evento / Audiência a partir de uma publicação, usar **exatamente os mesmos formulários** do Painel de Controle e as **mesmas regras de coordenação**:

- Não-admin: mostra apenas as coordenações às quais pertence.
- Se o usuário só tem uma coordenação → o seletor não aparece (fica implícito).
- Se tem mais de uma → seletor visível e escolha **obrigatória**.
- Admin → vê todas, escolha obrigatória.
- Toda Tarefa, Prazo, Evento e Audiência criada deve ter `coordenacao_id` preenchido (validação de submit).

## Situação atual

- `EventoDialog` e `PrazoDialog`: já são os mesmos do Painel e já usam `useCoordenacoesDoUsuario` + `CoordenacaoSelect`. Falta apenas tornar a coordenação **obrigatória** para admin/multi-coord.
- `AudienciaFormSimplificado` (usado dentro de `NovaAudienciaPublicacaoDialog`): já é o mesmo do Painel. Falta obrigar a coordenação.
- `CriarTarefaPublicacaoDialog` (DJEN): é um **formulário paralelo/custom** — não usa `useCoordenacoesDoUsuario`, não filtra membros pela coordenação do usuário, e não obriga coordenação. Precisa ser substituído.

## Mudanças

### 1. Tarefa — usar `NovaTarefaDialog` do Painel
- Estender `NovaTarefaDialog` para aceitar contexto de publicação DJEN:
  - Nova prop opcional `publicacao?: PublicacaoUnificada` (mostra painel lateral com o conteúdo da publicação e ativa o botão “Preencher com IA”).
  - Ao salvar com `publicacao` presente: gravar o vínculo em `tarefas_publicacoes` (termo) ou `tarefas_publicacoes_processos` (processo), setar `origem = 'analise_djen'`, marcar a publicação como lida — mesma lógica do dialog atual.
- Em `AnaliseDjen.tsx`, substituir `CriarTarefaPublicacaoDialog` por `NovaTarefaDialog` (com wrapper que passa `coordenacoes`, `publicacao`, `processoPreSelecionado`).
- Remover `CriarTarefaPublicacaoDialog.tsx` após migração (arquivo não é mais referenciado em outras telas).

### 2. Coordenação obrigatória nos 4 formulários
Ajustar `NovaTarefaDialog`, `EventoDialog`, `PrazoDialog` e `AudienciaFormSimplificado`:
- Schema/validação: quando `precisaSelecionar === true` (usuário admin ou com múltiplas coordenações), exigir `coordenacao_id` não-vazio antes do submit — bloquear salvar com mensagem clara.
- Quando `precisaSelecionar === false` e existe `unicaCoordenacaoId`: aplicar automaticamente e ocultar o seletor (comportamento atual do hook; garantir consistência).
- O `CoordenacaoSelect` continua respeitando o hook `useCoordenacoesDoUsuario` (admin vê todas, demais só as suas).

### 3. Sem mudanças de banco
Todas as tabelas envolvidas (`tarefas`, `eventos_agenda`, `audiencias_detectadas`) já possuem `coordenacao_id`. A obrigatoriedade é aplicada no front — a app já é a única via de criação para esses fluxos.

## Detalhes técnicos

- Hooks reutilizados: `useCoordenacoesDoUsuario`, `useCoordenacaoPadrao`.
- `NovaTarefaDialog` recebe novo prop `publicacao` + renderiza painel lateral (mesmo padrão de `NovaAudienciaPublicacaoDialog`: split lg:2-colunas quando há publicação).
- Reaproveitar `BotaoPreencherIA` (já usado no dialog atual) dentro do `NovaTarefaDialog` quando `publicacao` estiver presente.
- `AnaliseDjen.tsx`: atualizar apenas os 2 pontos onde `CriarTarefaPublicacaoDialog` é renderizado/importado.

## Fora de escopo

- Nenhuma alteração em outros pontos que usam `NovaTarefaDialog`, `EventoDialog`, `PrazoDialog` ou `AudienciaFormSimplificado` (Painel, Delegação, Agenda) — todos continuam funcionando; o único efeito colateral é a nova obrigatoriedade de coordenação para admin/multi-coord, que já é o comportamento desejado globalmente segundo o pedido.

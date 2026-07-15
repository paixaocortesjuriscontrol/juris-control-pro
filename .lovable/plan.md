## Objetivo

Ao clicar em **Novo Processo** na lista de Processos e Casos, abrir **a mesma tela de detalhe do processo** (mesmo layout, abas laterais, cards, botão Judit, botão Buscar Dados, campos idênticos) — porém com o formulário **em branco**, ao invés de abrir um modal (`ProcessoFormDialog`).

Após o primeiro **Salvar**, o processo é criado e a URL passa a apontar para o registro real (`/processos/:id`), habilitando as abas dependentes (Andamentos, Prazos, Audiências, Pub. DJEN, etc.).

## Como funciona hoje

- `src/pages/Processos.tsx` linha 795: botão `Novo Processo` seta `showFormDialog=true` e abre `ProcessoFormDialog` (modal com abas Dados Básicos / Tribunal / Partes / Administrativo / Contingencial / Documentos / Análise Judit / Anexos Judit).
- Edição inline hoje vive em `src/pages/ProcessoDetalhes.tsx` (rota `/processos/:id`) que carrega o processo por id via React Query e renderiza toda a lateral (Visão Geral, Tarefa, Prazo, Audiência, Pub. DJEN, Andamentos, etc.) mais cards à direita (Pendências, Depósitos, Custas).

## Mudanças

**1. Nova rota `/processos/novo`**
- Em `src/App.tsx`, registrar `<Route path="/processos/novo" element={<ProtectedRoute><ProcessoDetalhes /></ProtectedRoute>} />` **antes** de `/processos/:id`.

**2. Modo criação em `ProcessoDetalhes.tsx`**
- Detectar via `useParams`/`useLocation` quando estamos em `/processos/novo` → flag `isNovo`.
- Quando `isNovo=true`:
  - Não executar `useQuery` do processo (ou retornar objeto vazio com defaults: `tipo_processo='judicial'`, `situacao='ativo'`, `area='civel'`, sem `id`).
  - Renderizar **direto a aba "Visão Geral"** em modo edição (reaproveitando `ProcessoEditarCompleto` ou o formulário inline já existente), com todos os campos vazios.
  - Ocultar/desabilitar itens da sidebar de detalhe que exigem processo existente: Tarefa, Evento, Prazo, Audiência, Pub. DJEN, Redistribuições, Andamentos, Pedidos, Cobrança, Análise Judit, Distribuições, Comentários, Pasta (deixar apenas Visão Geral ativa e mostrar tooltip "Disponível após salvar").
  - Ocultar cards laterais (Pendências, Depósitos Recursais, Custas) — todos dependem de `processo.id`.
  - Botão **Judit** e **Buscar Dados**: manter funcionando exatamente como no modal atual (usam apenas o número CNJ digitado — não exigem `processo.id`). Reaproveitar handlers de `ProcessoFormDialog`.
  - Botão **Salvar** cria via `supabase.from("processos").insert({...})` respeitando validações atuais do modal (número obrigatório, área obrigatória etc.). No sucesso: `navigate('/processos/' + novo.id, { replace: true })` — a partir daí a página vira o modo detalhe normal com todas as abas ativas.
  - Título/breadcrumb: "Novo Processo" ao invés de nome das partes.

**3. Botão "Novo Processo" em `Processos.tsx`**
- Trocar `onClick={() => setShowFormDialog(true)}` por `onClick={() => navigate('/processos/novo')}`.
- Remover renderização do `<ProcessoFormDialog ... />` **quando usado para criação** (mantém apenas se ainda for usado para editar — verificar `processoToEdit`). Se toda edição já é inline em `ProcessoDetalhes`, remover totalmente o dialog e o state `showFormDialog`.

**4. Reaproveitamento**
- Extrair de `ProcessoFormDialog` os handlers `buscarDadosCNJ` e `buscarJudit` para um hook `useProcessoBuscas` (ou copiar direto para `ProcessoDetalhes` no modo novo). Assim o botão Judit funciona igual.

## Detalhes técnicos

- Ordem das rotas em `App.tsx` importa: `/processos/novo` **antes** de `/processos/:id` (senão `id="novo"` é capturado como uuid).
- No modo `isNovo`, guarda de segurança: qualquer `useQuery(['processo', id])` só roda se `id && id !== 'novo'` — usar `enabled: !!id && id !== 'novo'`.
- Componentes de aba (`ProcessoAgendaTab`, `ProcessoDocumentosTab`, `ProcessoPortalTab`, `ProcessoPedidosTab`, etc.) não precisam ser tocados — basta não renderizá-los.
- Após criar, `invalidateQueries(['processos'])` para atualizar a lista.

## Fora de escopo

- Não altero o layout visual da tela de detalhe.
- Não mexo em edição de processos já existentes (continua inline como está hoje).
- Mantenho `ProcessoFormDialog` no repositório caso ainda seja chamado de outros lugares (Coordenações, Pastas) — busca rápida antes de deletar.

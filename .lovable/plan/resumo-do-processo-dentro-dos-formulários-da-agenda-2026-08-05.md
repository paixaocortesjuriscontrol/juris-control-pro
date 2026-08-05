# Resumo do processo dentro dos formulários da agenda

## Objetivo
No card "Processo vinculado" (dentro dos formulários de prazo, tarefa, evento, audiência abertos pelo Painel de Controle), permitir ver um resumo do processo sem sair do formulário. O botão "Ver processo" continua existindo; ao lado dele entra um novo botão "Detalhar" que expande um card com os principais campos da Visão Geral.

## Comportamento
- Card compacto (como hoje): número CNJ + "Ver processo" + "Detalhar".
- "Detalhar" expande/recolhe, dentro do mesmo formulário, um bloco com:
  - Partes: Polo ativo / Reclamante e Polo passivo / Reclamados, terceiro envolvido
  - Cliente vinculado
  - Valores: valor da causa, valor da condenação, valor provisionado (formato R$ pt-BR)
  - Órgão: tribunal, vara, comarca, UF, órgão julgador
  - Situação: status, fase, área/matéria, tipo do processo
  - Datas: distribuição e data fatal quando existirem
  - Objeto da ação / pedidos (texto com no máximo algumas linhas, sem cortar palavra)
- Campos vazios são omitidos (nada de "—" repetido).
- Os dados são buscados apenas quando o usuário clica em "Detalhar" (consulta sob demanda, com cache do React Query).
- Clicar no número do processo também abre o resumo (mesma ação do "Detalhar").

## Onde aplica
- `PrazoDialog` (prazos e tarefas criados pelo botão Adicionar) — é onde o card já existe.
- `EventoDialog` e `EditarAudienciaDialog`, no bloco de processo selecionado, para o comportamento ficar igual em toda a agenda.
- `TarefaDetalhesDialog` e `TarefaDetalhesPanel` (delegação), que já mostram "Processo vinculado".

## Detalhes técnicos
- Novo componente `src/components/processos/ProcessoResumoCard.tsx`:
  - Props: `processoId`, `numero`, `onVerProcesso`.
  - Estado interno `aberto`; `useQuery(["processo-resumo", processoId], { enabled: aberto })` selecionando só as colunas exibidas de `processos`.
  - Layout em grade de 2 colunas com tokens semânticos (`bg-muted/40`, `text-muted-foreground`), sem cores fixas.
  - Formatação de moeda e datas reutilizando `Intl` / `src/utils/date.ts` (datas em DD/MM/AAAA).
- Substituir o bloco atual do card em `PrazoDialog.tsx` por esse componente, mantendo a navegação existente (`onOpenChange(false)` + `navigate`).
- Nenhuma mudança de banco, RLS ou lógica de salvamento.

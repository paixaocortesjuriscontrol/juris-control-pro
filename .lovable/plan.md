# Plano — Botão "Adicionar" da tela Análise DJEN

## Objetivos
1. Garantir que o processo da publicação seja **importado/visível na tela Processos** quando criado pelo botão Adicionar.
2. Adicionar um **seletor de Coordenação** em todos os formulários (Tarefa, Prazo, Evento, Audiência) abertos pelo botão Adicionar, **pré-preenchido com a coordenação do usuário logado**.
3. **Restaurar o campo "Prazo Fatal" (data_fatal)** no `PrazoDialog` (usado em Análise DJEN e no Painel de Controle).
4. Exibir a **publicação vinculada** na tela **Painel de Controle** e na tela **Processo (interno)** quando a tarefa tiver sido criada a partir da Análise DJEN.

## Mudanças

### 1. Importação do processo aparecer em "Processos"
Arquivo: `src/lib/ensureProcessoFromPublicacao.ts`
- Já cria pasta + processo + responsável + movimentação. Ajustes:
  - Receber `coordenacaoId` escolhido no formulário (parâmetro opcional, fallback para coordenação do usuário) e usá-lo no `coordenacao_id` do processo.
  - Após criar, invalidar `["processos"]` e `["pastas"]` (já feito na chamada — manter).
  - Garantir `data_distribuicao` / outros campos mínimos para o processo aparecer nos filtros padrão da tela Processos (revisar `useProcessos`/`useProcessosPaginados` se houver filtro que esconda esses processos).

### 2. Seletor de Coordenação nos formulários do "Adicionar"
Componente novo: `src/components/shared/CoordenacaoSelect.tsx`
- Lista coordenações do usuário (admin = todas; demais = `membros_coordenacao` + coordenadas).
- Default = coordenação do usuário logado (mesma lógica já usada em `TstPrazos`).

Integrar o `CoordenacaoSelect` em:
- `src/components/djen/CriarTarefaPublicacaoDialog.tsx`
- `src/components/prazos/PrazoDialog.tsx`
- `src/components/agenda/EventoDialog.tsx`
- `src/components/djen/NovaAudienciaPublicacaoDialog.tsx`

A coordenação selecionada será:
- Repassada para `ensureProcessoFromPublicacao` (criar/atualizar `coordenacao_id` do processo recém-criado).
- Persistida em `processos.coordenacao_id` (a tabela `tarefas` não tem `coordenacao_id` — a coordenação fica via processo, mantendo o padrão atual).

Em `AnaliseDjen.tsx`, ajustar `resolverProcessoDaPublicacao` para receber a coordenação escolhida no diálogo (ou já abrir o diálogo com o default e passar para o ensure quando o usuário salvar).

### 3. Restaurar "Prazo Fatal" no PrazoDialog
Arquivo: `src/components/prazos/PrazoDialog.tsx`
- Adicionar estado `dataFatal: Date | undefined` e campo de input (date picker) ao lado de "Data limite", rotulado **"Prazo Fatal"**.
- Incluir no payload de create/update de prazo: `data_fatal: format(dataFatal, "yyyy-MM-dd") | null`.
- Carregar `prazo.data_fatal` no modo edição.
- Como o `PrazoDialog` é usado tanto na Análise DJEN quanto no Painel de Controle, a mesma alteração resolve ambos os cenários pedidos.

### 4. Publicação vinculada no Painel de Controle e Processo Interno
- **Processo interno** (`ProcessoDetalhes.tsx` / `ProcessoDetalhesCompletos.tsx`): já usa `TarefaPublicacaoView`. Confirmar que tarefas criadas via `tipo_origem === "processo"` aparecem (já há suporte) e, se necessário, ajustar o filtro para incluir vínculos via `tarefas_publicacoes` (termo) — atualmente parece focar em vínculo por processo.

- **Painel de Controle** (`src/pages/PainelControle.tsx` → `EdicaoItemPanel` → `NovaTarefaDialog`): hoje não exibe publicação vinculada. Adicionar bloco no `NovaTarefaDialog` (modo edição) que:
  - Consulta `tarefas_publicacoes` e `tarefas_publicacoes_processos` por `tarefa_id`.
  - Se houver vínculo, busca a publicação e renderiza o conteúdo (reaproveitando a apresentação usada em `TarefaAgendaPanel` — extrair em componente `TarefaPublicacaoVinculada` para reuso).

## Detalhes técnicos
- Não há coluna `coordenacao_id` em `tarefas`; a coordenação continua sendo atributo do **processo** (já validado via `information_schema`).
- `tarefas.data_fatal` já existe (`date`) — apenas falta UI no PrazoDialog.
- Vínculos publicação ↔ tarefa já são gravados pelos dialogs novos (`CriarTarefaPublicacaoDialog`, `PrazoDialog`, `EventoDialog`, `NovaAudienciaPublicacaoDialog`). Apenas a exibição precisa ser propagada para o Painel de Controle.
- Nenhuma migração SQL é necessária.

## Arquivos a alterar
- `src/lib/ensureProcessoFromPublicacao.ts`
- `src/pages/AnaliseDjen.tsx`
- `src/components/shared/CoordenacaoSelect.tsx` (novo)
- `src/components/shared/TarefaPublicacaoVinculada.tsx` (novo, extraído do `TarefaAgendaPanel`)
- `src/components/djen/CriarTarefaPublicacaoDialog.tsx`
- `src/components/prazos/PrazoDialog.tsx`
- `src/components/agenda/EventoDialog.tsx`
- `src/components/djen/NovaAudienciaPublicacaoDialog.tsx`
- `src/components/delegacao/NovaTarefaDialog.tsx` (mostrar publicação vinculada)
- `src/pages/ProcessoDetalhes.tsx` / `ProcessoDetalhesCompletos.tsx` (revisar filtro de publicações vinculadas)


# Plano — Correções abrangentes (Processos, Publicação, DJEN, Painel, Pedidos, Audiências)

Implementação em sequência, agrupada em blocos coerentes. Cada bloco é auto-contido e verificável.

---

## Bloco 1 — Diálogo de Publicação (anexo 1)

Arquivo principal: `src/components/djen/PublicacaoDialog.tsx` (e formulário embutido de criação de tarefa).

- **a) Data verde de ontem**: a data mostrada no cartão verde ("Tarefas criadas") está usando `new Date()` local e/ou dia anterior por fuso. Trocar para `format(parseISO(prazo.data_prevista), "dd/MM/yy")` sem `new Date(string)`.
- **b) Não fechar o modal ao criar prazo/tarefa**:
  - Remover `onOpenChange(false)` do `onSuccess` do form embutido.
  - Após criar, resetar campos e manter dialog aberto; mostrar toast e append no bloco "Tarefas criadas".
  - Adicionar botão **"Adicionar"** (secundário) além de "Criar Tarefa" que faz o mesmo, mas com foco no primeiro campo após criar (criação contínua).
- **c) Coordenação pré-selecionada**: usar novo campo `profiles.coordenacao_padrao_id`. Fallback: primeira coordenação do usuário via `membros_coordenacao`.
- **d) Envolvidos igual aos Responsáveis**: substituir o seletor atual pelo mesmo componente `PeoplePicker`/`MultiUserSelect` usado em Responsáveis (com abas "Minha Resp. & Envolv." / "Tarefas a Concluir" conforme anexo 6). Padronizar visual e comportamento.
- **e) Prazo vs Tarefa** (item mais estrutural — ver Bloco 2).

## Bloco 2 — Separar Prazo de Tarefa (comportamento distinto)

Hoje ambos vivem em `tarefas`. Vamos:

1. **Migration**: adicionar `tarefas.tipo_registro TEXT NOT NULL DEFAULT 'tarefa' CHECK (tipo_registro IN ('tarefa','prazo'))`. Backfill: registros com `data_fatal IS NOT NULL` → `'prazo'`.
2. **Validações**:
   - Prazo: `data_fatal` obrigatória; entra em Prazos Fatais e no Kanban de Prazos.
   - Tarefa: `data_fatal` opcional; `data_prevista` obrigatória.
3. **UI**:
   - Formulário de criação com toggle Tipo (Prazo/Tarefa) que altera campos e validação.
   - Card lateral "Pendências do Processo" (anexo 2): badge **PRAZO** (vermelho) vs **TAREFA** (azul); ordenação: prazos primeiro por proximidade da data_fatal.
   - Detalhe: exibir corretamente "Fatal:" só para prazo.
4. **Hooks**: `usePrazos` filtra `tipo_registro='prazo'`; `useTarefas` filtra `'tarefa'`. Query keys separadas.

## Bloco 3 — Pendências do Processo (anexo 2/3)

Componente: `PendenciasProcesso*` (na tela `/processos/:id`).

- **Diferenciar** Prazo × Tarefa via badge/cor.
- **Mostrar audiências**: unir `audiencias_detectadas` + eventos manuais do processo, mesmo card "Pendências". Nova seção "Audiências" no card de pendências com badge amarelo.
- **Aba Audiências**: corrigir a query — hoje ela não lista audiências criadas via `CriarAudienciaProcessoDialog`. Verificar filtro `processo_id` vs `numero_processo`. Padronizar por `processo_id` UUID.
- **Aba Intimações**: revisar lógica (parâmetros de fetch, join com `intimacoes_detectadas`); garantir mesmo padrão dos outros cards.

## Bloco 4 — Pub. DJEN e demais abas do processo

- Ao **salvar publicação vinculada** (dialog), invalidar queries de `publicacoes_djen_processos` e `publicacoes_djen` filtradas pelo `processo_id` para aparecer imediatamente na aba **Pub. DJEN**. Idem Andamentos, Redistribuições, Intimações.
- **Intimações**: adicionar `ItemComentarios` (mesmo componente usado em tarefas/audiências) na visão de detalhe da intimação.

## Bloco 5 — Análise DJEN (ações em lote e cards)

Arquivo: `src/pages/MonitoramentoDjen.tsx` + `AcoesEmLoteDialog`.

- **Ações em lote respeitam seleção**: se houver seleção, aplicar apenas nas selecionadas; se vazio, exigir seleção (removendo comportamento "aplica em tudo").
- **Cards clicáveis** (totais por status/tribunal/coordenação): ao clicar, filtrar a lista abaixo. Estado local + query params.
- **Importar publicação → importar partes separadamente**: no fluxo `ensureProcessoFromPublicacao`, extrair a seção "Parte(s):" e criar/upsert em `processos_partes` **um registro por parte**, com `tipo_parte` inferido (autor/réu) quando possível; hoje está tudo em um único campo.

## Bloco 6 — Processos & Casos (lista principal)

- **Remover botão "Importar"**.
- **Corrigir botão "Exportar"**: gerar XLSX real das linhas visíveis (respeitando filtros ativos). Colunas mínimas: número, cliente, coordenação, situação, área, tribunal, última movimentação, valor.
- **Judit**: corrigir mapeamento do preenchimento do formulário. Rever `useJuditPreencher` (ou equivalente): campos alvo (assunto, classe CNJ, área, órgão julgador, tribunal, instância, partes, vínculo/último cargo) e a estrutura de resposta.

## Bloco 7 — Pedidos (anexo 5)

`PedidosEditableTable` / dialog "Novo Pedido":

- Input "Pedido" não aceita digitação: provável `readOnly`/estado controlado sem `onChange`. Corrigir.
- **Remover campo "Lei"** do formulário e da tabela (manter coluna se existir dado histórico, apenas não editar/exibir na criação).

## Bloco 8 — Audiências

- **Criar audiência a partir do processo**: verificar `AudienciaFormSimplificado.onSuccess`; hoje falha ao gravar (provavelmente `processo_id` ausente quando `defaultProcessoId` é passado). Corrigir persistência e revalidação da aba.
- **Testar todos os tipos**: instrução, conciliação, una, telepresencial.
- Aparecer no card **Pendências** com badge amarelo.

## Bloco 9 — Eventos com recorrência

- Migration: adicionar em `eventos_agenda`:
  - `recorrencia_rrule TEXT NULL` (RFC 5545)
  - `recorrencia_ate DATE NULL`
- UI (`EventoDialog`): novo bloco "Recorrência" com presets (nenhuma, diária, semanal, mensal, anual) + "Até" (data limite). Gera RRULE.
- Expansão em tempo de exibição (rrule.js) no calendário/painel; comentários/participantes ficam no registro-mãe.

## Bloco 10 — Painel de Controle (anexo 6)

`src/pages/Index.tsx` (Painel).

- **Cards totalizadores clicáveis** e coloridos:
  - Tarefas = **azul**
  - Prazos = **vermelho**
  - Audiências = **amarelo**
  - Eventos = **verde**
- Clique aplica filtro `tipo` na lista abaixo.
- **Filtros melhorados**:
  - Datas: dois `input[type=date]` com "Data Prevista de/até" e "Data Fatal de/até" (digitáveis).
  - Responsável / Envolvido (`PeoplePicker` como no anexo 6).
  - Coordenação (default = coordenação padrão do usuário).
- **Exportar Excel**: botão "Gerar Excel" que respeita todos os filtros e exporta cada tipo em abas (Tarefas, Prazos, Audiências, Eventos) com colunas: título, processo, cliente, responsáveis, data prevista, data fatal, status, prioridade.

## Bloco 11 — Perfil: coordenação padrão

- Migration em `profiles`: `coordenacao_padrao_id UUID REFERENCES coordenacoes(id)`.
- Tela **Configurações → Meu Perfil**: select de coordenações do usuário para definir a padrão.
- Todos os formulários com campo Coordenação passam a usar esse valor como default (via novo hook `useCoordenacaoPadrao`).

---

## Detalhes técnicos

### Migrations previstas
1. `ALTER TABLE tarefas ADD COLUMN tipo_registro TEXT NOT NULL DEFAULT 'tarefa' CHECK (tipo_registro IN ('tarefa','prazo'));` + backfill + índice.
2. `ALTER TABLE eventos_agenda ADD COLUMN recorrencia_rrule TEXT, ADD COLUMN recorrencia_ate DATE;`
3. `ALTER TABLE profiles ADD COLUMN coordenacao_padrao_id UUID REFERENCES coordenacoes(id);`
4. `ALTER TABLE pedidos_processo` (opcional) — manter `lei` no schema, apenas remover da UI.

### Bibliotecas
- `rrule` (`bun add rrule`) para recorrência.
- `xlsx`/SheetJS (já usado) para exportações.

### Arquivos-chave a tocar
- `src/components/djen/PublicacaoDialog.tsx`
- `src/components/prazos/*` (form + panel + card pendências)
- `src/components/processos/*` (Pendências, aba Audiências, aba Intimações, aba Pub. DJEN, aba Pedidos, botões toolbar, Judit)
- `src/pages/MonitoramentoDjen.tsx` + `AcoesEmLoteDialog`
- `src/pages/Index.tsx` (Painel de Controle)
- `src/components/agenda/EventoDialog.tsx`
- `src/lib/ensureProcessoFromPublicacao.ts` (parsing de partes)
- `src/hooks/usePrazos.ts`, `useTarefas.ts`, novo `useCoordenacaoPadrao.ts`
- `src/pages/Configuracoes.tsx` (coordenação padrão)

### Verificação
Após cada bloco: build/typecheck automático + smoke via Playwright em `/painel-controle`, `/processos/:id`, dialog de publicação, e Análise DJEN.

---

Confirma que posso seguir por essa ordem (Bloco 1 → 11)? Se quiser inverter alguma prioridade (ex: começar pelo Painel de Controle porque a Dra. usa mais), me avise antes de eu partir para a implementação.

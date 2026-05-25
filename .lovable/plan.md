## Problema

A tela `ImportarTarefas` (aba Projuris) demora muito (milhares de linhas → vários minutos) e o feedback é um único `<Progress />` com o texto "Importando tarefas..." sem detalhes. Lendo `src/pages/ImportarTarefas.tsx` (linhas 582–830), identifiquei os gargalos:

1. **Round-trips sequenciais por linha** dentro do batch:
   - `findResponsavelId` → procura/cria perfil (chama Edge Function `cadastrar-perfil` 1×/usuário novo, sequencial).
   - `findOrCreateProcessoId` → `insert` em `processos` 1×/processo novo, sequencial.
   - Tarefas já existentes: `await supabase.from("tarefas").update(...)` 1× por linha.
   - `vincularResponsavelAoProcesso` → `SELECT` + `INSERT` + `SELECT` + `UPDATE` 1× por linha após inserir.
   Resultado: 4–6 round-trips por linha × milhares de linhas = lento mesmo com batch de 100.

2. **Fallback de erro problemático**: se o `insert` em lote falha, reinsere cada item sequencialmente, e itens que poderiam ter sucesso são tentados de novo gerando duplicidade/erro.

3. **Progresso opaco**: só atualiza ao final de cada lote de 100, sem fase atual, sem contadores em tempo real, sem ETA, sem indicar o que está rodando (criando usuários? processos? inserindo? vinculando?).

## Solução proposta

### A) Pipeline em fases (pré-resolução em massa) — ganho principal de performance

Substituir o loop atual por 4 fases sequenciais, cada uma em lote:

```text
[1/4] Resolvendo processos     ────────────  X / Y
[2/4] Resolvendo responsáveis  ────────────  X / Y
[3/4] Inserindo/atualizando    ────────────  X / Y  (lote N de M)
[4/4] Vinculando responsáveis  ────────────  X / Y
```

- **Fase 1 — Processos**: deduplica todos os `numeroProcesso` da planilha → 1 `SELECT ... IN (...)` (em chunks de 500) → coleta os ausentes → 1 `INSERT` em lote (chunks de 200) com todos os novos processos. Resultado: 1 mapa `numero → id` na memória.
- **Fase 2 — Responsáveis**: deduplica todos os nomes de `responsaveis` → matching local contra `profiles` (já carregado) → para os ausentes, chamar `cadastrar-perfil` em paralelo limitado (Promise pool, ex.: 6 concorrentes) ao invés de sequencial.
- **Fase 3 — Inserir/atualizar tarefas**:
  - 1 `SELECT` upfront dos `identificador_projuris` existentes (já existe).
  - Para existentes: agrupar em lotes e fazer `UPDATE` via `upsert` (com `onConflict: identificador_projuris`) ao invés de 1 update por linha.
  - Para novas: `INSERT` em lote de 200 (sem fallback per-row em caso de erro; em vez disso, dividir o lote em 2 recursivamente até isolar o erro — bem mais rápido que retry per-row).
- **Fase 4 — Vincular responsáveis ao processo**:
  - Pré-carregar `processos_responsaveis` para o conjunto de `processo_id` envolvidos em 1 query, montar `Set<processo_id|usuario_id>`.
  - Filtrar pares novos → 1 `INSERT` em lote.
  - Atualizar `advogado_responsavel_id` apenas onde está NULL com 1 `UPDATE` por usuário (chunks).

### B) Barra de progresso detalhada

Novo componente de progresso que mostra:

- **Fase atual** (1/4, 2/4, ...) com label descritivo.
- **Barra por fase** + barra geral ponderada (processos 10%, responsáveis 15%, inserção 60%, vínculos 15%).
- **Contadores em tempo real**: "X / Y", "N novos usuários", "P novos processos", "S sucesso / E erros".
- **ETA estimado** a partir da velocidade média (linhas/seg) das últimas 5s.
- **Linha atual** (ex.: "Inserindo lote 3 de 21 — 300 / 4081 tarefas").
- **Botão Cancelar** mantém comportamento; entre fases, checar `cancelledRef`.

Componente novo: `src/components/tarefas/ImportProgress.tsx` (UI puro recebendo `phase`, `phaseProgress`, `overallProgress`, `counters`, `eta`).

### C) Outros ajustes

- Manter API/colunas do banco; nenhuma migração.
- Aplicar a mesma estrutura na aba Ástrea, reaproveitando o mesmo componente de progresso (sem refazer toda a lógica agora — só a barra).
- Manter contadores de cabeçalho (Total / Válidas / Inválidas / Importadas / Erros / Concluídas) sincronizados a cada fase.
- Logs `console.time` por fase para diagnosticar regressões.

## Estimativa de ganho

Para 4.000 linhas com ~500 processos novos e ~50 usuários novos:
- Hoje: ~4.000 × (3–5 awaits sequenciais) ≈ 12k–20k round-trips.
- Depois: ~50 (paralelo) + ~5 (processos em lote) + ~20 (insert tarefas em lote) + ~5 (vínculos em lote) ≈ **80 round-trips**.
Esperado: redução de minutos para segundos/dezenas de segundos.

## Arquivos afetados

- `src/pages/ImportarTarefas.tsx` — refatorar `handleImport` em fases; novo state `importPhase`, `phaseCounters`.
- `src/components/tarefas/ImportProgress.tsx` — novo componente.
- (opcional) extrair helpers para `src/lib/importTarefasPipeline.ts` para isolar fases e facilitar manutenção.

Sem mudanças de schema, sem mudanças nas demais telas.
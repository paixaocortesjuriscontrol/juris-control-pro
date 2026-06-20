## Contexto

O picker de 3 horários (`HorariosDoDiaPicker`) já está montado em `/djen-servidor` para os 3 cards (DJEN Termos, DJEN Kurier, DJEN Pautas), mas:
- Você relata que não vê o picker no DJEN Termos — vou validar com screenshot e, se necessário, ajustar UI/labels para deixar claro (hoje aparece dentro do bloco "Agendamento do servidor"). Confirmaremos no preview.
- Falta seleção de **dias da semana** em todos os 3 cards.
- Falta a tela **Análise DJEN Servidor** (cópia da Análise DJEN, lendo só `publicacoes_djen_servidor`).

## Mudanças

### 1. Dias da semana (todos os 3 cards do `/djen-servidor`)

- Componente novo `src/components/djen/DiasSemanaPicker.tsx`: 7 toggles (Seg–Dom). Default = Seg–Sex quando vazio.
- Persistência: campo `metadata.dias_semana` (int[] 0–6, 0=Dom) em `configuracoes_monitoramento_servidor` — sem migration, já é jsonb.
- Dispatcher (`supabase/functions/dispatcher-servidor/index.ts`): ao iterar slots do dia, verifica `dayOfWeek BRT ∈ dias_semana`; se não, pula. Default Seg–Sex se ausente.

### 2. Picker de horários no DJEN Termos

- Validar visualmente no preview com Playwright. O componente já é renderizado para todos os tipos; provavelmente é só uma questão de scroll/altura do card. Se preciso, reorganizar o bloco "Agendamento do servidor" para o topo do `CardContent`.

### 3. Tela `Análise DJEN Servidor`

- Nova rota `/analise-djen-servidor` (AdminRoute), nova entrada no Sidebar (logo abaixo de "DJEN Servidor").
- Novo arquivo `src/pages/AnaliseDjenServidor.tsx`: **cópia fiel** de `AnaliseDjen.tsx`, mudando só:
  - título da página → "Análise DJEN Servidor"
  - hook de dados → `usePublicacoesDjenServidorUnificadas`
- Novo hook `src/hooks/usePublicacoesDjenServidorUnificadas.ts`: cópia de `usePublicacoesDjenUnificadas.ts` substituindo:
  - `from('publicacoes_djen')` → `from('publicacoes_djen_servidor')`
  - mantém `publicacoes_djen_leituras` / `publicacoes_djen_descartadas` / `publicacoes_djen_processos` como estão (são compartilhados; servidor ainda não escreve em `processos`, então a aba processos vai aparecer vazia — esperado).
  - chaves de cache do React Query ganham sufixo `-servidor` para não colidir.
- Zero alteração em `AnaliseDjen.tsx` e `usePublicacoesDjenUnificadas.ts`.

### 4. Validação das 3 execuções

- Após deploy: rodar dispatcher manualmente via Playwright/SQL e confirmar que 3 slots no mesmo dia geram 3 linhas distintas em `execucoes_servidor` (com `rodada_do_dia` 1/2/3 e `slot_horario` correto). Ajustar se a dedupe key do RPC `enfileirar_execucao_servidor` rejeitar a 2ª/3ª execução.

## Detalhes técnicos

- `metadata.dias_semana` é lido tanto no dispatcher quanto no UI (default `[1,2,3,4,5]`).
- Card "Novas publicações" da Análise DJEN Servidor lê `execucoes_servidor` (filtrando `tipo` ∈ `{djen_paralela_servidor, kurier_servidor, djet_pautas_servidor}`) e cruza com `publicacoes_djen_servidor` pelo dia BRT para mostrar quantas vieram em cada rodada.
- Nenhuma alteração nas engines `paralela.js` / `kurier.js` / `pautas.js` — elas já gravam `coordenacao_id` e `id_djen` em `publicacoes_djen_servidor`.

## Arquivos

- novo: `src/components/djen/DiasSemanaPicker.tsx`
- novo: `src/pages/AnaliseDjenServidor.tsx`
- novo: `src/hooks/usePublicacoesDjenServidorUnificadas.ts`
- editar: `src/pages/DjenServidor.tsx` (integra DiasSemanaPicker em cada card)
- editar: `supabase/functions/dispatcher-servidor/index.ts` (respeita dias_semana)
- editar: `src/App.tsx` (rota)
- editar: `src/components/layout/Sidebar.tsx` (entrada)

## Fora de escopo

- Card de "Novas publicações" na `AnaliseDjen.tsx` original (será apenas na cópia Servidor).
- Migração de schema (não há tabela nova).
- Mudanças em engines / matching / dedupe.

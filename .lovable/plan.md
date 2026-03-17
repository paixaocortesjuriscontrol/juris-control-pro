
Diagnóstico objetivo (com evidência de produção):

1) O gargalo principal não é “falta de índice simples”.  
- Para a coordenação do Dr. Thomás: 500 registros brutos hoje em `publicacoes_djen`, mas 222 após deduplicação (bate com o relato).
- `EXPLAIN ANALYZE` mostrou:
  - `count_djen_publicacoes_unificadas`: ~2.79s
  - `get_djen_publicacoes_unificadas` (200 itens): ~2.80s
- As queries base (sem dedup por regex) rodam em ~1–11ms.  
Conclusão: o custo está no cálculo de dedup em tempo real (`strip_destinatarios + regexp_replace + lower + left`) em conteúdo grande, repetido várias vezes.

2) O frontend amplifica a lentidão:
- Hoje ele chama `count_djen_publicacoes_unificadas` + páginas de `get_djen_publicacoes_unificadas` em sequência.
- Para 222 itens: 1 count + 2 páginas => ~8s só nessas RPCs.
- Na primeira carga ainda pode disparar consulta sem coordenação definida (estado inicial), piorando o TTFB.

Plano de implementação (focado em ganho real):

Fase 1 — ganho imediato (rápido e baixo risco)
- `src/hooks/usePublicacoesDjenUnificadas.ts`
  - Remover chamada obrigatória de `count_*` para montar paginação.
  - Buscar por páginas até `chunk < PAGE`, começando direto no `get_*`.
  - Adicionar `enabled` no hook para só consultar quando coordenação já estiver inicializada na tela (`!loadingUserCoord && coordenacaoId !== null`).
- `src/pages/AnaliseDjen.tsx`
  - Passar `enabled` ao hook para evitar carga inicial ampla sem coordenação.
Resultado esperado: queda forte do tempo percebido (elimina uma RPC pesada inteira por carregamento).

Fase 2 — correção estrutural no banco (onde está o gargalo real)
- Nova migration:
  - Adicionar colunas pré-computadas de dedup nas tabelas DJEN:
    - `dedup_processo_digits`
    - `dedup_data_ref` (date)
    - `dedup_head_norm` (text curto já normalizado e sem destinatários)
  - Criar trigger `BEFORE INSERT/UPDATE` para preencher essas colunas (e backfill dos dados existentes).
  - Índices compostos “publicações do dia por coordenação” usando esses campos + `created_at/lida` para termos/processos/descartadas.
- Reescrever RPCs:
  - `count_djen_publicacoes_unificadas`
  - `get_djen_publicacoes_unificadas`
  - `marcar_publicacoes_lidas_por_dedup`
  para usar campos pré-computados (sem regex pesada em tempo de consulta).

Fase 3 — validação e segurança de resultado
- Validar no banco (com contexto do usuário Dr. Thomás):
  - `count_*` < 300ms
  - `get_*` (200) < 400ms
- Validar na UI:
  - “Não Lidas” consistente ao marcar/desmarcar filtro.
  - Marcar como lida sem timeout.
  - Carga inicial da Análise DJEN significativamente mais rápida.
- Teste E2E no fluxo real da coordenação do Dr. Thomás.

Entregáveis previstos:
- 1 migration SQL (colunas + trigger + backfill + índices + RPCs otimizadas)
- ajuste do hook unificado
- ajuste da página `AnaliseDjen` para gating de carregamento

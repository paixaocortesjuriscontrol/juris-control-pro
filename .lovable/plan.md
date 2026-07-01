## Correção da execução das 6h + otimizações de banco

### Diagnóstico da execução das 6h BRT

- **Execução das 09:00 UTC (6h BRT) — `6cbfa546…`**: `falhou` com "Heartbeat parado (382s) — worker/VPS derrubado". 95/205 unidades concluídas. Watchdog matou porque uma VPS travou por mais de 6 min.
- **Execução iniciada às 09:39 BRT — `4b39d4a3…`**: ainda `executando` há >1h. Todas as 10 VPS ocupadas, mas gargalo em **TST parte 7/118** e **TRT10 parte 11/83** rodando em série numa VPS só.

### O que vou implementar

#### 1. Motor do servidor (`monitor-servidor/engines/paralela.js`)
- Quebrar unidades grandes em sub-lotes de até 15 termos (mantendo a chave `tipo+tribunal`), para TST/TRT10 rodarem em várias VPS simultaneamente.
- Regras de busca continuam intactas: parte só valida partes, advogado só valida advogados, palavra-chave só valida conteúdo. Sem misturar Browser/Servidor.
- Reduzir frequência de flushes de `progresso` em `execucoes_servidor` (hoje 34.464 updates numa janela recente). Escrever no máximo 1x a cada 3s por unidade — corta ~70% dos UPDATEs.
- Fazer os inserts em `publicacoes_djen_servidor` em lote com `.upsert([...])` de N linhas em vez de 1-a-1 (hoje ~18.000 inserts unitários somando ~50 min de tempo total de DB).

#### 2. Watchdog e retomada
- Aumentar tolerância de heartbeat em `reaper_execucoes_servidor_travadas` de 6 → 10 min.
- Quando reaper marcar `falhou`, disparar automaticamente nova execução aproveitando o checkpoint da coordenação (hoje só o botão "Destravar" faz).

#### 3. UI
- No `DjenServidorParalelaCard`, quando existir execução recente `falhou`, mostrar alerta "Execução das 06:00 falhou (heartbeat) — 95/205 concluídas — Retomar do checkpoint".

#### 4. Índices e banco — cirúrgico

**Adicionar** (queries quentes hoje sem índice ideal):
- `execucoes_servidor (tipo, created_at DESC)` — a listagem "últimas execuções por tipo" tem 25.678 chamadas / 540s totais e faz `Seq/Sort` porque só existe índice em `status,agendado_para`.
- `processos (coordenacao_id, advogado_responsavel_id)` — 28.117 chamadas / 478s totais.

**Remover** (redundantes, encarecem cada INSERT em `publicacoes_djen_servidor` — a tabela mais escrita hoje):
- `idx_pub_djen_servidor_coord` — prefixo já coberto por `idx_pub_djen_servidor_coord_data_dispo`.
- `idx_pub_djen_servidor_data_dispo` — prefixo já coberto por `idx_pub_djen_servidor_data_dispo_created`.
- `idx_pub_djen_servidor_data` (`data_publicacao`) — não aparece em nenhuma query quente; consultas de análise usam `data_disponibilizacao`.

Cada INSERT hoje atualiza ~10 índices; tirando 3 redundantes o custo de escrita cai proporcionalmente, o que também alivia o `max=5,5s` observado nos INSERTs.

**Confirmação a fazer antes de dropar**: rodar `EXPLAIN (ANALYZE, BUFFERS)` numa amostra da query de leitura pertinente antes/depois via `read_query` para garantir que o índice composto absorve.

#### 5. O que não vou tocar
- Motor Browser (Local).
- Regras de validação parte/advogado/palavra-chave.
- Constraint única `(coordenacao_id, id_djen)`.
- Tabelas do Kurier, DJEN local e comparador.

### Ordem de execução após aprovação

1. Migration: adicionar os 2 índices novos e dropar os 3 redundantes.
2. `monitor-servidor/engines/paralela.js`: sub-lotes + throttle de progresso + upsert em lote.
3. Função `reaper_execucoes_servidor_travadas`: 10 min + auto-retomada.
4. UI do card do servidor: banner de execução falhada.
5. Rodar EXPLAIN antes/depois para provar que a leitura continua rápida.

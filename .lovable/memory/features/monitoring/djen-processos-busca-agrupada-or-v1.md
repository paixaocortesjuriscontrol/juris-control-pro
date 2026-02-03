# Memory: features/monitoring/djen-processos-busca-agrupada-or-v1
Updated: 2026-02-03

O monitoramento DJEN Processos foi otimizado com busca agrupada usando sintaxe OR no parâmetro `texto` da API PJE Comunica.

## Ganho de Performance
- **Antes**: ~13.000 requisições individuais, ~2 horas de execução
- **Depois**: ~1.300 requisições agrupadas, ~10-15 minutos de execução
- **Ganho**: 8-12x mais rápido

## Arquitetura
1. **Separação CNJ vs Legado**: Processos com formato CNJ válido (15+ dígitos) usam busca OR; legados usam busca individual
2. **Busca OR**: 10 processos por requisição (`texto=proc1 OR proc2 OR ...`)
3. **Paralelismo**: 3 requisições simultâneas = 30 processos por ciclo
4. **Super-lotes**: Checkpoint a cada 200 processos

## Configuração (BUSCA_AGRUPADA_CONFIG)
- `processosPerRequest`: 10
- `parallelRequests`: 3
- `delayBetweenGroups`: 300ms
- `superBatchSize`: 200
- `delayBetweenSuperBatches`: 1500ms

## Fallback de Erros
1. Se busca OR falhar: retry com metade do grupo
2. Se continuar falhando: fallback para busca individual
3. Rate limit (429): backoff exponencial já implementado

## Arquivos Modificados
- `src/utils/pjeComunicaClient.ts`: Adicionadas funções `buscarPjeComunicaMultiplosProcessos`, `isCnjFormat`, `buildOrQuery`
- `src/hooks/useMonitorarDjenProcessosBrowser.ts`: Refatorado para usar busca agrupada com paralelismo

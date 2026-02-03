# Memory: features/monitoring/djen-processos-busca-paralela-v3
Updated: 2026-02-03

## Contexto

A API PJE Comunica **NÃO suporta sintaxe OR** no parâmetro `texto`/`palavraChave`. Tentativas anteriores de agrupar processos com "proc1 OR proc2 OR proc3" retornaram sempre 0 resultados.

## Estratégia v3: Busca Paralela Individual

O "OR" é feito do lado da aplicação, não da API:

```typescript
// 5 buscas individuais executadas simultaneamente
Promise.allSettled([
  buscarPjeComunicaNoBrowser({ tipo: 'processo', numeroProcesso: proc1, ... }),
  buscarPjeComunicaNoBrowser({ tipo: 'processo', numeroProcesso: proc2, ... }),
  // ...
])
```

## Configuração

- **Paralelismo**: 5 requisições simultâneas
- **Delay entre ciclos**: 200ms
- **Super-lote**: 100 processos
- **Checkpoint**: a cada 50 processos
- **Keyset pagination**: usa `.gt('numero', lastNumero)` em vez de `.range(offset, limit)` para evitar timeout do banco

## Performance

- Throughput: ~60 processos/minuto
- Tempo para 13k processos: ~3.5 horas
- Confiabilidade: ~95% (falhas individuais não afetam outros processos)

## Arquivos

- `src/utils/pjeComunicaClient.ts`: `buscarProcessosEmParalelo()`, `BUSCA_PARALELA_CONFIG`
- `src/hooks/useMonitorarDjenProcessosBrowser.ts`: hook principal com keyset pagination

## Notas

- CORS pode bloquear algumas requisições no Preview; o ambiente Published pode ser mais estável
- Processos que falharam são logados mas não interrompem o fluxo

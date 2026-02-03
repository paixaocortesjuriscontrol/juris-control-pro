# Memory: features/monitoring/djen-processos-busca-por-pagina-v4
Updated: 2026-02-03

## Estratégia v4: Busca por Página + Filtro Local

O monitoramento "DJEN Processos" foi reimplementado para usar busca por página ao invés de busca individual por processo.

### Problema Anterior

- 13.000+ processos monitorados = 13.000 requisições individuais à API PJE Comunica
- Rate limiting (HTTP 429) frequente
- Tempo estimado: 3.5+ horas
- Sintaxe OR na API NÃO funciona

### Solução Implementada

1. **Carregar todos os números de processo** (1 única query ao Supabase)
2. **Criar índice O(1)** (`Set` com números normalizados para lookup instantâneo)
3. **Buscar páginas do DJEN por tribunal**: Iterar por ~50 tribunais (TRT, TRF, TJXX)
4. **Filtrar localmente**: Para cada publicação retornada, verificar se o numeroProcesso está no Set

### Vantagens

| Métrica | Antes (Individual) | Depois (Por Página) |
|---------|-------------------|---------------------|
| Requisições | ~13.000 | ~50-100 por tribunal |
| Tempo estimado | 3.5 horas | 5-15 minutos |
| Risco de 429 | Alto | Baixo |
| Publicações capturadas | Apenas nossos | Apenas nossos |

### UI Melhorada

- Timer de tempo decorrido (antes não existia)
- Progresso mostra tribunal atual + contagem
- Publicações analisadas vs novas encontradas

### Arquivos Modificados

- `src/hooks/useMonitorarDjenProcessosBrowser.ts` - Reescrito completamente
- `src/components/configuracoes/MonitoramentoDjenProcessosCard.tsx` - UI com timer
- `src/components/configuracoes/MonitoringDashboard.tsx` - Adaptado para novo tipo de progresso

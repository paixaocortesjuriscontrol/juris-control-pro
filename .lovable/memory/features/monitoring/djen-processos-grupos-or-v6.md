# Memory: features/monitoring/djen-processos-grupos-or-v6
Updated: 2026-02-04

O monitoramento 'DJEN Processos' utiliza a estratégia v6: **busca por grupos de processos usando sintaxe OR do Elasticsearch**.

## Problema com estratégia v5 (por tribunal)
A API PJE Comunica **não suporta busca genérica por tribunal sem termo de busca**. Quando `texto` é null/vazio, a requisição retorna 0 resultados ou 404.

## Estratégia v6: Grupos com OR
1. Carrega todos os processos monitorados (~13k)
2. Separa em grupos de ~10 processos CNJ
3. Constrói query OR: `"1234567890 OR 0987654321 OR ..."`
4. Busca via `palavraChave` com a query OR
5. Filtra localmente para garantir match exato

### Vantagens
- ~1.300 requisições vs 13.000 = ~90% redução
- Tempo estimado: **20-30 minutos** (vs 7+ horas)
- Compatível com a API PJE Comunica (exige termo de busca)

### Campos de progresso
- `currentGroup` / `totalGroups` em vez de `currentTribunal` / `totalTribunais`
- `grupoAtual`: string formatada como "Grupo X/Y"

### Parâmetro configurável
- `group_search_size`: quantidade de processos por grupo (default: 10)

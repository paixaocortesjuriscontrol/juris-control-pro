# Memory: features/monitoring/djen-cross-monitoramento-rescue-v1
Updated: 23/02/2026

## Resgate Cross-Monitoramento (v2 - Inline)

Quando dois monitoramentos buscam o mesmo advogado (ex: "OSMAR MENDES" com condição concomitante e "OSMAR MENDES PAIXAO CORTES" sem condição), a API pode retornar resultados diferentes. Publicações encontradas por um monitoramento e descartadas por `condicao_concomitante` podem ser válidas para outro monitoramento sem condição.

### Lógica INLINE (v2):
O resgate agora acontece **dentro** de `processarTermo` / `processPublicationFromIndex`, no momento exato em que a condição concomitante falha:

1. Quando `condicaoConcomitanteAtendida()` retorna false, percorrer `allTermos` / `allMonitoramentos`
2. Procurar candidato: sem `condicao_concomitante`, cujo nome/OAB aparece no conteúdo
3. Verificar exclusões do candidato
4. Se encontrou candidato, substituir `monitoramento_id` e continuar o fluxo normal de inserção
5. Se não encontrou, descartar normalmente

### Vantagens sobre v1 (pós-processamento):
- Sem queries extras ao banco (descartadas não precisam ser re-lidas)
- Sem problemas de formato de data/timezone
- Imediato: a publicação é salva no momento correto
- Simples: ~30 linhas em vez de ~150

### Arquivos alterados:
- `src/hooks/useDjenTermosEngine.ts` — resgate inline no filtro de validação
- `supabase/functions/monitorar-djen/processing.ts` — resgate inline em `processPublicationFromIndex`
- `supabase/functions/monitorar-djen/index.ts` — mesma lógica na cópia local

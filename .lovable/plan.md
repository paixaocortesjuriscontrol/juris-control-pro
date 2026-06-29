## Diagnóstico

Comparei o motor **DJEN Local** (`src/hooks/useDjenTermosParalelaEngine.ts`) com o **DJEN Servidor** (`monitor-servidor/engines/paralela.js`). Os workers em paralelo já estão corretos (cada VPS = 1 worker independente, sem trava global), mas o **Local usa delays bem maiores por página/retry** que o Servidor — por isso adicionar VPS não acelera proporcionalmente.

| Parâmetro | Local (hoje) | Servidor | Efeito |
|---|---|---|---|
| `delay_between_pages` | **1800 ms** | 800 ms | +1s perdido a cada página paginada — domina o tempo total |
| `retry_base_delay` | **20.000 ms** | 8.000 ms (429) / 3.000 ms (outros) | Cada 429 ocasional custa ~20s no Local |
| `HOST_BUCKET_LIMITS['pje-comunica']` | 1 (cosmético) | — | Mostra "concorrência 1" na UI mesmo com N VPS |

Constante `HOST_BUCKET_LIMITS` não trava workers de verdade hoje (só rotula UI), mas confunde leitura. O cooldown 429 já é por VPS (correto). Não há fallback estranho — o gargalo é puramente os delays.

## Mudanças

### `src/hooks/useDjenTermosParalelaEngine.ts`

1. Alinhar `CONFIG` ao Servidor:
   ```ts
   const CONFIG = {
     delay_between_terms: 2500,        // mantém
     delay_between_pages: 800,         // 1800 → 800 (paridade servidor)
     delay_between_termos_or: 1800,    // mantém
     max_retries: 3,
     retry_base_delay: 8000,           // 20000 → 8000 (paridade servidor 429)
   };
   ```

2. Substituir o uso cosmético de `HOST_BUCKET_LIMITS['pje-comunica']` em `concorrencia` (linhas 302, 2114, 2741) por `vias.length` quando disponível, caindo para `1` apenas quando não houver pool. Mantém o resto da estrutura intacta.

### Sem alterações em
- Pool de proxies, cooldown por VPS, validação parte/advogado, deduplicação — tudo intacto.
- Servidor não é tocado.

## Resultado esperado

Com 10 VPS rodando, o tempo por tribunal cai aproximadamente pela metade (a paginação domina o ciclo). Adicionar mais VPS volta a escalar linearmente.

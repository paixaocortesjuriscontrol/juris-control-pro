

## Plano: Otimizar Velocidade do DJEN Termos Pro (sem perder publicações)

### Problema
O engine está lento devido a delays excessivos e retries com backoff muito longo quando recebe HTTP 429. **Não vamos reduzir maxPages** — todas as publicações continuarão sendo buscadas.

### Mudanças (apenas no arquivo `src/hooks/useDjenTermosProEngine.ts`)

#### 1. Reduzir delays internos
Os delays atuais são muito conservadores para busca no browser:

| Parâmetro | Atual | Novo |
|---|---|---|
| `delay_between_terms` | 1500ms | **800ms** |
| `delay_between_pages` | 1500ms | **800ms** |
| `retry_base_delay` | 10000ms | **5000ms** |
| `max_retries` | 4 | **3** |
| Delay entre tribunais no loop | 1200ms | **600ms** |
| Delay entre termos_or | 600ms | **400ms** |
| Delay entre termos_or advogado | 600ms | **400ms** |

#### 2. Adicionar timeout por termo (segurança)
Se um único termo demorar mais de **120 segundos** (2 minutos), abortar a paginação desse termo e passar para o próximo. Isso evita que um termo com muitos 429 trave toda a execução. As publicações já obtidas daquele termo são salvas normalmente.

#### 3. Manter maxPages: 999
Nenhuma redução de cobertura. Todas as páginas continuam sendo buscadas.

### Impacto esperado
- Redução de ~40% no tempo total de execução
- O timeout por termo garante que a execução sempre termina
- Zero perda de publicações em condições normais

### Arquivos alterados
- `src/hooks/useDjenTermosProEngine.ts` — CONFIG + delays inline + timeout por termo


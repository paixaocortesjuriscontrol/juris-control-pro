
## Situação atual (o que está acontecendo de verdade)

Pelos logs de rede do seu próprio Preview, **quase todas as chamadas do DJEN Processos estão batendo no fallback da Edge Function** (`/functions/v1/buscar-djen`) — e a Edge Function está respondendo 200, porém com:

- `error: "Error: Blocked (HTML)"`
- `message: "Não foi possível conectar à API do PJE Comunica..."`  
- e **0 itens**.

Ou seja: não é que “não existem publicações”; é que **o PJE Comunica está bloqueando requisições server-to-server (Edge Function/Deno fetch)** com uma página HTML (anti-bot/WAF).  
Como o browser não consegue acessar por CORS, e o proxy (Edge) é bloqueado, o monitoramento fica “rodando” e encontra quase nada (os 7 que você viu são resquícios do modo antigo `pje_comunica_browser_seq`, não do OR atual).

Também há um detalhe técnico importante: quando o proxy falha, a Edge Function devolve `publicacoes/comunicacoes` (sem `items`), e o frontend interpreta como “nenhum resultado” (silenciosamente), então ele continua varrendo grupos e termina com quase zero.

---

## Objetivo do ajuste
1) Fazer o proxy **realmente conseguir obter JSON** do PJE Comunica (mesmo quando o fetch direto for bloqueado).  
2) Quando não conseguir, **não “fingir sucesso”**; devolver erro claro para o frontend abortar ou alertar.  
3) Garantir que a resposta do proxy seja sempre compatível com o frontend (`items`, `hasMore`, etc).

---

## Causa raiz confirmada com evidências
### Evidência 1 (rede)
Requisições `POST /buscar-djen` respondem:
```json
{
  "success": true,
  "message": "... busca por palavra-chave pode estar indisponível ...",
  "error": "Error: Blocked (HTML)",
  "totalElements": 0,
  "publicacoes": [],
  "comunicacoes": []
}
```
Sem `items`, e com bloqueio (HTML).

### Evidência 2 (banco)
Últimos 2 dias em `publicacoes_djen_processos` = **7 registros** e todos com `fonte = pje_comunica_browser_seq` (fluxo antigo), não do grouped OR.

---

## Estratégia de correção (a que deve destravar)

### A) Edge Function `buscar-djen`: adicionar fallback “browser-real” via Browserless
Como já existe `BROWSERLESS_API_KEY` no projeto, vamos usar Browserless como fallback quando o fetch direto retornar HTML bloqueado.

Fluxo dentro da Edge Function para `tipo = "palavra-chave"`:
1. Tenta fetch direto (rápido).
2. Se detectar `text/html` ou erro “Blocked (HTML)”:
   - Tenta **Browserless** (`/content` ou `/scrape`) para buscar o mesmo URL como Chrome real.
   - Faz `JSON.parse()` do corpo retornado.
3. Se Browserless falhar:
   - (Opcional) tentar `fetchJsonViaJina()` como fallback secundário (já existe código pronto).
4. Se tudo falhar:
   - **retornar HTTP 502** com `success:false` e `details` do bloqueio (não retornar “success true vazio”).

Por que isso deve funcionar:
- o PJE Comunica está bloqueando o “fetch comum” do Deno (Edge), mas frequentemente **não bloqueia um Chrome real** (Browserless), pois o fingerprint é diferente.

### B) Edge Function: padronizar resposta SEMPRE com `items`
Hoje, quando falha, retorna `{ publicacoes: [], comunicacoes: [] }`. O frontend espera `items`.

Vamos padronizar:
- sempre retornar pelo menos:
  - `items: []`
  - `totalElements: 0`
  - `page`, `pageSize`, `hasMore`

E incluir um campo de debug:
- `source: "direct" | "browserless" | "jina" | "blocked"`

### C) Frontend `pjeComunicaClient.ts`: não aceitar “sucesso vazio com erro embutido”
Hoje, o fallback para Edge Function faz:
- `if (error) throw error;`
- caso contrário, considera sucesso e retorna `items = data?.items ?? []`

Problema: quando a Edge Function retorna `success:true` + `error:"Blocked (HTML)"`, o frontend não “explode”, só segue adiante com 0 itens.

Vamos ajustar para:
- Se `data?.success === false` → lançar erro (com mensagem amigável).
- Se existir `data?.error` ou `data?.message` indicando bloqueio → lançar erro também.
- Se por compatibilidade vier `comunicacoes/publicacoes` sem `items`, mapear para `items` (fallback defensivo).

### D) Hook `useMonitorarDjenProcessosBrowser`: “circuit breaker” para bloquear loop infinito
Mesmo com retries, se a API estiver bloqueada globalmente, não faz sentido continuar varrendo 1321 grupos para terminar com 0.

Implementar:
- contador de “falhas por bloqueio” consecutivas
- se bater, por exemplo, **3 grupos seguidos** com erro de bloqueio:
  - abortar execução
  - status `erro`
  - mensagem clara: “PJE Comunica bloqueou o proxy; tentando Browserless/sem acesso agora”

Isso evita “timeout em 7%” e evita que pareça que está “rodando mas não acha nada”.

---

## Sequência de implementação (ordem exata)

1) **Editar** `supabase/functions/buscar-djen/index.ts`
   - Introduzir `fetchViaBrowserless(url)` (padrão já usado em outras Edge Functions do projeto).
   - No `fetchPage`, ao detectar HTML bloqueado, tentar Browserless e parsear JSON.
   - Ao final, se não conseguir nenhuma via:
     - retornar **HTTP 502** com `success:false`, `details`, `blocked:true`.
   - Garantir saída com `items` sempre que `success:true`.

2) **Deploy** da Edge Function `buscar-djen` para o ambiente Preview.

3) **Editar** `src/utils/pjeComunicaClient.ts`
   - No bloco `if (corsBlocked)`, após receber `data`:
     - se `data.success === false` ou `data.error` indicando bloqueio → `throw new Error(...)`
     - mapear `items` corretamente e preencher `hasMore`, `totalElements`.

4) **Editar** `src/hooks/useMonitorarDjenProcessosBrowser.ts`
   - Adicionar circuit breaker por bloqueio.
   - Melhorar mensagem de status quando a falha for “Blocked/HTML/sem conexão”.

5) **Teste guiado**
   - Hard refresh (Ctrl+F5).
   - Rodar DJEN Processos para um dia onde você sabe que existe volume.
   - Confirmar no Network:
     - respostas do `buscar-djen` contendo `items` e `source:"browserless"` (ou `direct`).
   - Confirmar no card:
     - “total analisadas” sobe continuamente
     - “novas” não fica travado em 7
     - sem timeout em 7%

---

## Riscos e como mitigaremos

- Browserless pode ser mais lento/caro:
  - só será usado **quando detectarmos bloqueio**, não sempre.
- Respostas grandes podem aumentar risco 546:
  - manter `pageSize <= 50`
  - manter truncamento controlado no Edge (podemos ajustar depois se precisar mais texto)
  - evitar buscar múltiplas páginas no Edge (continuar 1 página por chamada)

---

## Critério de sucesso

1) `buscar-djen` deixa de responder com `Blocked (HTML)` na maioria das chamadas.
2) O monitoramento passa de “7 e para” para **crescimento contínuo** de `totalPublicacoesAnalisadas` e/ou `novas`.
3) Sem “timeout em 7%” por falta de heartbeat/resultado.


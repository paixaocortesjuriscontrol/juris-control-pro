

## Plano: Restaurar DJEN Termos Pro para Versão Simples e Estável

### Problema Identificado

As alterações recentes adicionaram **complexidade desnecessária** ao engine:
1. **Timeout por termo** (7 min com AbortController separado) — aborta termos prematuramente
2. **Fila de retry** — faz chamadas extras à API, piorando o rate limit
3. **Catch no loop principal** que pula termos ao invés de parar — termos são perdidos silenciosamente
4. O acúmulo dessas chamadas extras causa mais **HTTP 429** (rate limit), gerando um ciclo vicioso

### O que será feito

**Arquivo: `src/hooks/useDjenTermosProEngine.ts`**

1. **Remover timeout por termo** — eliminar o `AbortController` de timeout individual (linhas 561-606). A função `processarTermoPro` voltará a ser uma chamada direta a `_processarTermoProInterno` sem wrapper de timeout
2. **Remover fila de retry** — eliminar `retryQueue`, `MAX_RETRY_ATTEMPTS`, `RETRY_COOLDOWN_MS` e todo o bloco de retry (linhas 1260-1454). Se um termo falhar, o erro será propagado normalmente (parando a execução) como era antes
3. **Remover catch que pula termos** — o `.catch()` na linha 1289 que adiciona à fila de retry será removido. Volta ao comportamento original: se um termo falha após os retries do `pjeComunicaClient`, a execução para com erro claro
4. **Restaurar CONFIG conservador** — manter os delays atuais (1200ms entre termos, 12s cooldown a cada 10) que são adequados

### Resultado esperado

- Engine sequencial simples: busca termo por termo, sem pular, sem retry separado
- Se a API retornar 429, o `pjeComunicaClient` já tem retry com backoff exponencial (5 tentativas)
- Se falhar após 5 tentativas, a execução para com mensagem clara ao invés de pular silenciosamente
- Menos chamadas à API = menos chance de rate limit

### Seção Técnica

```text
ANTES (complexo):
  processarTermoPro → AbortController timeout 7min
    → _processarTermoProInterno → buscarPjeComunicaPaginado
  catch → retryQueue.push()
  ... loop principal ...
  retryQueue loop (2 rodadas, delay dobrado)

DEPOIS (simples):
  processarTermoPro → buscarPjeComunicaPaginado (direto)
  catch → throw (para execução com erro claro)
```


# TST por parte com "HTTP 500": identificar melhor o erro

Escopo: apenas diagnóstico/exibição. **A busca não muda** — nenhum ajuste de página, backoff, pool ou regra de parte.

## O que a execução de agora mostra

O card do TST/Parte terminou como **Concluído** (115/115, 100%), com `0 novas, 271 duplicadas, 195 descartadas`, e ainda assim exibe `⚠ HTTP 500`.

Esse aviso vem do último erro de página registrado pelo cliente paginado (`lastError`). Hoje o motor Browser guarda **somente** esse texto: os campos que dizem se alguma página ficou sem coleta (`failedPages`, `truncated`, `partial`) são devolvidos pelo cliente e descartados pelo motor. Por isso não é possível dizer, olhando a tela, se o 500 foi uma página que se recuperou no retry ou se alguma página ficou de fora.

## 1. Dizer se houve perda de página

Passar a ler `failedPages`, `truncated` e `partial` de cada busca e acumular por termo/tribunal:

- Nenhuma página perdida: card continua **Concluído**, aviso informativo — `⚠ HTTP 500 (recuperado no retry)`.
- Alguma página perdida ou coleta interrompida: card marcado como **Concluído parcial**, dizendo quantas páginas ficaram de fora.

## 2. Dizer em qual termo e página

Hoje `ultimoErro` guarda apenas `HTTP 500`. Passar a guardar `HTTP 500 · termo "<nome da parte>" · pág. N`, com o total de ocorrências quando houver mais de uma. Isso mostra se o 500 do TST se concentra em um nome de parte específico.

## 3. Tooltip com o detalhe completo

O aviso do card ganha tooltip listando: termo, página, quantidade de ocorrências por código de erro (500/429/504) e se houve recuperação.

## Detalhes técnicos

- `src/hooks/useDjenTermosParalelaEngine.ts`: propagar `failedPages`/`truncated`/`partial` de `executarBusca` para o track; acumular contagem por código de erro; mensagem de conclusão com páginas perdidas; texto de erro com termo e página.
- Componente do card de tribunais do motor Browser: rótulo "parcial" e tooltip com o detalhe acumulado.

Nenhuma alteração em `src/utils/pjeComunicaClient.ts` (parâmetros, paginação e retries seguem como estão) e nenhuma alteração no worker das VPS.

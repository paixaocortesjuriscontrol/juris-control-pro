# TST por parte com "HTTP 500": tornar o risco visível e reduzir a incidência

## O que a execução de agora mostra

O card do TST/Parte terminou como **Concluído** (115/115, 100%), com `0 novas, 271 duplicadas, 195 descartadas`, e ainda assim exibe `⚠ HTTP 500`.

Esse aviso vem do último erro de página registrado pelo cliente paginado (`lastError`). Hoje o motor Browser guarda **somente** esse texto: os campos que dizem se alguma página ficou sem coleta (`failedPages`, `truncated`, `partial`) são devolvidos pelo cliente e **descartados** pelo motor. Por isso não é possível afirmar, olhando a tela, se o 500 foi apenas uma página que se recuperou no retry ou se o TST parou de responder e a coleta daquele termo ficou incompleta — o card mostra "Concluído" nos dois casos.

O plano abaixo primeiro remove essa ambiguidade e depois reduz a chance de o TST por parte devolver 500.

## 1. Distinguir "500 recuperado" de "página não coletada"

No motor paralelo (Browser), passar a ler `failedPages`, `truncated` e `partial` de cada busca e acumular por termo/tribunal:

- Nenhuma página perdida: o card continua **Concluído** e o aviso aparece como informativo — `⚠ HTTP 500 (recuperado no retry)`.
- Alguma página perdida ou coleta interrompida: o card fica **Concluído parcial**, com o texto dizendo qual termo e quantas páginas ficaram de fora.

Assim o mesmo padrão já usado no DJEN Servidor (rodada parcial) passa a valer no motor Browser.

## 2. Registrar o termo, não só o código do erro

Hoje `ultimoErro` guarda apenas `HTTP 500`. Passar a guardar `HTTP 500 · termo "<nome da parte>" · pág. N` e, quando houver mais de um, o total de ocorrências. Isso permite identificar se o 500 do TST se concentra em um nome de parte específico (nomes longos e com muitos resultados são os candidatos naturais).

## 3. Reduzir a incidência no TST por parte

O TST por parte é a combinação com maior volume de retorno por página (por isso o 500 aparece nele e não nos outros). Ajustes no cliente/motor:

- Página menor já na primeira tentativa para TST + parte (50 → 20 itens), em vez de esperar o erro para degradar.
- Backoff dedicado ao 500 nessa combinação (respiro maior antes do retry, sem consumir tentativa extra).
- Ao esgotar os retries de uma página, tentar a mesma página em outra VPS do pool antes de considerar a página perdida.

## 4. Fechar o ciclo

- O aviso do card ganha tooltip com o detalhe completo (termo, página, quantas ocorrências, se recuperou).
- Rodada com página realmente não coletada entra no e-mail de suporte já existente (`suporte@paixaocortes.adv.br`), sem envolver os advogados.

## Detalhes técnicos

- `src/hooks/useDjenTermosParalelaEngine.ts`: propagar `failedPages`/`truncated`/`partial` de `executarBusca` para o track; novo status/flag de parcial; mensagem de conclusão com contagem de páginas perdidas; texto de erro com termo e página.
- `src/utils/pjeComunicaClient.ts`: `pageSize` inicial reduzido quando `siglaTribunal=TST` e `nomeParte` presente; backoff específico de 500; retry de página em outra via do pool.
- Componente do card de tribunais do motor Browser: exibir "parcial" e tooltip com o detalhe.
- Edge Function de saúde já existente: incluir páginas não coletadas no aviso ao suporte.

Nada muda no comportamento de busca por parte (segue exclusivamente por `nomeParte`, sem fallback por palavra-chave).

## Contexto

Regra do projeto (`mem/constraints/djen-keyword-no-slicing.md`): a busca DJEN por palavra-chave deve enviar a **expressão inteira** configurada no termo, apenas normalizada sem acentos. NUNCA fatiar em 2 palavras nem usar só a palavra mais longa de um `+`.

## Verificação

Auditei os 6 motores que geram `palavraChave` para a API PJE Comunica:

| Arquivo | Status |
|---|---|
| `useDjenTermosProEngine.ts` (`encurtarParaApi`) | OK — envia termo inteiro |
| `useDjenTermosFlashEngine.ts` (`encurtarParaApi`) | OK — envia termo inteiro |
| `useDjenTermosParalelaEngine.ts` (`encurtarParaApi`) | OK — envia termo inteiro |
| `useDjenTermosEngine.ts` (`gerarVariantes`, linhas 755-767) | **Viola** — gera variante "curta" com `slice(0, 2)` |
| `useSincronizarDjenBrowser.ts` (`gerarVariantes`, linhas 72-80) | **Viola** — gera "prefixo" com `slice(0, 2)` |
| `useBuscaDjenDireta.ts` | a verificar — não usa o padrão de variantes curtas |

Esses dois motores ainda geram uma variante extra de 2 palavras quando o termo tem ≥3 palavras significativas, e essa variante é enviada como `palavraChave` em buscas adicionais. Resultado: termos como "OSMAR MENDES PAIXAO CORTES" disparam buscas extras só com "OSMAR MENDES" (fatiado), trazendo muito ruído e falsos positivos que dependem da validação local para serem filtrados — mas a regra é não fatiar na origem.

## Alterações propostas

### 1. `src/hooks/useDjenTermosEngine.ts`
Remover o bloco linhas 755-767 que gera a variante "curta" (`palavrasSignificativas.slice(0, 2)`). Manter apenas: termo original + variante sem `&` + variantes sem acentos.

### 2. `src/hooks/useSincronizarDjenBrowser.ts`
Remover o bloco linhas 72-80 que gera o "prefixo curto" (`palavras.slice(0, 2)`). Manter apenas: termo original + variante sem `&` + variantes sem acentos.

### 3. Atualizar memória
Acrescentar em `mem/constraints/djen-keyword-no-slicing.md` que a função `gerarVariantes` dos motores Engine/Sincronizar também NÃO pode produzir variante de 2 palavras — apenas variantes de normalização (sem acento, sem `&`).

## Fora de escopo

- Não mexer em `useDjenTermosPro/Flash/Paralela` (já estão corretos).
- Não alterar a validação local de frase exata (`contemFraseExata`) — segue como está.
- Não alterar lógica de `tipo='parte'` nem condição concomitante.

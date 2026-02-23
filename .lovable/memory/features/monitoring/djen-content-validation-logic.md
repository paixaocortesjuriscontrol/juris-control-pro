# Memory: features/monitoring/djen-content-validation-logic
Updated: 23/02/2026

A validação de conteúdo do DJEN usa **FRASE EXATA 100%** para garantir precisão.

## Regras de Validação (TODAS usam 100% estrito):
- **Palavra-chave**: Frase exata deve aparecer no texto (ex: "Super Quadra" não casa com "enquadramento")
- **Advogados (OAB)**: Nome OU OAB devem aparecer no texto. Se o NOME COMPLETO é encontrado, a publicação é válida mesmo que a OAB configurada não apareça (advogados podem ter OABs diferentes em estados diferentes, ex: DF-15553 e SP-310314). A OAB é usada como filtro de busca na API e como validação secundária quando o nome não é encontrado.
- **Parte (Polo ativo/passivo)**: Confia no filtro `nomeParte` da API — NÃO exige que o termo apareça no corpo do texto, pois o nome pode existir apenas nos metadados estruturados de partes
- **Nome**: Frase exata deve aparecer no texto
- **Processo**: Número (apenas dígitos) deve aparecer no texto

## Lógica AND (+):
Termos com "+" (ex: "DR. OSMAR + SERVICO DE APOIO") exigem que CADA segmento apareça 100% no texto.

## Lógica OR (termos_or):
- Para advogados, se houver termos_or, pelo menos UM deles deve casar 100%.
- **CRÍTICO**: O `useDjenTermosEngine.ts` DEVE verificar `termos_or` na etapa de validação. Sem isso, publicações encontradas via busca por nomes alternativos (ex: "RENATA MOUTA") são descartadas porque o termo principal ("OSMAR MENDES") não aparece no texto.

## Validação de Conteúdo:
- A validação ocorre APENAS no campo de texto da publicação (conteudo/teor/texto)
- Metadata como `destinatarioNome` NÃO é usada para validação principal (apenas fallback)
- O termo de busca NUNCA deve ser injetado na lista de advogados extraídos

## Arquivos Sincronizados:
- `src/hooks/useDjenTermosEngine.ts` — usa validação inline com suporte a termos_or
- `src/hooks/useBuscaDjenDireta.ts` — usa `conteudoContemTermoOuOr` com suporte a termos_or
- `src/hooks/useSincronizarDjenBrowser.ts`
- `src/utils/djenTermoMatch.ts`
- `supabase/functions/monitorar-djen/validation.ts`
- `supabase/functions/monitorar-djen/index.ts`

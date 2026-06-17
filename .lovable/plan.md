## Objetivo

Espelhar 1:1 a lógica do Browser (`src/hooks/useDjenTermosParalelaEngine.ts`) no daemon Servidor (`monitor-servidor/engines/paralela.js`). Sem fallback cross-coordenação, sem rescue, sem mudar escopo de tipo.

## Regras de escopo (já respeitadas — confirmadas no diagnóstico)

- `tipo='parte'` → valida **só** em metadados estruturados (`destinatarios`, `poloAtivo/Passivo`, `partes_json`) ou na seção "Parte(s):" do texto. Nunca no corpo geral.
- `tipo='advogado'` → valida em `destinatarioadvogados[]` (nome/OAB) OU no texto completo (que inclui nome do adv e OAB no rodapé estruturado). Idêntico ao Browser.
- `tipo='palavra-chave'` → frase exata no texto completo (corpo + nomes estruturados). Idêntico ao Browser.
- `tipo='processo'` → match por dígitos do `numeroProcesso`. Idêntico.

Validação (`contemTermo`, `buildTextoCompleto`, `validarAdvogadoMetadados`, `validarParteMetadados`, `validarParteSecaoPartes`, `parsearTermoOr`, exclusões, concomitante) já é byte-a-byte espelho do Browser. **Não mexo.**

## Único gap real → retry de busca vazia

O Browser, ao receber 0 resultados na 1ª passada de uma busca, espera 1.5s e refaz **a mesma busca** uma única vez (não muda parâmetro, não cai em outro endpoint, não consulta outra coord):

- Parte: `useDjenTermosParalelaEngine.ts:1311-1320` — refaz o `nomeParte=<termo>` se veio vazio.
- Não-parte (advogado/palavra-chave): `useDjenTermosParalelaEngine.ts:1354-1383` — refaz os mesmos `baseParams` se veio vazio.

Isso existe porque a API PJE Comunica devolve listagem vazia intermitentemente, sem erro HTTP. Não é fallback para outro caminho — é só repetir a chamada idêntica.

O Servidor (`paralela.js > buscarTermo`, linhas 454-468) **não tem esse retry**. É a única diferença comportamental que explica os déficits "só browser" do relatório (Janaina advogado −8, Santander Cível advogado −5, Renata parte −5, Bruna parte −3, Janaina parte −2, Thomás parte/palavra −2, Vanessa STF/STJ advogado −2).

## Patch único

`monitor-servidor/engines/paralela.js > buscarTermo`:

```text
- caso parte: para cada termo, chama buscarPaginado. Se items.length===0 e !abort, await 1500ms e refaz a MESMA chamada uma vez.
- caso não-parte: chama buscarPaginado. Se items.length===0 e !abort, await 1500ms e refaz a MESMA chamada uma vez.
```

Não altera:
- `buscarPaginado` / `continueUntilEmpty`
- `baseParams` (mesmos `numeroOab`/`ufOab`/`nomeAdvogado`/`nomeParte`/`texto`/`numeroProcesso` que o Browser monta)
- `contemTermo` e toda a cadeia de validação
- `persistPublicacoes`, hashes, dedup
- Nada do Browser

## Como confirmar paridade

1. Aplicar o patch, fazer `git pull` + `pm2 restart djen-servidor` na VPS.
2. Rodar DJEN Servidor para o dia 17/06.
3. Abrir Comparador → Analisar.
4. Coluna "só browser" deve cair para 0 (ou perto) em todas as coordenações.

## Sobre o excesso "só servidor"

O patch não diminui as 120 extras da Bruna GOL etc. Esse excesso vem de outro lugar (provavelmente o Servidor pagina mais fundo que o Browser, que para em algum limite). Trato isso separadamente se quiser — não está no escopo desta correção.

## Arquivo modificado

- `monitor-servidor/engines/paralela.js` (só `buscarTermo`)

## Deploy

Lovable não publica daemon Node. Após merge, na VPS: `git pull && pm2 restart djen-servidor`.

# Igualar regras DJEN Servidor ↔ Browser

Alinhar `monitor-servidor/engines/paralela.js` ao `src/hooks/useDjenTermosParalelaEngine.ts` em 4 pontos. Sem mexer no Browser.

## 1. `palavra-chave`/`nome` — validar no texto completo (não só corpo)

Trocar `getConteudoPuro(pub)` por `buildTextoCompleto(pub, conteudo)` nos 3 pontos do tipo `palavra-chave`/`nome` em `paralela.js`:
- `contemTermo` (L714) — match do termo principal e dos `termos_or`.
- `condicaoConcomitanteAtendida` (L733).
- `shouldExclude` (L749).

Mantém `parte` validando só na seção de partes e `advogado` já usa `buildTextoCompleto`. Resolve descartes em massa quando o termo aparece só em metadados estruturados (destinatários/advogados/partes).

## 2. Remover suplemento OAB-descoberta do Servidor (paridade com Browser)

Excluir de `paralela.js` a função `coletarOabsDoAdvogado` (L500-516) e qualquer referência. Como o Browser não tem essa lógica e não vamos adicionar lá agora, o Servidor também não deve ter — fica idêntico ao Browser.

## 3. Subir delay entre `termos_or` no advogado (Servidor)

Em `paralela.js` L939, alterar `ADVOGADO_OR_DELAY_MS`/literal de **500 ms → 1800 ms**, igualando ao Browser (`CONFIG.delay_between_termos_or = 1800`). Evita rajadas de 429 em monitoramentos de advogado com muitos OR.

## 4. Retry de página vazia: 600 ms no Servidor

Em `paralela.js` reduzir o sleep do retry único após resultado vazio de **1500 ms → 600 ms**:
- `parte` (L875).
- `advogado` (L891).

Igual ao Browser (L1432, L1472).

## Não mexer

- Nomes de params HTTP (`palavraChave` vs `texto`, `oab/uf` vs `numeroOab/ufOab`) — cada cliente HTTP entende os seus.
- Campo `tipo` no payload — PJE Comunica ignora.
- `normalizeForApi` strip `/` no Servidor — só afeta termo enviado, não validação.
- Cross-coord rescue do Servidor (`persistirResgatesOutraCoordenacao`) — alinhado com `mem/constraints/djen-servidor-isolated-from-browser`, lê só `publicacoes_djen_servidor`.
- Browser — sem alterações.

## Pós-deploy

VPS: `git pull` + `pm2 restart jc-monitor-servidor`.

Validar com Bruna/GOL e Thomás no Comparador: o Servidor deve passar a achar **igual ou mais** em `palavra-chave`/`nome`; advogado com muitos OR sem 429; tempos de retry menores.

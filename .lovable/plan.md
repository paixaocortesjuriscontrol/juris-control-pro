## Objetivo

Corrigir as 5 divergências entre DJEN Servidor × Browser, sem quebrar a tela Análise DJEN nem outras telas.

## 1) Filtro de "Origem" no Comparador

Na tela do comparador (página de auditoria DJEN Servidor × Browser), adicionar um seletor:

- **Todos** (padrão atual)
- **DJEN Termos** (apenas `tipo_publicacao` = `intimacao`/`parte` originadas do motor de Termos)
- **Pautas** (`tipo_publicacao = 'pauta'`)
- **Kurier** (origem Kurier — flag `fonte` ou `origem_motor`)

O filtro atua sobre os dois lados (servidor e browser) antes do diff. Isso elimina o ruído das ~371 pautas que só existem no browser hoje.

## 2) Habilitar engine de Pautas no servidor

Portar o motor de Pautas DJET (`monitor-servidor/engines/pautas.js` já existe — verificar se está sendo chamado em `monitor-servidor/index.js`). Se já existe mas não roda, ligá-lo no scheduler do servidor com gravação em `publicacoes_djen_servidor` com `tipo_publicacao = 'pauta'`.

Se a opção #1 já filtra Pautas no comparador, esta etapa garante que, com filtro "Todos", o servidor tenha paridade.

## 3) Corrigir paginação

Dois pontos:

**a) Servidor — TST/Janaina (bug Item 2):**
Em `monitor-servidor/engines/paralela.js`, quando a busca por OAB+UF retornar 0 no TST, executar fallback por **nome do advogado** sem UF (mesmo padrão já usado para SANTANDER). Garantir que o tribunal TST seja sempre percorrido para monitoramentos do tipo `advogado`.

**b) Browser — `continueUntilEmpty` (regra já memorizada):**
Verificar `src/utils/pjeComunicaClient.ts` e `pjeComunicaClientFlash.ts`: confirmar que NÃO quebram em `hasMore=false` nem em página curta quando `continueUntilEmpty=true`. Se já corrigido, validar com Bruna GOL/Santander no período relatado.

## 4) Normalizar nomes de tribunal (sem quebrar Análise DJEN)

O browser grava `TRT 1_DJEN`, o servidor grava `TRT1`. Em vez de alterar dados históricos (risco para a Análise DJEN e outras telas), normalizar **somente no comparador** (função `normalizeTribunalKey(t)` que remove espaços e sufixo `_DJEN` e compara as duas chaves normalizadas).

Para gravações futuras, padronizar a saída do browser para `TRT1` em `src/utils/djenTribunais.ts` (escrita nova já normalizada), mantendo a leitura tolerante a ambas as formas em qualquer tela que filtre por tribunal. Auditar uso de `tribunal` em Análise DJEN, Termos DJEN, Relatórios e telas de monitoramento — onde houver filtro exato, usar comparação normalizada.

## 5) Comparador por `id_djen` (não por tipo)

Refatorar o comparador para considerar duas publicações iguais quando:

- `id_djen` é igual entre servidor e browser, **independente** de `tipo_publicacao`.
- Fallback (quando `id_djen` ausente): `dedup_processo_digits` + `dedup_data_ref` + `coordenacao_id` (sem `tipo`).

Isso resolve o caso Vanessa (6 publicações marcadas como "só_browser" por terem `tipo=parte` no browser e `tipo=intimacao` no servidor).

## Onde mexer (técnico)

- **Comparador (UI + lógica):** página de auditoria DJEN (provável `src/pages/AuditoriaDjenProcessos.tsx` ou similar — confirmar na implementação) — adicionar seletor de origem + refator do `match` por `id_djen`.
- **Normalização tribunal:** novo helper em `src/utils/djenTribunais.ts` (`normalizeTribunalKey`); usado no comparador.
- **Servidor TST/Janaina:** `monitor-servidor/engines/paralela.js` — fallback por nome no TST.
- **Pautas no servidor:** `monitor-servidor/index.js` — registrar/ativar engine `pautas.js`.
- **Paginação browser:** validar `src/utils/pjeComunicaClient.ts` e `pjeComunicaClientFlash.ts` (regra `continueUntilEmpty`).

## Garantia de não-regressão

- Nenhum dado em `publicacoes_djen` ou `publicacoes_djen_servidor` será alterado (sem migrations destrutivas).
- Normalização de tribunal só na escrita nova + comparações tolerantes na leitura.
- Análise DJEN (`useAnaliseDjen.ts`) continua lendo `tribunal` como está — qualquer filtro novo passa pelo helper normalizado.

# Ajuste final da deduplicação "sem repetição"

## Resultado da comparação

A correção funcionou na maior parte:

| | Antes (13/08 11:27) | Depois (16/08 17:47) |
|---|---|---|
| Processos repetidos no documento | 5 pares | 1 par |

Os pares de 0000094-62.2022.5.05.0017, 0011534-36.2017.5.03.0001, 0100965-57.2022.5.01.0035 e 0100524-20.2020.5.01.0044 deixaram de se repetir. Sobrou **1001198-74.2022.5.02.0205** (itens 21 e 22 do novo documento).

## Por que esse par escapou

As duas cópias são a mesma intimação da 6ª Turma (mesmo relator, mesmo texto, mesma data), mas o cabeçalho vem gravado diferente pelo DJEN:

- item 21: `AGRAVANTE: EVELLYN PARDINI LIMA AGRAVADO: EVELLYN PARDINI LIMA E OUTROS (5)`
- item 22: `AGRAVANTE: AGRAVADO: EVELLYN PARDINI LIMA E OUTROS (5)`

Ou seja, uma delas está sem o nome do agravante. Como a comparação atual exige teor idêntico (tokens), essa diferença de nome no preâmbulo mantém as duas. Além disso, essa comunicação não traz o identificador `ID <hash>` que serviu para casar os outros pares.

## Correção proposta

1. **Comparar o corpo da comunicação, não o preâmbulo.** Antes de gerar a chave, recortar o trecho de partes do cabeçalho (`AGRAVANTE:`, `AGRAVADO:`, `RECORRENTE:`, `RECORRIDO:`, `RECLAMANTE:`, `RECLAMADO:`, `EMBARGANTE:`, `EMBARGADO:` e variações) e comparar a partir do marcador do ato (`INTIMAÇÃO`, `DECISÃO`, `DESPACHO`, `ACÓRDÃO`, `CERTIDÃO`) quando existir.
2. **Rede de segurança por similaridade.** Dentro do mesmo processo + mesma data, se o corpo de duas publicações tiver similaridade muito alta (≥ 92% dos tokens em comum), tratar como a mesma comunicação. Isso cobre variações futuras de grafia/ordem sem unir comunicações realmente distintas (que diferem em relator, ato ou prazo).
3. **Manter tudo o que já funciona:** ID do documento, corte do bloco `Intimado(s) / Citado(s)`, união dos nomes de intimados no item mantido, e a deduplicação de tela por `coordenacao_id + id_djen` intacta.

## Detalhes técnicos

- `src/utils/djenDedup.ts`: em `dedupPubsSemDestinatarios`, adicionar `extrairCorpoAto` (remove preâmbulo de partes e corta a partir do marcador do ato) e usar seu teor normalizado na chave; depois da passagem por chave exata, rodar uma segunda passagem agrupando por `processo + data` e unindo grupos com Jaccard ≥ 0,92 sobre os tokens do corpo.
- Sem mudanças nas telas: `AnaliseDjen.tsx` e `AnaliseDjenServidor.tsx` já usam a função compartilhada.
- Versão passa para **v4.5.5** (`src/constants/version.ts` e `public/version.json`).
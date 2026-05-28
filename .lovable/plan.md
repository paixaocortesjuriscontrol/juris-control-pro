## Objetivo

Hoje o `makeDedupKey` em `src/utils/djenDedup.ts` tem duas estratégias:
1. **Chave forte:** `coordenacao + id_djen` (quando `id_djen` existe).
2. **Fallback:** `coordenacao + processo_digits + data + conteúdo normalizado` (quando `id_djen` é nulo).

Investigação confirmou que **100% das publicações inseridas pelo DJEN Termos Paralela nas últimas 24h têm `id_djen` preenchido**. Os 178 registros com `id_djen` nulo vêm exclusivamente de outras fontes (`kurier` e `dejt-pdf`), que devem continuar usando o fallback.

## Mudança

Em `src/utils/djenDedup.ts`, dentro de `makeDedupKey`:

- Se `id_djen` estiver presente → continua usando `coordenacao|id_djen|<id>` (sem alteração).
- Se `id_djen` for nulo **e** a publicação for da Paralela → não aplicar fallback de conteúdo; gerar chave única por registro (`coordenacao|paralela-no-id|<pub.id>`) para que ela nunca seja colapsada com nenhuma outra.
- Se `id_djen` for nulo e a fonte **não** for Paralela (kurier, dejt-pdf, scrapers TJ/TRT) → manter o fallback atual (processo + data + conteúdo).

### Como identificar Paralela

Paralela insere com `tipo_origem === 'termo' | 'processo'` e `fonte` igual à sigla do tribunal vinda do PJE Comunica (ex.: `TST`, `STJ`, `TRT2`, `TJSP`) ou literal `DJEN-PARALELA`. As fontes que **não** são Paralela e populam `publicacoes_djen` são bem definidas:

- `kurier`
- `dejt-pdf`
- scrapers DJE estaduais (gravam `fonte = 'TJBA'`, `'TJMG'`, `'TRT3'`, etc., **mas sempre sem id_djen** e vindos de outra rota)

Para evitar ambiguidade com siglas (a sigla `TJBA` aparece tanto via Paralela quanto via scraper TJBA), a regra mais segura é:

> "Paralela" = qualquer publicação cuja `fonte` **não** seja `kurier`, `dejt-pdf` nem uma das siglas reservadas aos scrapers DJE estaduais. Na prática, como Paralela sempre tem `id_djen`, essa classificação só importa no caso patológico de `id_djen` nulo — e nesse caso a chave única evita colapso indevido.

Implementação proposta: lista de fontes que continuam usando fallback (`FONTES_COM_FALLBACK = new Set(['kurier','dejt-pdf', ...scrapers estaduais conhecidos])`). Para qualquer outra fonte sem `id_djen`, retornar chave única baseada em `pub.id`.

## Arquivo afetado

- `src/utils/djenDedup.ts` (única mudança).

## Validação

- Sanity check com a query atual (24h): nenhuma publicação Paralela tem `id_djen` nulo → nenhum efeito visível na UI hoje.
- Garante que, se alguma vez uma publicação Paralela vier sem `id_djen` (regressão de API), ela aparece como registro independente em vez de ser colapsada incorretamente com outra de conteúdo similar.

## Não incluído

- Backfill histórico de `id_djen`.
- Mudanças no dedup do backend (`hash_conteudo`).
- Mudanças em Kurier/dejt-pdf (continuam com fallback).

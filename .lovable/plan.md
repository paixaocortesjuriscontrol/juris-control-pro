## Problema

Publicações do **Kurier** aparecem como um bloco único de texto sem quebras (todo o cabeçalho, partes, advogados e inteiro teor grudados na mesma linha — ex.: "DATA DE DISPONIBILIZAÇÃO2026-06-18 TIPO DE COMUNICAÇÃOIntimação MEIODiário... TRIBUNALSTJ ... TEXTOEDcl no AgInt...").

Isso acontece porque, quando o payload do Kurier não traz um campo de texto identificável, a edge function `kurier-consultar-publicacoes` salva como `conteudo` a string "searchable" (todos os campos do objeto serializados em sequência). O front-end então renderiza esse blob inteiro como inteiro teor, sem cabeçalho separado.

As publicações do DJEN, em contraste, vêm com tags `<table>`/`<p>` que o renderizador transforma em linhas, e os campos estruturados (`orgao`, `tipo_comunicacao`, `meio`, `partes_json`, `advogados_json`) já alimentam a coluna esquerda.

## Objetivo

Apresentar publicações do Kurier com o mesmo layout organizado das DJEN: coluna esquerda com Órgão / Data / Tipo / Meio / Parte(s) / Advogado(s), e coluna direita só com o inteiro teor (a partir de "TEXTO" / "DECISÃO" / "DESPACHO" / "SENTENÇA").

**Sem mexer em datas, banco ou edge functions** — apenas camada de apresentação.

## Mudanças

### 1. `src/utils/formatConteudo.ts` — novo parser do blob Kurier

Adicionar `parseKurierBlob(texto)` que detecta o padrão Kurier (presença de `Data de Publicacao`/`Data de Divulgação` + `ORGÃO`/`TIPO DE COMUNICAÇÃO`/`MEIO`/`TRIBUNAL` colados aos valores) e devolve:

```ts
{
  isKurier: boolean;
  meta: { orgao, dataDisp, dataPub, tipoComunicacao, meio, tribunal, processo };
  partes: Array<{ papel: string; nome: string }>;   // EMBARGANTE/EMBARGADO/RECLAMANTE/...
  advogados: string[];                              // "NOME - OAB UF-NUMERO"
  inteiroTeor: string;                              // tudo a partir de "TEXTO"/"DECISÃO"/"DESPACHO"/"SENTENÇA"/"ACÓRDÃO"
}
```

Regras de parsing (regex sobre o blob):
- Labels conhecidos: `PROCESSO`, `ORG[ÃA]O`, `DATA DE DISPONIBILIZAÇÃO`, `TIPO DE COMUNICAÇÃO`, `MEIO`, `TRIBUNAL`, `RELATOR(A)`, `EMBARGANTE`, `EMBARGADO`, `RECORRENTE`, `RECORRIDO`, `AGRAVANTE`, `AGRAVADO`, `RECLAMANTE`, `RECLAMADO`, `AUTOR`, `RÉU`, `IMPETRANTE`, `IMPETRADO`, `REQUERENTE`, `REQUERIDO`, `ADVOGADOS`.
- Cada label captura tudo até o próximo label ou até `TEXTO`/`DECISÃO`/`DESPACHO`/`SENTENÇA`/`ACÓRDÃO`.
- Bloco `ADVOGADOS`: divide por padrão `NOME - UF + 6 dígitos` (ex.: `CARLOS JOSE ELIAS JUNIOR - DF010424`) e normaliza para `NOME - OAB DF-010424`.
- `inteiroTeor`: substring a partir de `TEXTO` (ou `DECISÃO`/`DESPACHO`/`SENTENÇA`/`ACÓRDÃO`) — esse é o conteúdo que vai para a coluna direita.

### 2. `src/components/djen/PublicacaoConteudoDjen.tsx` — integrar o parser

No início do componente:

```ts
const kurier = parseKurierBlob(conteudo);
```

Quando `kurier.isKurier === true`:
- `orgao = orgaoEstruturado || kurier.meta.orgao || fonte || tribunal`
- `tipoComunicacao = tipoComunicacaoEstruturado || kurier.meta.tipoComunicacao || "Intimação"`
- `meioPublicacao = expandMeio(meioEstruturado || kurier.meta.meio)`
- Partes/advogados: se `partesJson`/`advogadosJson` vierem vazios, usar `kurier.partes` (formatado como `[Papel] NOME`) e `kurier.advogados`.
- `conteudoLimpo = kurier.inteiroTeor` (substitui o blob completo na coluna direita).
- Manter highlight do termo e marcação amarela existentes operando sobre `kurier.inteiroTeor`.

Para publicações que não são Kurier, comportamento atual permanece intocado.

### 3. Validação visual

1. Abrir a publicação do print (processo `0001710-57.2001.4.01.4300`, login Kurier `paixaocortes2`) e conferir:
   - Coluna esquerda preenchida: Órgão = `SPF COORDENADORIA DE PROCESSAMENTO DE FEITOS DE DIREITO PÚBLICO`, Tipo = `Intimação`, Meio = `Diário de Justiça Eletrônico Nacional`, Partes = `[Embargante] INVESTCO S/A`, `[Embargado] SINOMAR MESSIAS PIRES`, `[Embargado] WILMA FERREIRA DE LIMA`, Advogados = lista com OAB.
   - Coluna direita começa em "DECISÃO Vistos. Trata-se de Embargos de Declaração...".
2. Conferir uma publicação Kurier com conteúdo HTML estruturado (`<table>...<p>...`): deve continuar renderizando como hoje (parser não dispara).
3. Conferir uma publicação DJEN normal: layout inalterado.

## O que NÃO muda

- Datas (`data_disponibilizacao` e `data_publicacao`) ficam como estão — não trata "atraso".
- Edge functions, schema do banco e fluxo de ingestão do Kurier não são tocados.
- Lógica de descarte, deduplicação e marcação por coordenação fica igual.

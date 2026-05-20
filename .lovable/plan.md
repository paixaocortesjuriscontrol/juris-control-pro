## Correção proposta

Você está certo: a busca por `tipo='parte'` deve fazer somente o fluxo abaixo:

```text
termo do monitoramento -> API PJE Comunica com nomeParte=<termo> -> validar apenas Parte(s)/polos estruturados -> salvar
```

Sem fallback, sem busca complementar, sem `palavraChave='*'`, sem varrer tribunal inteiro e sem validar pelo texto geral da publicação.

## O que será removido

No arquivo `src/hooks/useDjenTermosParalelaEngine.ts`:

1. Remover o bloco de busca complementar de `tipo='parte'` que chama a API com:

```ts
palavraChave: '*'
```

Esse bloco é o que fez a execução ficar lenta, porque passou a paginar o tribunal/dia inteiro. No log atual aparece TST com `totalExpected=9107`, página 8, 9, 10, 11... até bater HTTP 429.

2. Remover qualquer ideia de variante/fallback para parte.

A busca por parte não terá segunda busca por texto, termo curto, palavra-chave ou varredura.

## O que será mantido

1. A chamada principal para `tipo='parte'` continuará usando:

```ts
baseParams.nomeParte = mon.termo_busca
```

2. A validação de `tipo='parte'` continuará restrita a metadados de parte:

- `destinatarios[].nome`
- `poloAtivo` / `poloPassivo`
- `partes[]`
- `partes_json`, quando já vier estruturado
- seção delimitada `Parte(s):`, somente como bloco lateral/estruturado, não como teor geral

3. Deduplicação permanece isolada por `coordenacao_id`.

## Ajuste adicional necessário

Hoje existe uma função `validarParteSecaoPartes` que lê um bloco `Parte(s):` de dentro de `texto/conteudo`. Como você determinou “sem ler o texto da publicação”, vou remover essa chamada da validação de parte também. Assim `parte` só valida por campos estruturados realmente recebidos como metadados/API/JSON, não por corpo textual.

## Resultado esperado

- A execução por parte volta a ser rápida.
- Não haverá paginação massiva do TST ou qualquer tribunal.
- Não haverá HTTP 429 causado por varredura complementar.
- A captura só acontece quando o termo cadastrado aparece como parte/polo estruturado da publicação.
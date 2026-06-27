## Problema real

A tela está errada nos dois lugares: **Análise DJEN** e **Análise DJEN Servidor**.

Pelas imagens:

- Sem preencher “Data Disponibilização” e com **Somente Hoje**: card **Pautas DEJT = 4**.
- Ao preencher **Data Disponibilização = 26/06/2026** e mudar para “Todos os dias”: card **Pautas DEJT = 52**.

A consulta no banco confirma o diagnóstico:

```text
Local:    52 pautas com data_disponibilizacao = hoje BRT
Servidor: 52 pautas com data_disponibilizacao = hoje BRT
Servidor: só 4 pautas com data_publicacao = hoje
```

Então o erro não é que não foram gravadas. Elas foram gravadas. O erro é que, quando a data de disponibilização está vazia, a tela usa o filtro de “hoje” pela **data errada**.

## Do I know what the issue is?

Sim.

O problema é este: para **Pautas DEJT**, o sistema deve usar **data_disponibilizacao em BRT/São Paulo** como data principal. Hoje, quando o campo “Data Disponibilização” está vazio, os hooks caem no filtro genérico de “Somente Hoje”, que usa `data_publicacao`/`created_at`. Isso faz o card mostrar 4 em vez de 52.

A documentação confirma que a forma correta de tratar fuso no JavaScript é especificar `timeZone: 'America/Sao_Paulo'` com `Intl.DateTimeFormat`, e não depender de `new Date()`/`toISOString()` sem fuso.

## Arquivos envolvidos

- `src/hooks/usePublicacoesDjenUnificadas.ts`
- `src/hooks/usePublicacoesDjenServidorUnificadas.ts`

São os hooks que montam os filtros e os contadores da Análise DJEN Local e Servidor.

## Plano de correção

### 1) Criar uma regra única de “hoje BRT” para os dois hooks

Adicionar/usar helper para obter o dia atual em São Paulo:

```ts
getHojeBrtISO() // YYYY-MM-DD em America/Sao_Paulo
```

E parar de usar, para filtro de tela:

```ts
startOfDay(new Date()).toISOString()
endOfDay(new Date()).toISOString()
```

porque isso depende do fuso/UTC e já causou esse erro várias vezes.

### 2) Para Pautas DEJT, “Somente Hoje” deve filtrar por data_disponibilizacao

Quando `tipoOrigem === 'djet-pautas'` ou quando o card “Pautas DEJT” estiver sendo calculado:

- se o usuário informou “Data Disponibilização”, usar essa data;
- se não informou e está em “Somente Hoje”, usar **hoje BRT** automaticamente;
- comparar `data_disponibilizacao` como dia fechado:

```text
YYYY-MM-DDT00:00:00Z até YYYY-MM-DDT23:59:59.999Z
```

Isso é necessário porque as pautas são gravadas com semântica de data do DEJT, não como evento de captura.

### 3) Aplicar a mesma regra nos contadores e na lista

Corrigir nos dois hooks:

- card “Pautas DEJT”;
- total independente/header;
- lista principal;
- fallback de query direta;
- total de “Selecionar todos”.

O card e a lista devem usar exatamente a mesma janela de data.

### 4) Manter regra diferente para publicações normais

Para publicações DJEN comuns, não alterar agora a regra de deduplicação nem `id_djen`.

A mudança é específica para **filtro de data** e especialmente para **Pautas DEJT**.

## Resultado esperado

Depois da correção:

- Análise DJEN Local sem data preenchida + “Somente Hoje” deve mostrar **52** pautas, não 4.
- Análise DJEN Servidor sem data preenchida + “Somente Hoje” deve mostrar **52** pautas, não 4.
- Ao preencher manualmente `26/06/2026`, o número deve continuar batendo com “Somente Hoje”.
- Todo cálculo de “hoje” passa a usar **America/Sao_Paulo**.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>
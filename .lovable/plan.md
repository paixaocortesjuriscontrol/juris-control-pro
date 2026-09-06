# Distribuição TST sem cantos arredondados

## O que você vai ver

A tela Distribuição TST passa a ter todos os "blocos" com canto reto, tipo planilha/painel administrativo:

```text
ANTES                                DEPOIS
,----------------------------------.  +----------------------------------+
|  Até 2025            408         |  |  Até 2025              408         |
'----------------------------------'  +----------------------------------+
,----------------------,             |+----------------+ ----------------+|
| Digite algo...       |             || Digite algo... || Definir período ||
'----------------------'             |+----------------+-----------------+|
,----------------------------------.  +----------------------------------+
| filtros                (botões)  |  | filtros               (botões)   |
'----------------------------------'  +----------------------------------+
,----------------------------------.  +----------------------------------+
| DATA    PROCESSO   DOSSIÊ        |  | DATA   PROCESSO   DOSSIÊ         |
'----------------------------------'  +----------------------------------+
```

Ficam retos:
- os cards totalizadores (cada um e o "Total por Situação")
- o painel de filtros e todos os campos de digitação e listas de escolha dele
- os botões da tela (Planilha Dossiês, Carga Benner, Arquivar, Verificar pendências, etc.)
- o contêiner da lista de processos e os avisos verde e vermelho
- os pequenos retângulos dentro dos cards (números clicáveis e a faixa de responsáveis)

Continuam exatamente como estão:
- os selos e tags da segunda linha de cada registro (Pronto, CEJUSC, Duplicado, Arquivado, tags coloridas) — eles têm canto pequeno/formato de pílula e ficam intactos
- as bolinhas coloridas de status
- as caixinhas de seleção
- janelas que "flutuam" por cima da tela (ex.: janelas de importação, menus suspensos) — elas são desenhadas fora da página, então permanecem arredondadas. Se você quiser elas retas também, é um ajuste extra à parte.

Nada muda em dados, filtros, contagens ou qualquer funcionamento. É só aparência, e a mudança vale apenas para a tela Distribuição TST.

## Como reverter

Se não gostar, basta tirar uma palavra do código da tela (o nome da marca que identifica essa tela) e tudo volta ao arredondado de antes.

## Detalhes técnicos

Nenhuma alteração de banco, de regra de contagem ou de lógica.

1. `src/index.css` — novo bloco no final, no mesmo estilo do já existente `.processo-chrome`:

```css
/* Tela Distribuição TST — cantos retos na estrutura.
   Preserva rounded-full (selos/bolinhas) e rounded-sm (tags, caixinhas, itens de menu). */
.dist-tst-sharp [class~="rounded"],
.dist-tst-sharp [class*="rounded-md"],
.dist-tst-sharp [class*="rounded-lg"],
.dist-tst-sharp [class*="rounded-xl"],
.dist-tst-sharp [class*="rounded-2xl"],
.dist-tst-sharp [class*="rounded-3xl"] {
  border-radius: 0 !important;
}
```

2. `src/pages/DistribuicaoTst.tsx` — aplicar a marca no contêiner do conteúdo da tela (linha ~1954):

```tsx
<div className="dist-tst-sharp space-y-3">
```

Isso alcança os cards (`DistribuicaoTstStatsCards`, `TotalPorSituacaoCard` usam `Card` = `rounded-lg`), o painel de filtros (`rounded-lg`, linha 2453), os avisos (`rounded-lg`, linhas 2918 e 2929), o contêiner da tabela (`rounded-lg`, linha 2964) e os controles `Button`/`Input`/`Select` (todos `rounded-md`).

3. Conferir: `npx tsgo --noEmit -p tsconfig.app.json` e o log de build (`build OK`), e olhar a tela no preview já que você está logado nele — é lá que o resultado aparece.

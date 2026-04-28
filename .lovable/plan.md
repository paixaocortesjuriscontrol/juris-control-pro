## Diagnóstico

O processo selecionado na sua tela é:

- Processo: `0000755-53.2024.5.11.0001`
- Dossiê: **"Não localizado"**
- Turma: 5ª Turma / Relator: MORGANA DE ALMEIDA RICHA / Tipo de Recurso: RR

Ao clicar em **Carga Benner**, o componente `CargaBennerFromDb.processData()` aplica esta validação (linhas 88–100 e 374–387 de `src/components/distribuicao-tst/CargaBennerFromDb.tsx`):

```text
getMotivoRejeicaoDossie("Não localizado", ...) 
   → casa com /nao\s*(encontrad|localizad)/i
   → retorna "Dossiê não localizado"
   → linha vai para `rejected[]` e NÃO entra em `output[]`
```

Resultado: a planilha (Completa, Até Recurso, Até Análise) sai **vazia** (0 linhas), porque o único processo selecionado foi rejeitado. Apenas o botão **"Baixar Rejeições"** traz informação — e nele só aparecem 6 colunas (Dossiê, Processo, Data, Turma, Relator, Motivo), por isso "todas as informações da tela Distribuição TST + Dados Benner" não chegam à planilha.

A regra hoje é por design: o layout Carga Benner exige um dossiê válido para integrar a operadora terceirizada. Mas isso impede o uso quando o usuário quer gerar a planilha **com seleção manual** (clicou na linha e quer levar tudo, mesmo sem dossiê).

## O que mudar

Quando o usuário selecionar processos manualmente (caso de hoje: `selectedProcessNumbers` preenchido), permitir gerar o layout completo mesmo com dossiê inválido/ausente, marcando claramente esses casos. Quando rodar sem seleção (usando filtros em massa), manter o comportamento atual de rejeição automática para não contaminar a carga real.

### Mudanças em `src/components/distribuicao-tst/CargaBennerFromDb.tsx`

1. Detectar modo "seleção manual": `const isManualSelection = !!(selectedProcessNumbers && selectedProcessNumbers.length > 0);`
2. No loop de processamento (linhas 374–387):
   - Se `isManualSelection === true`:
     - Não descartar a linha por dossiê inválido nem por turma vazia.
     - Substituir o valor do dossiê por string vazia (ou manter o original) e seguir montando `outRow`.
     - Registrar o motivo em uma nova coluna interna `__aviso` para exibir no painel ("Dossiê não localizado", "Turma não preenchida", etc.), mas a linha entra em `output[]`.
   - Se `isManualSelection === false`: manter o fluxo atual (vai para `rejected[]`).
3. Construção da linha (`outRow`) já preenche corretamente Tribunal=TST, Tipo de Recurso (a partir de `tipo_recurso_reclamante` + `tipo_recurso_banco`), Data, Turma, Relator, Recorrente, posições turma/relator etc. — não precisa mexer no mapeamento, só em deixar a linha passar.
4. Atualizar o painel de stats:
   - Mostrar um cartão extra "Avisos (seleção manual)" listando quantas linhas foram incluídas com dossiê/turma faltando.
5. Toast final: ajustar mensagem para refletir o novo modo ("X linhas geradas, Y avisos").

### Validação adicional (defensiva)

- Se `cnj` (processo) estiver vazio na seleção manual, ainda assim rejeitar (não há como identificar o processo).
- Manter o filtro de "Trânsito em Julgado" como está.

### Comportamento esperado após o ajuste

Selecionando o processo `0000755-53.2024.5.11.0001` e clicando em **Carga Benner → Gerar Layout → Completa (A-AH)**, a planilha terá 1 linha com:

| Dossiê | Tribunal | Tipo de Recurso | Data Distrib. | Turma | Relator | Recorrente | ... |
|---|---|---|---|---|---|---|---|
| (vazio) | TST | Recurso de Revista | 22/08/2025 | 5ª Turma | MORGANA DE ALMEIDA RICHA | (recorrente) | ... |

E o cartão de stats mostrará: `1 linha • 1 aviso (Dossiê não localizado)`.

## Arquivos afetados

- `src/components/distribuicao-tst/CargaBennerFromDb.tsx` — única alteração necessária.

## Fora do escopo

- Não altera o fluxo da página `Carga Benner` (importação de planilhas externas), só o componente disparado pelo botão na tela **Distribuição TST**.
- Não muda o template `.xlsx`, nem o módulo `gerarPlanilhaBenner.ts`.

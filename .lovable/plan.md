# Distribuição TST — corrigir a leitura dos cards totalizadores

## O que os números realmente mostram (verificado no banco)

Consultei a base (15.371 registros da distribuição):

- Com matéria cadastrada por dossiê: **8.171**; sem matéria: **7.200** (606 destes nem têm dossiê preenchido).
- Prontos (pronto p/ envio, planilhado, enviado): 2.185 — sendo 1.953 com matéria e **232 sem matéria**.
- Marcados como "sem pendência": 1.222 — **todos** com matéria cadastrada. Entre os 7.200 sem matéria, nenhum está sem pendência.

Ou seja: ao clicar em 7.200 (sem matéria), "Pronto sem pendência = 0" está numericamente certo — falta matéria do dossiê, então todos têm pendência, exatamente como a lista mostra.

O que está errado é a **apresentação**, e isso confunde de duas formas:

1. Ao clicar em um lado do card "Com / Sem Matéria cadastrada", o outro lado vira 0 (o card passa a se filtrar a si mesmo), dando a impressão de que não existe nenhum processo com matéria.
2. Os cards não usam o mesmo escopo entre si: o card grande "Pronto sem pendência" / "Prontos com pendências" ignora os filtros vindos dos próprios cards (matéria, revisar lista, mais de um responsável), enquanto os cards por responsável e a lista respeitam. Assim o número de cima e o de baixo discordam na mesma tela.

## O que será feito

1. Padronizar o escopo: "Pronto sem pendência" e "Prontos com pendências" passam a usar exatamente os mesmos filtros da lista, como os demais cards e os cards por responsável.
2. O card "Com / Sem Matéria cadastrada" passa a sempre exibir os dois lados com os totais reais (ignorando apenas a própria seleção), destacando visualmente o lado selecionado — clicar não zera mais o outro número.
3. Aplicar a mesma regra aos outros cards de par ("Até 2025 / De 2026" e afins), para que a seleção destaque em vez de esvaziar o par.
4. Legenda/tooltip do card de pendências explicando a regra: contam-se apenas processos marcados como prontos; falta de matéria do dossiê é pendência.

## Detalhes técnicos

- `src/pages/DistribuicaoTst.tsx`: trocar `useProntoSemPendenciaCount(debouncedFilters)` por `listFilters` (mesmo escopo de `countsFilters`); calcular o par com/sem matéria a partir de `stats` obtido com os filtros sem `pedidosDossie`, mantendo `handleCardClick` como está.
- `src/components/distribuicao-tst/DistribuicaoTstStatsCards.tsx`: exibir os dois valores do par sempre, marcando o ativo por `activeKeys`.
- Nenhuma mudança de regra de negócio, de banco ou nos marcadores `sem_pendencia` / `tem_materias_dossie`.

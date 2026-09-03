# Distribuição TST — corrigir a pendência de matérias por dossiê

## O que está errado hoje

Verificado em `src/utils/distribuicaoTstPendencias.ts`:

1. **Dossiê sem lista de pedidos cadastrada não gera pendência.** `getMateriasForaDoDossie` sai logo no começo quando o dossiê não tem lista (`temLista = false`), e a pendência "Revisar lista de matérias" só é criada quando `temLista` é verdadeiro. Resultado: processos cujo dossiê não tem matérias cadastradas passam como "sem pendências", mesmo não podendo ir para a Carga Benner.

2. **A validação é global, não por parte.** A regra usa `validas === 0` somando as três partes. Então, se Reclamante tem uma matéria válida e Reclamada (Banco) não tem nenhuma válida, o processo é tratado como OK (no máximo vira aviso amarelo parcial).

## O que passa a valer

1. Processo cujo dossiê **não tem lista de pedidos cadastrada** vira pendência: "Sem matérias cadastradas para o dossiê — revisar lista de matérias".
2. Cada parte marcada em **Parte Recorrente** (Reclamante, Reclamada/Banco, Terceiro) precisa de **pelo menos uma matéria selecionada que conste na lista do dossiê**. Se qualquer parte marcada não tiver, o processo fica pendente, indicando na mensagem quais partes estão sem matéria válida (ex.: "Reclamante OK, Reclamada (Banco) sem matéria da lista do dossiê").
3. Quando todas as partes marcadas têm ao menos uma matéria válida e ainda existem matérias fora da lista, continua sendo apenas aviso amarelo (comportamento atual preservado).
4. O card **Revisar lista de matérias** no painel e a contagem por responsável passam a usar exatamente a mesma regra, então o total do card volta a bater com a lista.

Nada muda na geração da Carga Benner nem no banco de dados — é só a regra de pendência/validação.

## Detalhes técnicos

- `getMateriasForaDoDossie(row)` passa a devolver também `validasPorParte` e `partesSemMateriaValida: string[]`, contando as válidas por bloco (`materias_analise_reclamante` / `_banco` / `_terceiro`) em vez de um único contador, e deixa de sair antes quando `temLista` é falso (mantém `temLista: false` e as partes ativas conhecidas).
- `precisaRevisarListaMaterias(row)` passa a retornar `true` quando `!temLista` **ou** `partesSemMateriaValida.length > 0`.
- Em `getPendenciasEAvisos`, o bloco das linhas 494-513 vira: pendência `revisar_lista_materias` quando `!temLista` (label específico) ou quando há partes sem matéria válida (label com as partes); aviso parcial só no caso restante.
- Partes ativas continuam vindas de `parseParteRecorrente(row)`; quando "Parte Recorrente" está vazio, seguem valendo as três partes, como hoje.
- `src/hooks/useSemMateriaDossiePorResponsavel.ts` já chama `precisaRevisarListaMaterias`, então o card acompanha automaticamente; o hook precisa apenas garantir que `dossie` e os três campos `materias_analise_*` venham no `select` (hoje traz `materias_analise_reclamante` e `_banco` — falta `_terceiro`).

# Carga Benner — exportar o nome da matéria exatamente como está no cadastro do dossiê

## O que foi verificado

Na geração da carga (`src/components/distribuicao-tst/CargaBennerFromDb.tsx`, função `joinUniqueMat`, e o mesmo trecho em `src/utils/gerarPlanilhaBenner.ts`), o nome que vai para a planilha é `String(it.materia).trim()` — ou seja, **o texto gravado no formulário do processo**, não o texto cadastrado em `pedidos_por_dossie`.

A validação (`isMateriaDoDossie` / `isMateriaOficial`) compara **normalizado** (sem acento, minúsculo). Então uma matéria com caixa/acento diferente passa na validação e é exportada com a grafia divergente.

Números reais do banco (pares dossiê × matéria selecionada, considerando só dossiês que têm lista cadastrada): 1.300 pares no total — **533 iguais letra a letra**, **2 iguais só depois de normalizar** e **765 que não constam na lista daquele dossiê** (esses são o caso já tratado pelas pendências / rejeição).

Exemplos dos 2 divergentes:

```text
dossiê 07.02.002.0004037848/24
  gravado : Horas extras 7ª e 8ª - cargo de confiança J8
  cadastro: Horas extras 7ª e 8ª - Cargo de confiança J8

dossiê 07.02.033.0003692790/23
  gravado : Devolução de descontos
  cadastro: Devolução de Descontos
```

Conclusão: **não está garantido**. Hoje é coincidência na maioria dos casos, e existem divergências reais saindo na planilha.

## O que passa a valer

1. Ao montar as colunas de matérias da Carga Benner, o nome exportado passa a ser **sempre o texto cadastrado em `pedidos_por_dossie` para aquele dossiê**, quando a matéria bate por comparação normalizada.
2. Se a matéria não estiver na lista do dossiê, cai na lista oficial (`materias_pedidos_oficiais`) como segunda fonte da grafia.
3. Se não estiver em nenhuma das duas, mantém o texto atual do formulário (comportamento de hoje) — a rejeição/pendência continua igual.
4. "Outra Matéria" continua saindo com o nome em branco.
5. Nada muda nas regras de pendência, rejeição, quantidade de linhas ou demais colunas — só a grafia do nome da matéria.

## Detalhes técnicos

- `src/utils/pedidosPorDossieCache.ts`: além do `Set` normalizado, guardar `Map<normalizado, pedidoOriginal>` por dossiê e expor `nomeCanonicoDoDossieSync(dossie, materia): string | null`.
- `src/utils/materiasOficiaisCache.ts`: guardar também `Map<normalizado, nomeOriginal>` e expor `nomeOficialCanonicoSync(materia): string | null`.
- Nova função utilitária `canonicalizarMateria(dossie, materia)` (em `src/utils/outraMateria.ts` ou arquivo novo `src/utils/materiaCanonica.ts`), aplicada:
  - em `CargaBennerFromDb.tsx`, dentro de `joinUniqueMat` e no `filtrarMateriasExportaveis` (usar o mapa local já carregado do dossiê em vez do cache global, pois o componente já monta `materiasOficiaisSet` e o mapa de pedidos por dossiê — ambos passam a guardar o texto original);
  - em `src/utils/gerarPlanilhaBenner.ts`, dentro de `joinUnique`.
- A deduplicação continua por chave normalizada, então duas grafias da mesma matéria seguem colapsando em uma só entrada — agora com a grafia do cadastro.

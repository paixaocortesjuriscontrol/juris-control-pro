# Pendências que apareceram nos processos da Dra. Rayanna Prado

## O que aconteceu

Hoje, 16/09/2026, às 12:17 (BRT), uma verificação de pendências marcou **11 processos** da Dra. Rayanna como "pronto **com** pendência". Todos os 11 têm em comum:

- "Terceiro" marcado na Parte Recorrente (sozinho ou junto com Reclamante/Reclamada);
- tipo de recurso do Terceiro preenchido com valor válido;
- o dossiê **tem** lista de pedidos cadastrada desde 04/09.

O motivo gravado foi "Revisar lista de matérias / sem matérias cadastradas para o dossiê" — o que não corresponde à realidade: as listas existem. Na tela, ao abrir cada processo, ele aparece como **Sem pendências**; só o número vermelho do card ficou errado.

Causa: no momento em que a verificação rodou, a lista de "Pedidos por dossiê" não estava carregada na tela. Hoje o sistema ignora essa falha e continua o cálculo como se **nenhum** dossiê tivesse lista, gerando pendência falsa em tudo que foi verificado naquele momento. Só esses 11 foram atingidos porque a verificação respeita os filtros da tela.

Ela não ganhou pendências novas de conteúdo: são 11 marcações indevidas. O total dela hoje é 549 prontos, 381 sem pendência e 168 com pendência — descontando essas 11, volta a 157.

## O que será feito

1. **Impedir a marcação falsa:** se a lista de "Pedidos por dossiê" (ou a lista oficial de matérias) não carregar, a verificação para, avisa na tela e **não grava nada** — em vez de marcar todo mundo como pendente.
2. **Corrigir a regra do Terceiro:** quando "Terceiro" é a única parte recorrente, não há matérias a conferir, então esse processo não pode receber a pendência de "revisar lista de matérias".
3. **Corrigir os 11 processos da Dra. Rayanna** já marcados por engano, voltando para "sem pendência".
4. Conferir se outros responsáveis foram atingidos pela mesma verificação e corrigir junto, se houver.

## Detalhes técnicos

- `src/utils/distribuicaoTstSemPendencia.ts`: trocar `await ensureMateriasOficiais().catch(() => {})` e `await ensurePedidosPorDossie().catch(() => {})` por carga obrigatória; abortar (`throw`) quando `pedidosPorDossieCarregados()` for falso, nas três rotinas (`recalcularSemPendencia`, `atualizarSemPendenciaRegistro`, `atualizarSemPendenciaLote`).
- `src/pages/DistribuicaoTst.tsx`: `handleVerificarPendencias` trata o erro com toast explicativo ("não foi possível carregar a lista de pedidos por dossiê — tente novamente").
- `src/utils/distribuicaoTstPendencias.ts`: em `getPendenciasRejeicaoCarga`, só emitir a pendência `revisar_lista_materias` quando existir parte ativa com matérias a validar; `precisaRevisarListaMaterias` devolve `false` quando não há parte ativa (caso "Terceiro" sozinho).
- Migração de correção: `UPDATE dados_benner SET sem_pendencia = true, revisar_lista_materias = false, pendencias_verificado_em = now()` para os registros prontos marcados na janela de 16/09 12:17 BRT cujo dossiê tem lista em `pedidos_por_dossie`.

## Verificação

- Rodar "Verificar Pendências" com filtro do nome dela e conferir que os 11 não voltam a ficar vermelhos.
- Conferir que o card "Pronto com pendência" dela cai de 168 para 157.
- Abrir um processo com "Terceiro" sozinho e confirmar "Sem pendências" na ficha e no card.

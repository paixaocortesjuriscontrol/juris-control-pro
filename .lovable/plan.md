# Evitar tarefas repetidas ao distribuir publicações duplicadas

## Situação atual
Hoje, se o advogado marcar todas e distribuir sem descartar as duplicadas, o sistema cria **uma tarefa para cada cópia**. Só é pulada a publicação que já tem item criado. Resultado: o mesmo processo recebe 2 ou mais tarefas iguais no grupo.

## O que muda
1. No painel de distribuição, cópias da mesma publicação (mesmo processo, mesma data e texto praticamente igual — mesma regra usada no botão descartar) aparecem juntas como **uma linha só**, com o aviso "X cópias".
2. Ao confirmar, é criada **uma única tarefa** por publicação; todas as cópias ficam vinculadas a essa tarefa e marcadas como lidas.
3. Se uma das cópias já tiver item criado, o grupo inteiro é pulado ("já tem item criado").
4. O resumo no topo passa a mostrar quantas cópias foram agrupadas.

## Detalhes técnicos
- Reaproveitar a chave de agrupamento do descarte de `AnaliseDjen.tsx` em `src/lib/gruposGol.ts` (função `agruparDuplicadasDistribuicao`).
- `DistribuirGruposGolSheet.tsx`: linhas por grupo; `jaTemItem` = algum membro com item; ao confirmar, inserir 1 tarefa e vincular/marcar lidas todas as publicações do grupo.
- Teste em `src/lib/gruposGol.test.ts`: 3 cópias do mesmo processo → 1 linha; processos diferentes → linhas separadas.

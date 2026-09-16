# Carga errada de "Pedidos por dossiê" (16/09, 15:53 BRT) e fichas da Dra. Rayanna

## Resposta à pergunta

Sim. Três processos da Dra. Rayanna que estavam marcados como **Pronto** passaram a ter pendência depois da última carga:

- 0000201-13.2021.5.05.0027 — dossiê 07.02.033.0003096780/21
- 0011898-70.2022.5.15.0042 — dossiê 07.02.033.0003399637/22
- 0001280-60.2024.5.13.0007 — dossiê 07.02.033.0004180327/24

Antes, esses dossiês não tinham nenhum pedido cadastrado. Na carga de hoje, 16/09/2026 às 15:53-15:54 (BRT), cada um ganhou **um único "pedido"** — e esse "pedido" é o **número do processo**, não uma matéria. Por isso as matérias escolhidas na ficha não batem com a lista e as três aparecem como "Revisar lista de matérias".

## O que aconteceu na carga

A carga de 15:53-15:54 gravou **7.054 linhas em 7.054 dossiês**, uma por dossiê, e **todas** são números de processo (com ou sem pontuação, algumas com apóstrofo na frente). Nenhuma matéria real entrou. Nas cargas anteriores não existe nenhuma linha assim. Foi enviada a planilha errada, ou a coluna errada (número do processo em vez da lista de pedidos).

Efeito total: 14 fichas prontas ficaram ligadas a dossiês "com pedidos" que na verdade não têm; 13 delas estão com pendência.

## Correção proposta

1. Apagar as 7.054 linhas gravadas nessa carga de 15:53-15:54 (identificadas por data/hora e pelo formato de número de processo), devolvendo esses dossiês ao estado anterior. Nada das cargas de 02/09, 04/09 e 12:27 de hoje é tocado.
2. Registrar a remoção no histórico de cargas, para ficar rastreável.
3. Recalcular as pendências das 14 fichas afetadas (incluindo as 3 da Dra. Rayanna), que voltam a ficar sem pendência de lista de matérias.
4. Passar a **recusar a importação** quando os valores da coluna de pedidos forem números de processo: a tela avisa "a planilha parece conter números de processo, não matérias" e não grava nada.

## Detalhes técnicos

- Migração de limpeza: `DELETE FROM pedidos_por_dossie WHERE created_at >= '2026-09-16 18:50:00+00' AND pedido ~ '^''?\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$' OR (created_at >= '2026-09-16 18:50:00+00' AND regexp_replace(pedido,'\D','','g') ~ '^\d{20}$')` — cobre os 5.996 formatados, os com apóstrofo e os de 20 dígitos.
- Depois do delete, recalcular `sem_pendencia`, `revisar_lista_materias` e `sem_nenhuma_materia_dossie` das fichas prontas dos dossiês afetados (mesma rotina de `atualizarSemPendenciaLote`), ou marcar `pendencias_verificado_em = null` para a revalidação automática da tela reprocessá-las.
- `src/components/distribuicao-tst/PedidosPorDossieDialog.tsx`: validação nova antes do upsert — se mais de ~30% dos pedidos extraídos casarem com padrão CNJ (`\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}` ou 20 dígitos após limpar), aborta com mensagem clara e não grava; linhas individuais nesse formato são sempre descartadas e contadas como "ignoradas".

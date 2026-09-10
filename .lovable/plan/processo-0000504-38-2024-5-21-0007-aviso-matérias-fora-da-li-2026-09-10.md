# Processo 0000504-38.2024.5.21.0007 — aviso "Matérias fora da lista"

## O que está acontecendo

O processo **não tem pendência de verdade** (na base ele está marcado como "sem pendência"). O que aparece é o aviso amarelo "Verificar (não conta como pendência)".

Causa confirmada na base: sobrou uma matéria antiga escondida na análise do Reclamante — **"Indenização danos morais - doença ocupacional"**. Ela não está mais na lista de matérias selecionadas (que hoje tem 3 matérias, todas verdes e aceitas), mas continuou gravada na tabela interna de análise por matéria. Como o aviso é calculado só a partir dessa tabela interna, ele acusa uma matéria que a tela nem mostra mais.

Ou seja: quando a advogada troca/remove uma matéria, a linha de análise da matégia antiga não é apagada, e volta a assombrar nos avisos e na conferência.

## Correção proposta

1. Passar a considerar apenas as matérias que estão realmente selecionadas nos quadros Reclamante / Banco / Terceiro ao avaliar "fora da lista oficial" e "fora da lista de pedidos do dossiê". Matérias órfãs deixam de gerar aviso ou pendência.
2. Ao salvar a ficha, limpar as linhas de análise de matérias que não estão mais selecionadas, para a base não acumular resíduos.
3. Limpeza única na base: remover das análises por matéria as entradas que não constam na lista de matérias selecionadas do próprio registro (inclui este processo).
4. Reexecutar a verificação de pendência dos registros afetados para os cards e a lista ficarem coerentes.

## Detalhes técnicos

- `src/utils/distribuicaoTstPendencias.ts`: em `getMateriasForaDaLista` e `getMateriasForaDoDossie`, filtrar os itens de `materias_analise_*` pelo conjunto de nomes presentes em `materias_recurso_*` (comparação normalizada, minúsculas/sem acento), reaproveitando a lógica de `materiasSelecionadasDe`. Quando o campo de matérias selecionadas estiver vazio, manter o comportamento atual (usar o JSONB inteiro).
- Salvamento da ficha (`DistribuicaoTstDetail` / gravação em `dados_benner`): remover do JSONB os itens cuja matéria não está na string de matérias selecionadas antes do update.
- Migração de limpeza: `UPDATE dados_benner` removendo elementos de `materias_analise_reclamante/banco/terceiro` ausentes da respectiva string `materias_recurso_*`, seguido de recálculo de `sem_pendencia` para os registros tocados.
- Conferir se a mesma normalização é usada em `CargaBennerFromDb` para não divergir entre tela e planilha.

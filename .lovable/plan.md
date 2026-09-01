# "Outra Matéria" passa a ser neutra e vai para a Carga Benner

## Regra nova

Quando "Outra Matéria" estiver selecionada (sozinha ou junto com outras matérias):

1. **Não cria pendência** e **não cria aviso amarelo** — nem na tela de consulta, nem no botão "Verificar Pendências", nem no relatório/kanban. Os sub-itens (Aparelhamento, Chance Turma, Chance Relator, Êxito) dela deixam de ser cobrados.
2. **Não rejeita** na geração da Carga Benner. Ela deixa de contar como "matéria fora da lista oficial de pedidos".
3. **Vai para a planilha**: o texto "Outra Matéria" é escrito normalmente nas colunas de matérias (Favorável/Desfavorável turma e relator, Bem/Mal aparelhado, Com chances de êxito), conforme o preenchimento feito pela advogada.
4. Continua aparecendo como linha na tabela "Análise por Matéria", para a advogada poder preencher se quiser — apenas sem cobrança.
5. Nenhum alerta na lista da Distribuição TST informando "processos preenchidos com Outra Matéria".

O bloqueio de matérias realmente fora da lista oficial (que não sejam "Outra Matéria") continua valendo como hoje.

## Detalhes técnicos

- `src/utils/outraMateria.ts`: `aplicarRegraOutraMateria` deixa de filtrar (passa a devolver a lista intacta) ou é removida dos pontos de uso; comentário do arquivo atualizado para a nova regra. `isOutraMateria` continua existindo para o caso da Carga.
- `src/utils/distribuicaoTstPendencias.ts`: em `pendenciasMateriasAnalise`, "Outra Matéria" é ignorada na geração de pendências/avisos (nem `aviso: true`); remover o cálculo `somenteOutraMateria`.
- `src/components/distribuicao-tst/CargaBennerFromDb.tsx`: em `filtrarMateriasExportaveis`, "Outra Matéria" passa a ser considerada válida (não incrementa `materiasForaListaCount` nem entra no motivo "Matérias fora da lista oficial de pedidos"). Assim o processo não é rejeitado e o texto sai na planilha.
- `src/utils/gerarPlanilhaBenner.ts`: remover o `!isOutraMateria(i.materia)` do filtro (linha ~216) para o gerador de planilha direta.
- `src/components/distribuicao-tst/MateriasAnaliseList.tsx`: parar de aplicar `aplicarRegraOutraMateria`, exibindo a linha de "Outra Matéria" sempre.
- `src/pages/DistribuicaoTst.tsx`: remover o painel de alerta `processosComOutraMateria` e excluir "Outra Matéria" da checagem `processosComMateriaForaDaLista` (já é o caso hoje).
- Sem mudança de banco de dados.

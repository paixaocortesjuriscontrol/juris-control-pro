# "Outra Matéria" não pode gerar pendência de lista de matérias

## O que está acontecendo

Na ficha da Distribuição TST, quando a única matéria escolhida de uma parte é **Outra Matéria**, a tela acusa a pendência "Revisar lista de matérias / Sem matérias cadastradas para o dossiê — NÃO irá para a planilha de Carga Benner".

Isso está errado, e a prova está na própria geração da Carga Benner: lá, **Outra Matéria é sempre aceita** (vai para a planilha com o nome em branco), sem depender da lista de pedidos do dossiê. Ou seja, a tela acusa uma rejeição que a planilha não faz.

O efeito ficou mais visível depois da limpeza de hoje (16/09/2026), porque 7.054 dossiês perderam a "lista de pedidos" falsa que havia sido carregada por engano — dossiês sem lista voltaram a cair nessa regra.

## Como vai ficar

1. **Outra Matéria conta como matéria válida sempre**, inclusive quando o dossiê não tem nenhum pedido cadastrado.
2. Uma parte recorrente (Reclamante e/ou Reclamada) cuja seleção tenha Outra Matéria **não gera** a pendência "Revisar lista de matérias".
3. A pendência continua existindo quando a parte tem matérias reais e **nenhuma** delas está na lista de pedidos do dossiê — mesmo comportamento da planilha.
4. O totalizador "Pronto sem nenhuma matéria na lista do dossiê" passa a seguir o mesmo critério, para não contar fichas que na verdade vão para a planilha.
5. As fichas já marcadas por engano são corrigidas no banco, sem ninguém precisar clicar em "Verificar Pendências".

## Detalhes técnicos

- `src/utils/distribuicaoTstPendencias.ts`
  - `getMateriasForaDoDossie`: tratar `isOutraMateria(nome)` como válida independentemente de `res.temLista` (hoje só conta quando `temLista` é `true`); marcar em cada bloco se há Outra Matéria.
  - `precisaRevisarListaMaterias`: quando `!temLista`, só retornar `true` se existir ao menos uma parte ativa **sem** Outra Matéria selecionada; manter a regra atual de `partesSemMateriaValida` quando há lista.
  - `semNenhumaMateriaDoDossie`: aceitar Outra Matéria como matéria válida do dossiê (alinhando com a exportação).
- Verificação no banco: recalcular `sem_pendencia`, `revisar_lista_materias` e `sem_nenhuma_materia_dossie` das fichas prontas (`pronto_envio`, `planilhado`, `enviado`) marcando `pendencias_verificado_em` com data antiga, para a revalidação automática da tela reprocessá-las em segundo plano.
- Nada muda em `CargaBennerFromDb.tsx` — a geração da planilha já está correta.

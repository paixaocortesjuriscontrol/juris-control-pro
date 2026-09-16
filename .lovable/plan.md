# Corrigir as pendências dos dossiês já enviados

## Diagnóstico confirmado

- A tag **“PEDIDOS CADASTRADOS DOSSIÊ JÁ ENVIADOS”** é apenas informativa e não possui regra especial no cálculo. Conforme definido, os registros com essa tag devem ser recalculados normalmente.
- Há **388 processos prontos/planilhados/enviados** com essa tag. Destes, **81 ainda estão marcados com pendência de revisão de matérias**; **57 possuem pedidos cadastrados no dossiê** e precisam ser reavaliados com a lista atual.
- Na Dra. Rayanna, a tag abrange **109 processos prontos**: 76 estão sem pendência e 33 ainda estão marcados para revisão.
- As 81 marcações remanescentes foram gravadas em **05/09/2026 às 09:06 BRT**, antes da correção atual. Entre elas há **3 casos com somente Terceiro**, que pela regra vigente não devem ter pendência de matérias. Portanto, o marcador persistido está desatualizado em pelo menos esses casos.
- O cálculo atual já reconhece corretamente “Terceiro” sozinho, mas os registros antigos não são corrigidos até passarem por uma nova verificação.

## Implementação

1. **Tornar a carga das listas obrigatória**
   - Confirmar o carregamento tanto da lista oficial de matérias quanto de “Pedidos por dossiê”.
   - Se qualquer uma falhar, interromper antes de alterar registros e mostrar uma mensagem clara.

2. **Recalcular os registros afetados com a regra atual**
   - Reprocessar todos os processos prontos, planilhados ou enviados que possuem a tag “PEDIDOS CADASTRADOS DOSSIÊ JÁ ENVIADOS”.
   - Manter a tag apenas como filtro do grupo; ela não concede isenção e não força “sem pendência”.
   - Gravar `sem_pendencia`, `revisar_lista_materias` e `sem_nenhuma_materia_dossie` de acordo com os pedidos e matérias atuais de cada ficha.

3. **Conferir os casos da Dra. Rayanna e os demais responsáveis**
   - Validar individualmente os 3 casos de “Terceiro” sozinho.
   - Comparar os 57 dossiês que têm pedidos cadastrados e separar os que realmente continuam com matérias incompatíveis.
   - Conferir também Ana Carolina, Tatiana, Paula, Daniela, Camilla, Kellen e Lienne, pois existem registros da mesma marcação antiga vinculados a elas.

4. **Evitar nova divergência**
   - Após o recálculo, atualizar juntos os números dos cards, ranking e lista.
   - Garantir que uma nova verificação com o mesmo filtro produza exatamente os mesmos resultados, sem voltar a marcar casos corrigidos.

## Validação

- A soma de “Pronto sem pendência” e “Pronto com pendência” deve fechar com o total de prontos de cada responsável.
- Os 3 casos com somente Terceiro devem ficar sem pendência de revisão de matérias.
- Os demais casos só permanecem vermelhos quando houver uma pendência real na ficha ou quando as matérias das partes recorrentes não coincidirem com os pedidos cadastrados do dossiê.
- Rodar novamente a verificação do mesmo grupo e confirmar que nenhum número muda na segunda execução.

# Santander Cível: botão "Lida (somente esta)" e erro da Jéssica ao mudar situação

## 1) Botão "Lida (somente esta)" que sumiu e voltou
No print, a publicação já mostra **"Lida por Giovanna"**. Quando outra pessoa da coordenação marca uma publicação como lida, o botão dá lugar a essa etiqueta. Se a marcação é desfeita ou a tela recarrega com outra situação, o botão volta. Isso é o comportamento esperado, não uma falha. Nada a mudar aqui.

## 2) Jéssica Ferreira não consegue alterar a situação
**O que encontrei:**
- Ela é responsável principal nas 26 atividades em aberto dela. As regras de permissão a deixam mudar a situação, e de fato ela mudou várias hoje (por exemplo, às 16h28 BRT, um prazo "CRAZ RI" passou para "A confirmar").
- O sistema registrou 10 falhas dela desde ontem, a última hoje às 16h28 BRT, com o erro "Cannot coerce the result to a single JSON object".
- Em todas, o pedido chegou ao banco **sem nenhum campo para alterar**, só com o identificador da atividade. Isso acontece quando a tela de Prazo é salva sem diferença detectada (ela passou a enviar só os campos alterados). O banco não atualiza nada e devolve esse erro, e a pessoa vê a mensagem técnica. Segundos depois, ao tentar de novo, a mudança funcionou.
- Não é o mesmo problema do Paulo (aquele era de permissão em eventos e já foi corrigido).

**O que vou mudar:**
1. Quando não houver nada para gravar, salvar sem chamar o banco e fechar normalmente, sem erro.
2. Conferir na tela de Prazo por que a troca de situação feita na própria tela às vezes não entra na lista de campos alterados, e garantir que entre sempre.
3. Aplicar a mesma proteção nas outras telas que gravam tarefas, eventos e audiências com o mesmo padrão.
4. Teste: salvar sem alterações não gera erro; mudar só a situação envia a situação.

## Detalhes técnicos
- `usePrazos.useUpdateTarefa`: se `updates` estiver vazio, buscar e devolver a linha atual em vez de `update({}).select().single()`.
- `PrazoDialog.tsx`: revisar o cálculo de campos alterados (status/data_cumprimento) para não ficar vazio quando a situação mudou.
- Procurar outros `update(...).select().single()` que podem receber objeto vazio (EventoDialog, NovaTarefa, TarefaAgendaPanel) e aplicar a mesma proteção.
- Sem mudança no banco nem nas permissões.

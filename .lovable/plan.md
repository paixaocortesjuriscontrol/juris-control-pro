# Publicações diferentes do mesmo processo marcadas como lidas juntas

## O que acontece (confirmado nos dados da Dra. Janaina)
Quando ela trata uma publicação e clica em **Salvar e fechar**, o sistema também marca como lidas as publicações que considera "a mesma". Isso serve para cópias da mesma intimação, que chegam por mais de um login ou para cada destinatário.

O problema é que, para comparar, o sistema olha só o **começo do texto** (cerca de 400 letras). Em processos com dois atos no mesmo dia, esse começo é igual: tribunal, vara, número e partes. Por isso, atos diferentes são tratados como iguais.

Exemplo real (processo 0001559-44.2026.5.10.0012, 23/11): o Despacho ID 885c66d, que marca a audiência e a perícia, e o Despacho ID ab6c39c, que troca o perito, foram marcados como lidos juntos. Nos últimos 10 dias isso aconteceu pelo menos 15 vezes só com ela, em grupos de 2 a 4 publicações.

**Para a Dra. Janaina, enquanto isso:** as publicações que somem não foram apagadas. Elas foram marcadas como lidas. Para encontrá-las, basta trocar o filtro de "Não lidas" para "Lidas" ou "Todas" e buscar pelo número do processo.

## O que vou fazer
1. **Separar atos diferentes:** duas publicações só contam como "a mesma" se tiverem também o mesmo número do ato (o "ID xxxxxxx" do despacho, decisão ou sentença) quando o texto informar esse número. Cópias da mesma intimação continuam sendo agrupadas e lidas juntas, como hoje.
2. Isso vale para todos os lugares que usam essa comparação: Salvar e fechar, criar tarefa/prazo a partir da publicação, marcar como lida e a contagem e listagem de não lidas.
3. **Leituras já feitas:** não desmarco nada automaticamente. Se você quiser, gero uma lista das publicações que foram lidas junto com outra de ato diferente, para a equipe conferir.

## Detalhes técnicos
- Alterar `compute_djen_conteudo_dedup_key` para acrescentar `|a<id>` quando o conteúdo tiver `(Despacho|Decisão|Sentença|Acórdão|Ata|Certidão|Documento)[^.]{0,40}ID[[:space:]]+([0-9a-f]{7})`. Assim, a mesma função continua compartilhada entre a listagem e a leitura.
- Recalcular índices ou colunas que dependam da função, se existirem, e conferir antes com `pg_depend`/`pg_indexes`.
- Validar com consulta: o par 885c66d/ab6c39c fica com chaves diferentes, e cópias com o mesmo ato e outro destinatário continuam com a mesma chave.
- Teste SQL com esses dois casos.

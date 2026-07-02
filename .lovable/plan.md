**Diagnóstico exato**

A diferença quase tripla não é uma diferença real entre Browser e Servidor. É erro de critério no totalizador da tela **Análise DJEN**:

- A lista/print do Browser mostra **1.344** porque está contando publicações **capturadas hoje em BRT** (`created_at` de 02/07 BRT).
- O totalizador/RPC passou a contar por **data_publicacao/data_disponibilizacao de hoje**, o que inclui publicações capturadas em execuções anteriores, mas com publicação/disponibilização em 02/07.
- No banco, para 02/07/2026:
  - Browser por captura BRT: **1.344**
  - Browser por data de publicação/disponibilização: **3.925**
  - Servidor por captura BRT: **1.347**
  - Servidor por data de publicação/disponibilização: **3.930**
- Ou seja: o “quase triplo” vem de misturar **data jurídica da publicação** com **data da captura/execução**.

**Plano de correção**

1. **Padronizar “Somente Hoje” na Análise DJEN**
   - Na tela Browser (`Análise DJEN`), usar `created_at` em BRT para o filtro “Somente Hoje”, igual ao número que a tela já está mostrando/listando.
   - Manter o campo manual “Data Disponibilização” como filtro jurídico específico quando o usuário quiser buscar pela data da publicação.

2. **Ajustar a RPC de totalizadores do Browser**
   - Corrigir `get_djen_stats_per_user` para, quando não houver `dataDisponibilizacao` manual, contar por captura BRT (`created_at`) e não por `data_publicacao/data_disponibilizacao`.
   - Preservar a regra Kurier: Kurier sempre por captura BRT.

3. **Alinhar listagem e cards**
   - Garantir que `totalHoje`, `Não Lidas`, `Por Termos` e “Publicações Únicas” usem o mesmo critério da lista.
   - Evitar que os cards mostrem 3.900 enquanto a lista mostra 1.300.

4. **Não mexer no motor de busca**
   - Não alterar execução DJEN, validação de termos, deduplicação do motor ou isolamento Browser/Servidor.
   - A mudança é apenas de critério de filtro/contagem da tela de análise.

5. **Validação após implementar**
   - Conferir no banco que a tela Browser volta a mostrar aproximadamente **1.344** para 02/07 BRT.
   - Conferir que a tela Servidor fica próxima (**1.347**) usando o mesmo critério.
   - Conferir que ao preencher manualmente “Data Disponibilização”, o filtro continua buscando pela data jurídica da publicação.
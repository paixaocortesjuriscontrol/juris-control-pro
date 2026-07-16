## Problema confirmado

Na coordenação Dr. Thomás, o botão informa “Nenhuma duplicada encontrada”, mas há duplicadas visíveis na tela porque existem dois problemas combinados:

1. **Intervalo errado no botão**: quando os campos do bloco de descarte estão vazios, o botão força apenas o dia atual. As duplicadas do print são de **publicação 15/07** e **disponibilização 14/07**, então ficam fora da janela consultada.
2. **Regra incompleta para Kurier**: o Kurier às vezes manda o `id_djen` dentro do texto como `ID COMUNICAÇÃO <número>`, não em campo próprio. Quando não extraímos isso, algumas duplicadas ficam com `id_djen = null` e dependem de hash de conteúdo. No caso do canal legado `TRF 1`, também há recortes sem esse ID, então precisa existir fallback por processo + data + conteúdo normalizado.

## Plano de correção

### 1. Corrigir o comportamento do botão na tela

Em `src/pages/AnaliseDjen.tsx`:

- Fazer o botão “Descartar duplicadas da coordenação” usar, por padrão, os filtros já aplicados na tela:
  - se houver `Data de Disponibilização`, usar essa data;
  - senão, se houver `Data de Publicação`, usar essa data;
  - senão, se houver `Data Início/Fim (captura)`, usar esse intervalo;
  - só usar “hoje” se nenhum filtro de data estiver aplicado.
- Atualizar o texto de confirmação para deixar claro qual intervalo será usado.
- Se a tela estiver mostrando publicações de 14/07 ou 15/07, o botão vai consultar esse mesmo período, não apenas 16/07.

### 2. Extrair `id_djen` do texto Kurier

Em `supabase/functions/kurier-consultar-publicacoes/index.ts`:

- Adicionar parser para `ID COMUNICAÇÃO <número>` em `Texto`/`PUBLICACAO`.
- Gravar esse número em `publicacoes_djen.id_djen` quando existir.
- Manter `id_kurier` como identificador interno do Kurier.

### 3. Backfill dos registros já existentes

Criar migração para:

- Popular `publicacoes_djen.id_djen` nos registros Kurier antigos onde `id_djen IS NULL` e o conteúdo contém `ID COMUNICAÇÃO`.
- Fazer o mesmo em `publicacoes_djen_descartadas`, para histórico ficar consistente.

### 4. Fortalecer a função de descarte

Atualizar `descartar_duplicadas_coordenacao` para detectar duplicadas Kurier por três camadas:

1. mesma coordenação + mesmo `id_djen`;
2. mesmo processo + mesma data + conteúdo Kurier normalizado sem “Parte intimação”;
3. fallback para recortes Kurier legados sem `id_djen`, como os dois do print (`id_kurier` diferentes, mesmo processo/data/conteúdo normalizado).

Também ajustar a janela da função para considerar corretamente `data_disponibilizacao`, `data_publicacao` e `created_at`, evitando perder publicações que aparecem na tela por uma data mas são filtradas na função por outra.

### 5. Validar no caso do Dr. Thomás

Depois de implementar:

- Rodar consulta no processo `1011123-46.2025.4.01.4200` da coordenação Dr. Thomás.
- Confirmar que os dois Kurier iguais (`id_kurier 2957056940` e `2957057687`) entram no mesmo grupo de duplicidade.
- Executar/validar o descarte e confirmar que uma fica na lista e a outra vai para `publicacoes_djen_descartadas` com lote de desfazer.

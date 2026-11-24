# Marcar como lida só a publicação tratada

## O que acontece (confirmado nos dados da Dra. Janaina)
Ao usar **Salvar e fechar** ou **Marcar como lida**, o sistema também marca como lidas outras publicações que considera "iguais". Para comparar, ele olha só o começo do texto, onde aparecem o tribunal, a vara, o processo e as partes. Assim, atos diferentes do mesmo processo no mesmo dia são marcados juntos.

Exemplo: no processo 0001559-44.2026.5.10.0012, o Despacho ID 885c66d e o Despacho ID ab6c39c foram marcados juntos. Isso aconteceu pelo menos 15 vezes com ela em 10 dias.

As publicações não foram apagadas. Ela pode encontrá-las pelo filtro "Lidas" ou "Todas", buscando pelo número do processo.

## O que vou fazer (como você sugeriu)
- **Salvar e fechar**, **Marcar como lida** e criar tarefa/prazo a partir da publicação passam a marcar **só a publicação aberta**.
- A única exceção são as **cópias exatas** dela, com o mesmo número de comunicação do DJEN. Elas vêm do mesmo aviso capturado por outro login, e sem essa exceção voltariam a aparecer como "Não lidas" logo em seguida.
- Outras publicações do mesmo processo continuam **não lidas** até serem tratadas.
- Leituras antigas não serão desfeitas.

## Detalhes técnicos
- Nova RPC `get_publicacoes_mesma_comunicacao(ids)`: retorna as linhas de `publicacoes_djen`/`_processos`/`_descartadas` com o mesmo `id_djen` (não vazio) e a mesma coordenação. Sem `id_djen`, retorna só a própria publicação.
- Trocar `get_publicacoes_relacionadas_por_dedup` por essa RPC nos pontos de leitura: `AnaliseDjen.tsx` (salvar e ler), `NovaTarefaPublicacaoDialog.tsx` e as funções de marcar lida em `usePublicacoesDjenUnificadas.ts`/`usePublicacoesDjenServidorUnificadas.ts`.
- A chave de deduplicação da listagem não muda.
- Validar com consulta no par 885c66d/ab6c39c.

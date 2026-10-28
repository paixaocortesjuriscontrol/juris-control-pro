# Calendário do Painel: sem limite de busca e com visão total do Assistente Jurídico Geral

## O que muda para quem usa
- O calendário volta a trazer **todas** as tarefas em que a pessoa é responsável, co-responsável ou envolvida, sem corte de quantidade.
- O endereço de busca não fica mais grande demais, então a tela não volta a ficar presa tentando de novo.
- O **Assistente Jurídico Geral** continua vendo todas as coordenações no modo Escritório, mesmo sem participar de nenhuma.

## Como será feito
1. **Tirar o limite** de tarefas vinculadas que entrou na última correção.
2. **Dividir a busca em partes**: em vez de mandar todos os códigos de tarefa num pedido só, o calendário faz vários pedidos menores e junta os resultados, sem repetir itens. Assim nada fica de fora e nenhum pedido passa do tamanho aceito.
3. **Assistente Jurídico Geral**: conferir que, no Escritório, esse perfil continua no caminho "ver todas as coordenações". Ele vem antes da regra de busca por coordenação, então quem não tem coordenação não recebe uma tela vazia. Também incluir um teste para isso.
4. Manter a busca por coordenação para assistentes, advogados e estagiários que fazem parte de coordenações, porque foi isso que acabou com o loop da Altina.

## Detalhes técnicos
- `useAgendaUnificada.ts`: remover `limiteIdsVinculadosAgenda`. Separar a consulta de tarefas em duas leituras sequenciais (concorrência 1): (a) `responsavel_id.in` / `criado_por.in` das pessoas e (b) `id.in` dos IDs vinculados, divididos em lotes de cerca de 150 IDs com o `inChunks` que já existe. Mesclar por ID, mantendo a janela de datas, os filtros de status e a exclusão de ATA. Aplicar o mesmo na consulta de reserva (fallback). Na paginação, a parte (b) é lida inteira na página 0, e a página só conta como "cheia" pela parte (a).
- Remover `src/lib/agendaLimiteUrl.ts` e o teste dele. Adicionar um teste da função que decide o escopo do Escritório: `assistente_juridico_geral` sem coordenação recebe `fetchAll`, e um assistente com coordenações recebe `coordenacaoIds`.
- Atualizar a regra correspondente no `AGENTS.md`, sem mencionar limite de IDs.
- Nenhuma mudança no banco nem nas permissões de acesso (RLS).

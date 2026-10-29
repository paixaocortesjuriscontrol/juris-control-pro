# Painel de Controle: buscas separadas por tipo, Pessoal e Escritório

## Resposta curta
Não é difícil. A dificuldade hoje é que uma só função monta as duas visões e os seis tipos, tudo misturado. No modo Pessoal, ela pega a lista de tarefas ligadas à pessoa no navegador e manda essa lista de volta ao servidor. Quando a lista passa de algumas centenas, o pedido fica grande demais e a tela entra em loop. Foi isso que aconteceu com a Dra. Janaina.

## O que muda para quem usa
- **Pessoal:** cada tipo (Tarefas, Prazos, Atas, Eventos, Audiências, Parcelamentos) tem a sua busca. Ela traz o que a pessoa tem no mês como responsável, co-responsável ou envolvida, ou o que ela criou. Não tem limite de quantidade, e o tamanho da lista não trava mais a tela.
- **Escritório:** cada tipo traz tudo do mês nas coordenações do usuário, sem olhar quem é o responsável. Administrador e Assistente Jurídico Geral veem todas as coordenações, e uma coordenação escolhida no filtro mostra só ela. Já funciona assim hoje, só fica organizado por tipo.
- Se um tipo falhar, o painel avisa qual foi, em vez de sumir com tudo.
- Os cartões continuam mostrando o total rápido enquanto o calendário carrega.

## Passos
1. **Pessoal no banco:** criar uma busca no banco por tipo e mês que já cruza responsável, co-responsável e envolvido lá dentro. O navegador manda só a pessoa e o mês, nunca uma lista de códigos. Ela respeita as mesmas permissões de hoje.
2. **Escritório no banco:** uma busca por tipo e mês filtrada pelas coordenações, usando os índices de data e de coordenação que já existem.
3. **Tela:** o calendário chama as buscas de cada tipo, uma de cada vez, e junta os resultados sem repetir itens. As regras de cor, os tipos recorrentes e os filtros de situação continuam como estão.
4. **Testes:** um teste para cada regra (quem entra no Pessoal e o que entra no Escritório). Depois, conferir no banco os números da Janaina, da Altina e da Ana Caroline em outubro de 2026.

## Detalhes técnicos
- Funções `get_agenda_pessoal(p_usuario uuid, p_inicio date, p_fim date, p_tipos text[])` e `get_agenda_escritorio(p_coordenacoes uuid[] | null, p_inicio, p_fim, p_tipos)`, ambas com `SECURITY INVOKER` e `STABLE`, para o RLS continuar valendo. O retorno é em jsonb por tipo, com os mesmos campos que o hook usa hoje.
- A parte "pessoal" usa `EXISTS` em `tarefa_responsaveis`, `tarefa_envolvidos`, `participantes_evento`, `audiencias_advogados` e `audiencia_envolvidos`. Sai a montagem de `or(id.in.(...))` no cliente.
- `fetchAgendaPage` passa a ser um orquestrador por tipo. A expansão de recorrência e o `getAgendaDedupKey` ficam como estão.
- A migração só cria funções (sem tabelas e sem mudar permissões). Depois, entra uma regra no AGENTS.md no lugar das regras de lista de IDs.
- Limitação: sem o login dos usuários, só dá para conferir a tela do preview pelos números calculados no banco.

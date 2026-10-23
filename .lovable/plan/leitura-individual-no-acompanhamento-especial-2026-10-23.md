# Leitura individual no Acompanhamento Especial

## Situação atual (confirmada)
A marcação de lido fica gravada no próprio andamento (um campo único). Quando um usuário clica em "Marcar todas como lidas" ou abre um processo, o andamento fica lido para todos os usuários e a bolinha vermelha some para todos.

## O que muda
- Cada usuário passa a ter a sua própria leitura: marcar como lido (individual ou "todas") só afeta quem clicou.
- Contadores, bolinha vermelha, filtro "Só não lidas", Excel/PDF ("Lida/Não lida") e a aba de novidades na ficha do processo passam a considerar a leitura do usuário logado.
- Leituras já feitas até agora: serão mantidas apenas para quem não for possível identificar? Como hoje não se sabe quem leu, todos os andamentos já marcados como lidos continuam lidos para todos (inclusive os retroativos); só as próximas leituras passam a ser individuais.
- Nada é alterado em processos, coordenações, responsáveis ou outros módulos.

## Detalhes técnicos
- Nova tabela `acompanhamento_especial_leituras (evento_id, user_id, lido_em)`, única por evento+usuário, RLS: cada usuário lê/insere/remove só as suas linhas; GRANT para authenticated/service_role.
- `Monitoramento.tsx` (marcar grupo, marcarTodasLidas, cálculo de naoLidos), `AcompanhamentoEspecialEventos.tsx` e `useAcompanhamentoEspecialNovidades.ts`/contagem do menu: não lido = `lido_em` global nulo E sem linha do usuário atual.
- Marcar lido = upsert na nova tabela para os IDs visíveis ao usuário; não atualizar mais `lido_em` global (que fica como legado/eventos retroativos).
- Conferir também "Marcar todas como ciente" das Divergências Judit e aplicar a mesma regra se for global.
- Teste: dois usuários — A marca todas; B continua vendo as não lidas.

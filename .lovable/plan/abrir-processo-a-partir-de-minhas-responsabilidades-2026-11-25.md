# Abrir processo a partir de Minhas responsabilidades

## O que está acontecendo
A advogada é responsável ou envolvida na atividade, por isso a atividade aparece para ela. Mas o processo ligado pertence a uma coordenação da qual ela não faz parte. A ficha do processo só abre para quem é da coordenação do processo. Por isso aparece "Processo não encontrado".

Hoje isso acontece em 379 atividades abertas, com 21 pessoas. Em nenhum caso o processo foi apagado: todos existem.

## O que vou fazer
- Quem é responsável ou envolvido numa tarefa, prazo, evento ou audiência passa a poder **abrir e ver** o processo ligado a ela.
- Nada muda para quem não está na atividade. As outras coordenações continuam sem ver os processos umas das outras.
- Se a pessoa sair da atividade, deixa de ver o processo por esse caminho.
- Conferir depois que as 379 atividades abrem o processo para as 21 pessoas.

Pergunta em aberto: a pessoa só vê o processo ou também pode editar a ficha dele? O plano libera só a visualização.

## Detalhes técnicos
- Nova política SELECT em `processos` usando uma função SECURITY DEFINER `sou_participante_item_do_processo(processo_id)` que checa `auth.uid()` em `tarefa_responsaveis`/`tarefa_envolvidos`, `evento_responsaveis`/`evento_envolvidos` e `audiencias_advogados`/`audiencia_envolvidos` de itens com esse `processo_id`. Índices por `processo_id` conferidos antes.
- Sem mudança em UPDATE/DELETE de `processos` nem em `can_access_processo` (usada nas buscas da agenda, para não piorar a velocidade).
- Regra registrada no AGENTS.md.

# Envolvidos automáticos: seguir só os "Responsáveis fixos" da coordenação

## O que foi confirmado
- Na tarefa "Guias para RO Contingência de acórdão" (criada pela Dra. Janaina em 01/10/2026), Janaina, Leandro Artiaga e Polyana Nava entraram como envolvidos automaticamente porque são coordenadores da Coordenação Dra. Janaina Catunda. João Cláudio não é coordenador.
- Isso acontece por uma regra do banco: em toda tarefa, evento ou audiência com coordenação, ela coloca **todos os coordenadores** como envolvidos, sem olhar a configuração da coordenação.
- As telas de criação (tarefa, prazo, evento, audiência, parcelamento) já usam a configuração "Responsáveis fixos por tipo" do menu Coordenação. A regra do banco acrescenta os coordenadores por cima.

## O que muda
1. Desligar a inclusão automática de todos os coordenadores em tarefas, eventos e audiências novos, em todas as coordenações.
2. Os envolvidos e responsáveis automáticos passam a vir **somente** do que cada coordenação marcou em "Responsáveis fixos por tipo".
3. Itens já criados não mudam. Quem já está envolvido continua envolvido.

## Efeito para as coordenações
- Coordenações que dependiam dessa regra (coordenadores sempre envolvidos) precisam marcar os coordenadores nos responsáveis fixos de cada tipo, se quiserem continuar assim.

## Detalhes técnicos
- Migração: remover os triggers `trg_coord_envolvidos_tarefas`, `trg_coord_envolvidos_eventos` e o de `audiencias_detectadas` que chamam `add_coordenadores_envolvidos`. A função fica no banco, sem uso.
- Conferir se as importações automáticas (DJEN/audiências detectadas) dependem desse trigger. Se dependerem, aplicar nelas os fixos configurados.
- Atualizar a regra correspondente no `AGENTS.md`.

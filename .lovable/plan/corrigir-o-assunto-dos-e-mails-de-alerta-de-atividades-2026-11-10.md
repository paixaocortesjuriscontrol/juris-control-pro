# Corrigir o assunto dos e-mails de alerta de atividades

## O que a análise mostrou
- A tarefa "CHECAR DESPACHO 2D" alterada por Saulo Leal às 19h46 (BRT) de 09/11/2026 é da **Coordenação Dra. Beatriz Costa**, e o processo também.
- A fila de avisos e o histórico de e-mails enviados registram **Coordenação Dra. Beatriz Costa** em todos os envios dessa tarefa. Nenhum registro dessa tarefa cita a Coordenação Dra. Janaina.
- A rotina monta o assunto como `[Coordenação da tarefa] [Tarefa] Item alterado — Título`, mas só coloca o nome da coordenação quando a pessoa participa de mais de uma coordenação.
- Causa mais provável: o Gmail **agrupa e-mails com o mesmo título**. Na mesma conversa podem ficar tarefas diferentes chamadas "CHECAR DESPACHO 2D", inclusive as dos 2 processos da Dra. Janaina com a Dra. Beatriz. No topo da conversa, o Gmail mostra o assunto do **primeiro** e-mail, que era da Janaina. Já o conteúdo aberto é do e-mail novo, da Beatriz. Isso explica a diferença entre o assunto e a linha "Coordenação". Não consigo ver a caixa de entrada para confirmar.

## O que muda
1. O assunto passa a trazer **sempre** a coordenação da atividade, mesmo para quem só participa de uma.
2. O assunto passa a trazer o **número do processo**, quando houver, por exemplo:
   `[Coordenação Dra. Beatriz Costa] [Tarefa] Item alterado — CHECAR DESPACHO 2D — 1000872-65.2026.5.02.0079`
   Assim, tarefas diferentes com o mesmo título não caem na mesma conversa do Gmail.
3. A mesma regra vale para todos os avisos dessa rotina: alteração, inclusão de participante, comentário, menção, cobrança e mudança de situação. Vale também para o título do aviso no sininho.
4. O conteúdo do e-mail e as regras de quem recebe continuam iguais.

## Como vou conferir
- Vou fazer um teste do assunto montado, com e sem processo, para pessoas em uma ou em várias coordenações.
- Vou alterar uma tarefa de teste e ver no histórico de envios o assunto que saiu.

## Detalhes técnicos
- Arquivo: `supabase/functions/notificar-mudanca-situacao/index.ts`. O número vem de `buscarDetalhesEntidade`, que já busca o processo, e o prefixo deixa de depender de `qtdCoordPorUsuario`.
- Não há mudança no banco nem nas permissões.

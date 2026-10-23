# WhatsApp de tarefas deve respeitar as preferências de cada pessoa

## Situação atual
Hoje existem dois caminhos de aviso:
- **Fila de avisos nova** (alterações, responsáveis, cobranças): respeita as preferências individuais (sistema, e-mail, WhatsApp).
- **Alerta de tarefas da coordenação** (o que enviou para o 61999776905): manda WhatsApp para **todos os membros da coordenação com telefone**, sem consultar as preferências de cada um e sem olhar se a pessoa é responsável ou envolvida.

Foi por isso que o Eduardo Torres recebeu o aviso da tarefa do Felipe Leite.

## O que será feito
1. O alerta de tarefas da coordenação passa a consultar as preferências de cada pessoa antes de mandar WhatsApp ou e-mail. Quem desligou o WhatsApp não recebe.
2. O alerta passa a ir só para o responsável e os envolvidos da tarefa (e coordenadores, se a pessoa tiver marcado que quer receber), e não para a coordenação inteira.
3. Quem não tem telefone cadastrado (como o Felipe Leite) continua recebendo pelos outros canais escolhidos.
4. Teste confirmando: membro sem relação com a tarefa não recebe; pessoa com WhatsApp desligado não recebe; responsável com WhatsApp ligado recebe.

## Detalhes técnicos
- Localizar a função/edge function do alerta de tarefas por coordenação e reutilizar `canalPermitido`/`eventoPermitido` de `notificar-mudanca-situacao/regras.ts`.
- Filtrar destinatários por `responsavel_id` + `tarefa_responsaveis`/envolvidos.
- Sem alteração em tarefas, responsáveis ou coordenações existentes.

## Aviso e nova tentativa quando a busca do DJEN Servidor cai

Hoje (09/11/2026) as buscas das 04h30, 10h00 e 17h00 (Brasília) pararam no meio com o erro "Heartbeat parado — worker/VPS derrubado". A rotina que encerra buscas travadas marca a execução como "falhou" sem avisar ninguém e sem tentar de novo.

### O que muda
1. **Aviso imediato aos administradores** quando uma busca do DJEN Servidor for encerrada por servidor parado:
   - Aviso no sininho do sistema.
   - Mensagem por WhatsApp e e-mail, respeitando a configuração de notificações de cada administrador.
   - O texto informa o horário em Brasília, quanto tempo o servidor ficou parado e se a nova tentativa já foi iniciada.
2. **Nova tentativa automática, uma única vez:** a busca recomeça do ponto onde parou, sem repetir o que já foi feito. Se cair de novo, não há outra tentativa automática, só o aviso, para não entrar em repetição.
3. **Aviso de conclusão:** quando a nova tentativa terminar, os administradores recebem um aviso dizendo se ela deu certo.

### Detalhes técnicos
- Alterar `reaper_execucoes_servidor_travadas` para, em cada execução marcada como `falhou`, inserir os avisos na fila de notificações já existente (`notificacoes` e `notificacoes_fila`) para os usuários com papel `admin` em `user_roles`.
- Enfileirar uma única nova execução de mesmo tipo e período via `enfileirar_execucao_servidor`, reaproveitando o checkpoint. A marca `payload.retomada_de = <id original>` impede uma segunda retomada.
- Não haverá novas tabelas e as regras de acesso aos dados não mudam.

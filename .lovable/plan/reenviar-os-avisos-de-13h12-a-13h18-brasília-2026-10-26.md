# Reenviar os avisos de 13h12 a 13h18 (Brasília)

## Situação
Entre 13h12 e 13h18 de 26/10, o envio tratou **12 avisos** com o padrão "tudo desligado". Quem nunca salvou o Minhas notificações ficou sem esses avisos. Quem já tinha salvo as próprias escolhas recebeu normalmente.

## O que será feito
1. Separar esses 12 avisos e conferir, para cada um, quem já recebeu (pelo histórico de envios e pelos avisos do sistema).
2. Reenviar cada aviso **só para quem ficou sem ele**, seguindo o padrão atual (tudo ligado para quem nunca salvou). Quem já recebeu não ganha duplicado.
3. Conferir no histórico que os envios saíram e informar quantas pessoas receberam.

## Detalhes técnicos
- Itens: `notificacoes_fila` com `created_at >= 16:10 UTC` e `processado_em` entre 16:12 e 16:19 UTC.
- Para não duplicar, é feita uma execução única pela função `notificar-mudanca-situacao` com o parâmetro `reenviar_ids` e a lista de usuários excluídos (os que têm linha em `config_notificacoes_usuario` ou que já têm registro em `notificacoes` / `historico_alertas_enviados` para o item). Depois, o parâmetro é removido.
- Nenhuma mudança no banco além de recolocar esses 12 itens para processamento.

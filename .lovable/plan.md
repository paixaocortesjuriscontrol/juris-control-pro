# Notificação de comentário na tarefa da Dra. Beatriz Costa

## O que os dados mostram

Comentário verificado: tarefa "TESTE", comentário da admin (`paixaocortesjuriscontrol@gmail.com`) em 31/07 às 15:36 BRT.

- O gatilho funcionou: a fila `notificacoes_fila` recebeu o evento `comentario` (18:36 UTC), destinatários = Beatriz Costa + Jéssica Alves, e foi processada com sucesso às 18:38 UTC.
- O alerta foi efetivamente enviado à Beatriz: existe registro em `historico_alertas_enviados` com canal `email`, destinatário `beatriz.costa@paixaocortes.adv.br`, status `enviado`, sem erro.
- Jéssica recebeu por e-mail **e** WhatsApp; Beatriz recebeu **apenas e-mail**, porque o perfil dela está sem telefone cadastrado (`profiles.telefone` vazio).

Conclusão: o alerta de comentário não falhou. O que faltou foi o WhatsApp — e é bem possível que o e-mail tenha caído em spam/lixeira, já que o sistema o marcou como enviado.

## Correções propostas

1. **Cadastrar telefone da Dra. Beatriz Costa** (via Administração ou Meu Perfil) para que ela passe a receber os comentários também por WhatsApp. Preciso do número dela.
2. **Aviso de destinatário sem canal**: quando um destinatário não tem telefone (ou não tem e-mail), registrar isso no histórico como "não enviado – sem telefone" em vez de simplesmente ignorar, para que essa lacuna fique visível.
3. **Indicador na tela de Config. Notificações / Coordenações**: sinalizar com ícone de atenção os membros da coordenação sem telefone cadastrado, evitando que o problema se repita com outros usuários.

## Detalhes técnicos

- Ajuste em `supabase/functions/notificar-mudanca-situacao/index.ts`: ao montar os envios, quando `p.telefone` estiver vazio, gravar linha em `historico_alertas_enviados` com `canal: 'whatsapp'`, `status: 'nao_enviado'` e `erro: 'sem telefone cadastrado'`.
- Frontend: badge de alerta nos membros sem telefone na tela de Coordenações (leitura de `profiles.telefone`), sem mudança de regra de negócio.

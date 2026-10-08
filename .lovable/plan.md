# Notificações configuradas por coordenação

## Como funciona hoje

Cada pessoa tem uma única configuração em **Minhas notificações**, com canais, tipos de evento, horário e resumo diário. Ela vale para todas as coordenações de que a pessoa participa. Os avisos já sabem de qual coordenação vem cada item, mas a configuração não leva isso em conta.

## Como vai ficar

- **Escolha da coordenação:** no alto de **Minhas notificações** aparece a opção **Coordenação**. Quem participa de uma só coordenação não vê essa escolha, e a tela fica igual à de hoje.
- **Configuração de cada coordenação:** quem participa de mais de uma escolhe a coordenação e ajusta canais, tipos de evento, horário e resumo diário só para ela. Um botão **Receber avisos desta coordenação** liga ou desliga tudo dela de uma vez.
- **Padrão inicial:** enquanto a pessoa não personaliza uma coordenação, vale a configuração atual dela. Ninguém deixa de receber nada no dia da mudança.
- **Selo na lista:** cada coordenação mostra o selo "Personalizada" ou "Padrão".

### Em cada tipo de aviso

- **Mudança de situação, item novo, comentário e reagendamento:** seguem a configuração da coordenação do item.
- **Prazo perdido (lembrete diário):** segue a configuração da coordenação de cada prazo. Se uma coordenação estiver desligada, os prazos dela não entram no lembrete.
- **Resumo diário da agenda:** continua sendo um único e-mail, só com os itens das coordenações em que o resumo estiver ligado. Ele usa o horário da configuração padrão.
- **Itens sem coordenação:** usam a configuração padrão.

## Detalhes técnicos

- **Banco de dados:** incluir em `config_notificacoes_usuario` a coluna `coordenacao_id uuid null` (null = padrão), com índice único em `(usuario_id, coalesce(coordenacao_id, '00000000-...'))`. Também incluir `ativo boolean default true`. Os registros atuais continuam como padrão.
- **Regras de acesso:** sem mudança, porque cada pessoa só mexe nas próprias linhas.
- **Tela** (`ConfigNotificacoesUsuarioCard.tsx`): carregar as coordenações de `membros_coordenacao` do usuário e mostrar a escolha quando houver mais de uma. Carregar a linha da coordenação escolhida ou cair na padrão. Ao salvar, gravar com `coordenacao_id`. Incluir o botão "Voltar ao padrão", que apaga a linha específica.
- **Função compartilhada** `resolverConfig(usuario, coordenacao)`: busca a linha específica e, se não existir, a padrão. Usar em `notificar-mudanca-situacao` (pelo `coordenacao_id` do item da fila), `alertar-prazos-perdidos` (agrupando por coordenação) e `enviar-agenda-do-dia` (filtrando os itens pelas coordenações com resumo ligado).

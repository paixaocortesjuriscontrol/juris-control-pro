# E-mail único para alertas do Acompanhamento Especial

## O que muda para a equipe
Em Coordenações, na configuração de Acompanhamento Especial já existente, entra uma nova escolha:
- **Padrão (como hoje):** os e-mails vão para as pessoas de sempre, ou para as pessoas escolhidas na coordenação.
- **E-mail único:** um campo para digitar um endereço, por exemplo alertas@escritorio.com.br. Os e-mails de movimentações novas dos processos dessa coordenação vão só para esse endereço.

Com o e-mail único, os avisos no sino e no WhatsApp continuam iguais. Só o envio por e-mail muda. Se o campo ficar vazio, vale o padrão.

## Detalhes técnicos
- Migração: na tabela `config_acompanhamento_especial`, nova coluna `email_unico text null`, com validação de formato por gatilho. As regras de acesso atuais da tabela continuam valendo.
- `ConfigAcompanhamentoEspecialDialog.tsx`: opção "Padrão" ou "E-mail único", com o campo de e-mail. O salvamento confere a linha devolvida.
- `judit-acompanhamento-especial`: no envio consolidado, quando a coordenação do processo tem `email_unico`, manda um e-mail só para esse endereço e registra o envio no histórico. Sem `email_unico`, segue o envio de hoje por pessoa. Processo de várias coordenações: um e-mail para cada endereço diferente, sem repetir.
- A regra fica registrada no AGENTS.md.

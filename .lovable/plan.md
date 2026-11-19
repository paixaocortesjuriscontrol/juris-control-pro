# Corrigir o erro ao cumprir prazos (Lídia / Santander Cível)

## O problema
Alguns prazos foram gravados internamente como "tarefa". Quando alguém cumpre o prazo, a tela corrige esse tipo interno para "prazo" ao mesmo tempo. A regra da coordenação entende essa correção como uma alteração dos dados do prazo e bloqueia quem só pode mudar a situação, como a Lídia e a Renata.

## O que vai mudar
1. **Regra de bloqueio:** a correção automática do tipo interno (tarefa → prazo) deixa de contar como alteração de dados. Quem só pode mudar a situação passa a conseguir cumprir esses prazos. Qualquer outra alteração (datas, título, responsáveis etc.) continua bloqueada como hoje.
2. **Tela de cumprir:** quando a pessoa só muda a situação, a tela não envia mais a correção do tipo interno, para não esbarrar no bloqueio.
3. **Permissões:** nada muda em "Quem pode agendar". Lídia e Renata continuam sem poder editar dados, só a situação.

## Fica de fora (só se você pedir)
- Correção em massa dos cerca de 1.175 prazos abertos com o tipo interno errado.
- Mudanças nos workflows que geram esses prazos.

## Detalhes técnicos
- Migration: ajustar `bloquear_configuracao_agendamento` para ignorar a diferença em `tipo_registro` quando o valor novo é coerente com `tipo_tarefa` ou com o tipo do item, comparando o restante normalmente.
- Front: no formulário de prazo/tarefa, não incluir `tipo_registro` no update quando só a situação mudou.
- Teste unitário: confirmar que o update feito só para mudar a situação não leva `tipo_registro`.
- Atualizar a versão no menu (v10.3.0).

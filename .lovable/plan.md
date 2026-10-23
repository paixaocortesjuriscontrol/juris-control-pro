# Novo assunto do e-mail do Acompanhamento Especial

Assunto passa a ser: `Juris Control - <número CNJ> - <N> nova(s) movimentação(ões) encontrada(s)`
Ex.: Juris Control - 0000690-24.2026.5.23.0108 - 4 nova(s) movimentação(ões) encontrada(s)

Também removo "pela Judit" do texto do corpo do e-mail.

## Técnico
- `supabase/functions/judit-acompanhamento-especial/index.ts`: alterar a linha do `assunto` e a frase do HTML; redeploy da função.

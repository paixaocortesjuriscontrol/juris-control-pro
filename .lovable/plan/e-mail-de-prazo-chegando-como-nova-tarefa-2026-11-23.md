# E-mail de prazo chegando como "Nova Tarefa"

## Motivo (confirmado)
A reclamação procede. O prazo foi salvo corretamente como **Prazo** (a ficha mostra isso). O problema está só no aviso: o envio de e-mail e WhatsApp de atividade nova usa sempre o texto fixo "Nova Tarefa" e "Nova Tarefa Atribuída", sem olhar o tipo. Por isso prazos e atas chegam como se fossem tarefa.

## O que muda
- O assunto e o cabeçalho do e-mail passam a dizer o tipo certo: **Nova Tarefa**, **Novo Prazo** ou **Nova Ata**.
- O mesmo vale para a mensagem de WhatsApp e para o aviso dentro do sistema.
- Nenhuma atividade, permissão ou dado é alterado. Os e-mails já enviados não mudam.
- Versão v10.3.8 no menu.

## Detalhes técnicos
- `supabase/functions/notificar-tarefa-criada/index.ts`: função `rotuloTipo(tarefa)` usando `tipo_registro` (`prazo`/`tarefa`) e `tipo_tarefa = "ATA"`; aplicar nas linhas 316, 343, 380 e 444.
- Teste Deno pequeno para `rotuloTipo` (prazo → "Novo Prazo", ATA → "Nova Ata", tarefa → "Nova Tarefa").
- Atualizar `src/constants/version.ts`.

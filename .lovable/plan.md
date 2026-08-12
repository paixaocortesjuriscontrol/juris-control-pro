# Acompanhamento Especial: voltar o e-mail apenas para novas movimentações

## Objetivo
Reativar o envio de e-mail na rotina de Acompanhamento Especial, mas **somente quando a Judit encontrar nova movimentação** no processo. Divergências de campos (Judit × formulário) continuam sem qualquer aviso — apenas registradas para consulta na tela.

## O que muda

1. Nova movimentação encontrada
   - Continua criando notificação no sino e mensagem no WhatsApp.
   - Passa a enviar **1 e-mail consolidado por processo**, listando todas as novas movimentações daquela execução (data/hora em horário de Brasília + resumo do andamento) e link para o processo.
   - Assunto no formato: "Acompanhamento Especial - novas movimentações - <número CNJ>".
   - Destinatários: os mesmos já usados hoje (responsáveis do processo + coordenadores da coordenação), somente quem tem e-mail cadastrado.
   - O envio é registrado no histórico de alertas com a coordenação do destinatário, igual às demais rotinas.

2. Divergências de campos
   - Nada muda: sem e-mail, sem sino, sem selo de novidade. Permanecem visíveis no card "Divergências Judit × formulário" do Painel de Controle e na tela do processo.

## Detalhes técnicos
- `supabase/functions/judit-acompanhamento-especial/index.ts`: no bloco "Envio consolidado" (hoje com o comentário "Envio de e-mail DESATIVADO"), voltar o envio via Resend (`RESEND_API_KEY`) usando o `linhasHtml` já montado, mantendo o WhatsApp como está. Envolver em try/catch para que falha de e-mail não interrompa a execução, e gravar `historico_alertas_enviados` usando o helper `_shared/coordenacao-usuario.ts` para resolver a coordenação de cada destinatário.
- Nenhuma alteração no trecho de divergências nem no hook `useAcompanhamentoEspecialNovidades.ts`.
- Sem mudanças de schema. Redeploy da Edge Function após a alteração.

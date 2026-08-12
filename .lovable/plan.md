# Acompanhamento Especial: avisar só novas movimentações

## Objetivo
O aviso do Acompanhamento Especial passa a ocorrer **apenas quando a Judit encontra uma nova movimentação** no processo. Divergências entre o que a Judit trouxe e o que está digitado no formulário deixam de gerar qualquer aviso.

## O que muda

1. Rotina automática (Judit – Acompanhamento Especial)
   - Nova movimentação: continua criando notificação no sino e WhatsApp (e-mail já está desativado).
   - Divergências de campos: deixa de criar notificação no sino. O bloco que varre divergências pendentes e notifica os envolvidos é removido.
   - As divergências continuam sendo **registradas** no banco (valor digitado sempre preservado) e seguem visíveis na tela do processo e no Painel de Controle, para consulta quando a advogada quiser — apenas sem aviso ativo.

2. Selo "Novidades" no menu
   - Passa a contar somente novos eventos de movimentação. Divergências pendentes não entram mais na contagem, então o selo não fica aceso por causa de campos divergentes.

## Detalhes técnicos
- `supabase/functions/judit-acompanhamento-especial/index.ts`: remover o trecho "Aviso de divergências (Judit × formulário)" que chama `notificarUsuarios` e marca `avisado_em`. Manter a gravação em `acompanhamento_especial_divergencias` feita durante a sincronização.
- `src/hooks/useAcompanhamentoEspecialNovidades.ts`: remover a consulta de contagem em `acompanhamento_especial_divergencias`; `total`/`temNovidades` passam a considerar apenas `acompanhamento_especial_eventos`.
- Redeploy da Edge Function após a alteração.
- Sem mudanças de schema; nenhuma outra rotina de notificação é afetada.

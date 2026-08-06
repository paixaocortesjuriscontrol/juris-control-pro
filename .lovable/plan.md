# Corrigir confusão do botão "Lida" nos cards de mensagens

## Problema
No card de mensagem recebida aparece "Lida" no canto superior direito, mas a mensagem continua contando como não lida. O texto é, na verdade, um **botão de ação** (marcar como lida) que só aparece enquanto a mensagem está não lida — a etiqueta vermelha "Nova" ao lado confirma isso. Ler "Lida" como estado, com "Nova" logo abaixo, é contraditório.

## O que muda (apenas visual/rótulos)
Em Mensagens recebidas (`src/components/notificacoes/MinhasMensagensRecebidas.tsx`):

1. O botão passa a ter rótulo de ação explícito: "Marcar como lida" (ícone de check mantido), com `title` acessível.
2. Quando a mensagem já está lida, o card mostra um indicador estático discreto "Lida" (texto cinza + check, sem aparência de botão), para que o estado fique claro nos dois casos.
3. O botão de ação ganha destaque leve (variant outline) para não ser confundido com texto de status.
4. Em telas estreitas o botão mostra só o ícone com tooltip, evitando quebra de layout.

Nada muda na lógica de leitura, contagem do badge do menu ou agrupamento de mensagens.

## Detalhes técnicos
- Bloco `{!lida && (<Button …>Lida</Button>)}` no final do card vira: botão "Marcar como lida" quando `!lida`, e um `<span>` de status "Lida" quando `lida`.
- Mantidos `e.stopPropagation()` e a chamada `marcarLida(m.ids)` já existentes.

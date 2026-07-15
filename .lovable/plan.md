## Objetivo
Rodar a rotina de Acompanhamento Especial em horários fixos (BRT) conforme a frequência escolhida pelo advogado, com máximo de 3 vezes/dia, e notificar responsáveis por email, WhatsApp e sino/painel quando houver novidades.

## Regras de agendamento

| Vezes/dia | Horários BRT |
|-----------|--------------|
| 1 | 10h |
| 2 | 10h e 18h |
| 3 | 10h, 14h, 18h |

Em UTC (BRT = UTC-3): 13h, 17h, 21h.

## Mudanças

### 1. UI — `AcompanhamentoEspecialToggle.tsx`
- Trocar `max={6}` por `max={3}` no input "Vezes ao dia".
- Se valor salvo for > 3, exibir/coagir para 3.

### 2. Edge function `judit-acompanhamento-especial`
- Aceitar `slot` (10 | 14 | 18) no body.
- Substituir o filtro por "24/freq horas" pela regra de slot:
  - slot 10 → processa freq ≥ 1
  - slot 14 → processa freq ≥ 3
  - slot 18 → processa freq ≥ 2
- Manter guarda anti-duplicidade: só processa se `acompanhamento_ultima_checagem_em` não é do mesmo slot no mesmo dia.
- Clamp `freq` em `[1, 3]`.
- Após inserir eventos novos, para cada responsável ativo (`processos_responsaveis` → `profiles`):
  - Já grava `notificacoes` (sino/painel) — mantém.
  - Chamar `send-email` (Resend) com resumo dos novos steps.
  - Chamar `enviar-whatsapp-zapi` com telefone do profile, se houver.
- Consolidar por processo: um email + um WhatsApp por processo por execução, listando os N novos andamentos (não um por step).

### 3. Cron (pg_cron)
- `unschedule` do job atual `judit-acompanhamento-especial-hourly` (a cada hora).
- Criar 3 jobs:
  - `judit-acomp-especial-10brt` — `0 13 * * *` → body `{"slot":10}`
  - `judit-acomp-especial-14brt` — `0 17 * * *` → body `{"slot":14}`
  - `judit-acomp-especial-18brt` — `0 21 * * *` → body `{"slot":18}`

### 4. Painel de controle
- O card/lista de eventos (`AcompanhamentoEspecialEventos`) e o sino já refletem os novos eventos. Sem alteração adicional necessária.

## Pré-requisitos que já existem
- `RESEND_API_KEY` / função de envio de email.
- `enviar-whatsapp-zapi` (Z-API) já em uso em outras rotinas.
- `profiles.telefone` e `profiles.email` disponíveis para os responsáveis.

## Fora de escopo
- Alterar template visual de email/WhatsApp além do texto de andamentos.
- Retroagir/limpar eventos antigos.

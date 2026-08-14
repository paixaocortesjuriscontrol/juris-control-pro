# Acompanhamento Especial: parar avisos de movimentações antigas

## Como está funcionando hoje

- 28 processos estão marcados como Acompanhamento Especial. Um cron consulta a Judit nos horários 10h/14h/18h (BRT) conforme a frequência de cada processo.
- Cada "andamento" (step) retornado pela Judit é gravado em uma tabela de eventos. O sistema considera **novidade tudo que ainda não tinha sido gravado**, independente da data do andamento.
- Para cada novidade ele dispara: notificação no sino, e-mail (Resend) e WhatsApp (Z-API) para responsáveis do processo e coordenadores.

## Por que os advogados receberam movimentações retroativas

A tabela de eventos só começou a ser populada em 13/08/2026. Como os processos já tinham marcação de "última movimentação conhecida" de versões anteriores, a regra de silêncio da primeira carga não foi acionada — e todo o histórico da Judit (andamentos desde 2013) entrou como novidade.

Números confirmados no banco:

- 3.263 eventos notificados em 13 e 14/08.
- 3.212 deles tinham andamento com mais de 7 dias; 2.687 com mais de 90 dias; 1.363 com mais de 2 anos.

Ou seja: não é erro da Judit nem duplicidade (não há eventos duplicados) — é falta de uma janela de data e de um baseline correto.

## O que será feito

1. **Baseline correto por processo**: se o processo ainda não tem nenhum evento gravado, a primeira consulta grava todo o histórico em silêncio (nenhum e-mail, WhatsApp ou sino). Passa a valer também para processos que já tinham a marcação antiga.
2. **Janela de aviso configurável por coordenação**: apenas andamentos com data dentro da janela (padrão 7 dias) geram e-mail, WhatsApp e notificação. Nova tela/opção no menu Coordenações para ajustar os dias.
3. **Retroativos: registrar sem avisar**: andamentos fora da janela continuam sendo gravados e ficam visíveis na tela Monitoramento (marcados como "retroativo"), mas não geram e-mail, WhatsApp nem notificação no sino, e não entram no contador do menu.
4. **Também não avisa** andamentos anteriores à data em que o processo foi colocado em Acompanhamento Especial.
5. **Limpeza do histórico**: marcar os 3.834 eventos já gravados como lidos, zerando os contadores e alertas do menu Monitoramento (histórico segue consultável).
6. **Resumo consolidado**: quando houver novidades dentro da janela, continua 1 e-mail + 1 WhatsApp por processo, listando as movimentações — sem a seção de retroativos.

## Detalhes técnicos

- Nova tabela `config_acompanhamento_especial` (por `coordenacao_id`, campo `dias_janela_aviso` padrão 7, `notificar_retroativos` false), com GRANTs e RLS: leitura para usuários autenticados da coordenação, escrita para admin/coordenador.
- Edge Function `judit-acompanhamento-especial`:
  - Antes do loop de steps, verificar existência de eventos do processo (`select id ... limit 1`) → define `primeiraCarga`; nesse caso grava tudo com `notificou_em` nulo e sem notificar.
  - Calcular `limiteAviso = max(hoje - dias_janela_aviso, data de ativação do acompanhamento)`; steps com `step_date < limiteAviso` são gravados como retroativos e excluídos de `novosResumo`, das notificações e do e-mail/WhatsApp.
  - Marcar eventos retroativos com `lido_em` preenchido (ou coluna `retroativo`) para não entrarem no badge do menu Monitoramento.
- Tela Monitoramento: filtro/etiqueta "Retroativo" para separar visualmente; badge conta apenas eventos dentro da janela e não lidos.
- Operação de dados (não migração de schema): `UPDATE acompanhamento_especial_eventos SET lido_em = now() WHERE lido_em IS NULL`.

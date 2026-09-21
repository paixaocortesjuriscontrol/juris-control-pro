# Publicação 0003240-85.2026.5.10.0000 (14/09/2026) — Coordenação Dra. Janaina Catunda

## O que realmente aconteceu

A publicação **foi encontrada normalmente** na coordenação da Dra. Janaina Catunda. Ela entrou pelo acompanhamento do advogado **CARLOS JOSE ELIAS JUNIOR — OAB DF-10424**, com data de disponibilização 14/09/2026.

Ela não aparece mais na lista porque **foi descartada manualmente em 21/09/2026, às 09:40 (BRT), pela própria Dra. Janaina Catunda**. O registro está guardado na aba de publicações descartadas, com o motivo "descartado manualmente" e o nome de quem descartou.

Não houve falha de busca: a mesma publicação também foi capturada em outras duas coordenações no dia 14/09/2026 e continua lá.

## O que eu proponho fazer

1. Restaurar a publicação para a lista da coordenação da Dra. Janaina Catunda (a mesma ação do botão "Desfazer descarte" na aba de descartadas), deixando-a como não lida para que a equipe a trate.
2. Confirmar depois da restauração que ela aparece na coordenação, com a data de 14/09/2026 e o vínculo ao processo 0003240-85.2026.5.10.0000.

Nenhuma regra de busca ou de descarte será alterada, e nada é apagado.

## Alternativa

Se a senhora preferir, a própria advogada pode restaurar sozinha: basta abrir a aba de publicações descartadas da coordenação, localizar o processo e usar "Desfazer descarte". Nesse caso eu não mexo em nada.

## Detalhe técnico

- Registro descartado: `publicacoes_djen_descartadas.id = f749cba0-31e4-4c85-ab3b-91445a89f0e3`, `monitoramento_id = 00475d73...` (advogado, OAB 10424), `coordenacao_id = 9d4e11e2...`, `motivo_descarte = descartado_manualmente`, `descartado_por_nome = Janaina Catunda`, `created_at = 2026-09-21 12:40:47 UTC`.
- Restauração via RPC existente `desfazer_descarte_individual`, que recria a linha em `publicacoes_djen` a partir de `payload_origem` e remove o registro de descartada.
- Sem migração de schema e sem mudança de código.

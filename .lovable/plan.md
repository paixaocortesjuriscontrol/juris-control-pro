# Por que a publicação "não apareceu" na coordenação da Dra. Janaina

## O que o banco mostra

A publicação **foi encontrada**. O monitoramento por parte `HOSPITAL DE MEDICINA ESPECIALIZADA` (TRT23, ativo, coordenação da Dra. Janaina) capturou o processo 0000457-58.2020.5.23.0004 hoje, 04/08/2026.

Foram gravadas 3 capturas dessa mesma publicação (variações de destinatário/intimado) e **todas as 3 foram descartadas hoje às 09:21 (BRT)**, com motivo `descartado_manualmente`. Por isso ela não aparece na lista da Análise DJEN — está na aba **Descartadas**.

Detalhe importante: as 3 linhas de descarte estão registradas como autor **"Sistema"**, apesar de terem sido um descarte manual. Isso é um defeito da rotina de descarte manual, que não grava quem descartou — impedindo auditar quem removeu a publicação.

O histórico confirma que o termo funciona: o mesmo processo já foi capturado por esse monitoramento em 26/05, 22/06, 01/07 e 14/07.

## O que será feito

1. Corrigir a rotina de descarte manual para gravar o usuário (nome/e-mail) que descartou, de modo que a aba Descartadas e a auditoria mostrem o autor real em vez de "Sistema".
2. Restaurar as 3 capturas dessa publicação de 04/08/2026 para a lista de publicações encontradas da coordenação da Dra. Janaina, mantendo o registro do descarte no histórico.

## Detalhes técnicos

- Função `public.descartar_publicacao_manualmente`: passa a preencher `descartado_por` com `auth.uid()` e `descartado_por_nome` com o nome/e-mail do perfil, nos dois ramos (`termo` e `processo`).
- Restauração: reinserir em `publicacoes_djen` a partir de `payload_origem` das linhas descartadas `c6acaba9…`, `0943fcec…`, `1a7cb3b9…` e remover essas linhas de `publicacoes_djen_descartadas`.

Nenhuma mudança na regra de busca do DJEN é necessária — a captura está correta.
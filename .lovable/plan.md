# Normalizar processos duplicados — um processo, várias coordenações

## Objetivo
Na tela Processos e Casos cada número de processo deve aparecer **uma única vez**. Quando o mesmo processo pertence a mais de uma equipe, ele passa a ter **duas (ou mais) coordenações responsáveis** no mesmo registro, em vez de dois cadastros separados.

## O que foi confirmado na base
- O caso citado tem dois registros: `0001106-08.2026.8.26.0318` (ESAJ, com máscara) e `00011060820268260318` (só dígitos, criado a partir de uma publicação DJEN).
- Existem **188 processos** gravados sem máscara CNJ e **32 grupos duplicados** por dígitos (63 registros excedentes), sendo **11 grupos com coordenações diferentes**.
- Já existe a tabela `processos_coordenacoes_responsaveis` e o gatilho `sync_processo_coordenacao_responsavel`, que registra a coordenação do processo como responsável principal — ou seja, o modelo multi-coordenação já está pronto para receber os merges.
- O índice único `processos_numero_uidx` valida o número como texto exato, então a versão sem máscara escapa da checagem — é essa a causa da duplicação.

## Plano

### 1. Normalizar os números (188 registros)
Aplicar a máscara CNJ (`NNNNNNN-DD.AAAA.J.TR.OOOO`) em todos os processos com 20 dígitos gravados sem pontuação. Feito antes do merge, para que a duplicidade fique visível pela chave única.

### 2. Unificar os duplicados (32 grupos)
Para cada grupo com o mesmo número (por dígitos):
- Eleger como **principal** o registro mais completo (partes preenchidas, cliente vinculado, mais movimentações; em empate, o mais antigo).
- Registrar a coordenação de cada duplicado em `processos_coordenacoes_responsaveis` do principal (a primeira permanece como principal).
- Repontar para o principal todos os vínculos dos duplicados: tarefas, audiências, eventos, movimentações, publicações DJEN, documentos, partes, responsáveis, testemunhas, pedidos, custas, depósitos, monitoramentos, pautas TST, workflows e divergências de acompanhamento.
- Preencher no principal os campos que estiverem vazios usando o valor do duplicado (nunca sobrescrever dado existente).
- Excluir os registros duplicados apenas depois de repontar tudo.

### 3. Impedir que volte a acontecer
- Trocar o índice único por um índice sobre **os dígitos do número** (`regexp_replace(numero,'\D','','g')`), de modo que "com máscara" e "sem máscara" passem a colidir.
- No auto-cadastro a partir de publicação DJEN e nas importações, buscar sempre pelos dígitos antes de criar; quando o processo já existir em outra coordenação, **acrescentar a coordenação** ao processo existente em vez de criar outro cadastro.

## Sobre o auto-cadastro DJEN
Ele existe para permitir criar prazo/tarefa/audiência direto da Análise DJEN quando o processo ainda não está cadastrado — a publicação precisa de um processo para se vincular. Ele continua existindo, mas passa a apenas **anexar a coordenação** quando o processo já existe. Se preferir, posso desligá-lo e passar a exigir cadastro manual — diga e ajusto o plano.

## Detalhes técnicos
- Migração 1: `UPDATE processos` normalizando `numero` para máscara CNJ quando `length(digits)=20`.
- Migração 2: função `merge_processos_duplicados()` (SECURITY DEFINER) percorrendo grupos por dígitos, com `UPDATE` em cada uma das 30 tabelas com FK `processo_id`, tratando conflitos de chave única (ex.: `publicacoes_djen_processos (processo_id, hash_conteudo)`) por `DELETE` do duplicado.
- Migração 3: `DROP INDEX processos_numero_uidx` e criação de `processos_numero_digits_uidx` sobre a expressão de dígitos.
- Frontend: `src/lib/ensureProcessoFromPublicacao.ts` passa a inserir em `processos_coordenacoes_responsaveis` em vez de sobrescrever `coordenacao_id`; a listagem de Processos e Casos exibe as coordenações como badges.

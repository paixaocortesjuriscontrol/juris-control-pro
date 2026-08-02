# Corrigir duplicidade falsa na importação Astrea + silenciar e-mails de importação

## O que está acontecendo

A coordenação da Dra. Janaina realmente ficou sem tarefas (a limpeza foi feita). O erro na tela **não** vem de tarefas antigas no banco:

1. A importação Astrea insere **em lotes de 200 linhas numa única operação**. Se **uma** linha do lote for recusada, o Postgres aborta o lote inteiro e o código marca **todas as 200 linhas** com a mesma mensagem de erro. Daí 1973 erros com o mesmo ID repetido (`dd4b5ac7-...`) em títulos e processos totalmente diferentes.
2. Esse ID `dd4b5ac7-5acc-426a-846c-0fc00ffb3b66` **não existe** na tabela de tarefas — confirmado por consulta. Ele existiu apenas durante a transação: é uma linha inserida antes, dentro do próprio lote. Ou seja, a duplicidade é **entre linhas da própria planilha** (a planilha de agenda do Astrea repete a mesma tarefa em abas/linhas), não contra o banco.
3. A regra de bloqueio só olha título + data + processo + responsável + tipo, e é aplicada a tudo que tem origem preenchida — incluindo importação.

## Correções

### 1. Deduplicar dentro da própria planilha, antes de inserir
Antes do envio, agrupar as linhas pela chave de negócio (título normalizado + data + processo + responsável + tipo). Repetidas ficam marcadas como **"Duplicada na planilha"** (aviso, não erro), e apenas a primeira é enviada.

### 2. Não punir o lote inteiro por causa de uma linha
Quando um lote falhar, reprocessar aquele lote linha por linha, de forma que só as linhas realmente problemáticas apareçam como erro, com a mensagem correta de cada uma. As demais são importadas normalmente.

### 3. Não bloquear importação pela regra automática
A regra de duplicidade foi criada para tarefas geradas automaticamente por publicações (DJEN/IA). A importação passa a ser isenta dessa regra, já que a deduplicação passa a ser feita na etapa 1 e já existe controle por identificador único da planilha.

### 4. Não enviar e-mail/WhatsApp para tarefas criadas por importação
Hoje toda tarefa criada dispara alerta de criação para responsáveis e envolvidos — o que gera milhares de e-mails numa importação. A regra de alerta passará a ignorar itens de importação (Astrea, Projuris, planilhas), mantendo os alertas normais para criação manual e para itens gerados de publicações.

## Detalhes técnicos

- `src/pages/ImportarTarefas.tsx` (fluxo Astrea, fase 2): dedupe em memória por chave de negócio; fallback linha-a-linha quando `insert` do lote retorna erro; mensagens de status por linha.
- Migração: ajustar `public.prevent_duplicate_tarefas()` para retornar sem bloquear quando `NEW.origem IN ('astrea','projuris','pauta_excel','importacao')`.
- Migração: ajustar `public.enqueue_criacao_item()` para não enfileirar quando `NEW.origem` for uma origem de importação (mesma lista), preservando alertas para `analise_djen`, `ia_djen`, `publicacao`, `manual` e criação manual.
- Nenhuma alteração em dados existentes de outras coordenações.

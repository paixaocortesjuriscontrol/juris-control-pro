# Causa encontrada: descartar a publicação apaga a audiência criada a partir dela

## Prova no banco (auditoria de itens)

O item **foi salvo** e depois **foi apagado pelo próprio sistema**, no mesmo instante em que a publicação foi descartada:

Processo 0000639-98.2025.5.10.0111 (pauta da 2ª Turma, sessão 16/09/2026 14:00)
- 12:22:00 — audiência criada (`Julgamento RO - 2ª Turma - Rel Alexandre Nery...`), vinculada à publicação.
- 12:22:20 — audiência **apagada**, exatamente no mesmo milissegundo em que a publicação foi movida para descartadas.

Processo 0000131-06.2026.5.10.0019
- 12:47:43 — audiência criada (`Instrução Presencial`).
- 12:48:16 — audiência **apagada**, no mesmo milissegundo do descarte da publicação.

O mesmo padrão aparece outras vezes hoje (12:32, 12:55, 13:30).

## Por que acontece

A coluna que guarda "publicação de origem" na tabela de audiências está configurada como **exclusão em cascata**. O botão **Descartar** da Análise DJEN não arquiva a publicação: ele **apaga** a linha da publicação e grava uma cópia na tabela de descartadas. Como a audiência aponta para a linha apagada, o banco apaga a audiência junto — sem erro, sem aviso, sem lixeira.

Isso explica o relato: ela agenda, o item aparece, ela descarta a publicação para limpar a lista e o agendamento desaparece da pasta.

Volume histórico: **7.156** audiências constam como apagadas na auditoria e não existem mais, sendo **379 nos últimos 30 dias**. Nem todas vêm do descarte, mas é a mesma porta.

Observação: **tarefas não são apagadas** — só o vínculo tarefa↔publicação cai na cascata. O problema de perda de registro é específico das audiências. Comentários feitos na publicação também são apagados no descarte.

## O que será feito

1. **Descartar publicação nunca mais apaga audiência**
   - O vínculo passa a ser desfeito em vez de apagado: ao remover a publicação, a audiência permanece com todos os dados (só perde o ponteiro para a publicação, que já fica guardado no conteúdo copiado).

2. **Aviso antes de descartar**
   - Se a publicação já tem itens criados (audiência, prazo, tarefa, evento), o botão Descartar mostra confirmação: "Esta publicação já gerou N item(ns). Eles serão mantidos e apenas a publicação sai da lista."

3. **Descarte deixa de destruir histórico**
   - Comentários da publicação e vínculos criados a partir dela passam a ser preservados/reapontados para o registro descartado, em vez de sumirem.

4. **Varredura das outras rotinas que apagam publicações**
   - Revisar as rotinas de deduplicação/limpeza que também apagam linhas de `publicacoes_djen`, para nenhuma delas voltar a arrastar audiências.

5. **Recuperar o que foi perdido**
   - Recriar, a partir da auditoria, as audiências apagadas por descarte que não existem mais — começando pelos casos da Dra. Janaina (inclusive a pauta de 16/09/2026 do processo 0000639-98.2025.5.10.0111) e ampliando para os últimos 30 dias, com relatório do que foi restaurado.
   - Restauração só cria o que não existe hoje (não duplica os itens que ela já refez manualmente).

## Detalhes técnicos

- Migração: `audiencias_detectadas_publicacao_id_fkey` passa de `ON DELETE CASCADE` para `ON DELETE SET NULL`. Mesma revisão para `comentarios_publicacoes_djen` (repointar/preservar) e para as junções `audiencias_publicacoes` / `tarefas_publicacoes`.
- `descartar_publicacao_manualmente`: antes do `DELETE`, desvincular explicitamente (`publicacao_id = NULL`) e registrar em `conteudo_publicacao`/tabela de descartadas a rastreabilidade do vínculo perdido.
- UI: contagem prévia de itens criados (reaproveitar `useAgendadosPorPublicacao`) no fluxo de descarte da Análise DJEN, com diálogo de confirmação.
- Restauração: script de dados usando `auditoria_tarefas` (`tipo_item = 'audiencia'`, `acao = 'criar'` seguido de `acao = 'deletar'` no mesmo segundo de um descarte) reinserindo a partir de `dados_saida`, com `publicacao_id` nulo e checagem de existência por processo + data + título.

# Corrigir checklists das tarefas migradas do Projuris

## Objetivo
Toda tarefa migrada do Projuris que tinha checklist deve mostrar os mesmos itens (com marcado/desmarcado) na aba Checklist, sem duplicar e sem mexer em tarefas que não vieram do Projuris.

## Situação atual (a confirmar no primeiro passo)
A importação de checklists já existe e liga cada checklist à tarefa pela auditoria da migração (tipo "tarefa" + código Projuris). Suspeita, ainda não confirmada: as tarefas trazidas pelo Backup completo e as corrigidas depois ficam registradas com outro formato de código, então parte dos checklists não encontra a tarefa e é ignorada sem aviso.

## Passos
1. Diagnóstico: comparar quantos checklists do arquivo apontam para tarefas (módulo tarefa no `checklistvinculomodulo`), quantos encontram tarefa migrada e quantos já estão gravados; listar o motivo dos que ficaram de fora.
2. Ligação mais robusta: procurar a tarefa pelo código Projuris em todos os formatos usados pelas importações (planilha e backup) e, como reserva, pelo identificador TAR.x da tarefa.
3. Conferência antes de gravar: mostrar na tela quantos checklists serão criados, quantos já existem e quantos continuam sem tarefa (com download da lista).
4. Botão "Corrigir checklists das tarefas migradas": grava só os que faltam, em lotes com barra de progresso; os já existentes são atualizados apenas no estado marcado/desmarcado, sem duplicar.
5. Permitir usar os CSVs avulsos de checklist ou os mesmos arquivos dentro do ZIP do Backup completo.

## Detalhes técnicos
- Arquivo principal: `src/components/migracao/ImportarChecklistsProjuris.tsx` (+ funções puras testadas em `src/lib`).
- Deduplicação continua por `checklist_itens.chave_externa = 'projuris:<cd>'`; "desfazer" continua removendo esse prefixo.
- Sem nova tabela; só leitura extra em `migracoes_projuris_itens`/`tarefas`. Restrito a admin, como o resto da Migração Projuris.
- Testes para a ligação checklist→tarefa nos diferentes formatos de código.

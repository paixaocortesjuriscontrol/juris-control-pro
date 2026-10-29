# Checklist igual ao Projuris + migração dos checklists

## Como funcionava no Projuris (lido dos arquivos enviados)
- **Modelos de checklist** (checklisttemplate + itens): 2 ativos — "DEFESA FICTA" (8 itens) e "SIMULADOR" (21 itens); 2 inativos de teste ("SIMULADOR"/"SIMULADOR 2", itens A/B).
- **Checklist da tarefa** (checklist + checklistitem): ao usar um modelo, o Projuris copiava os itens para a tarefa. São 5.698 checklists com 90.404 itens; 14.129 marcados e 76.275 não marcados. Cada item tem texto, ordem e "marcado sim/não" — sem responsável nem data.
- **Vínculo** (checklistvinculomodulo): 5.693 checklists ligados a tarefas (módulo 4) e 5 a outro módulo (39). As chaves batem com as tarefas já migradas do Projuris.
- **checklistwizardcontrole**: é só o tutorial de boas-vindas do Projuris por usuário. Não será migrado.

## Como fica no Juris Control
1. **Modelos de checklist por coordenação**: tela simples para criar/editar modelos (nome, descrição, itens ordenados). DEFESA FICTA e SIMULADOR são importados como modelos.
2. **Checklist dentro da tarefa/prazo**: bloco "Checklist" na ficha do item com caixinhas para marcar ou desmarcar, mostrando o progresso (ex.: 5/21). Botão "Aplicar modelo" copia os itens do modelo, como no Projuris; também dá para adicionar, editar ou remover itens soltos. Quem marcou e quando fica registrado.
3. **Workflows**: a etapa do workflow pode indicar um modelo de checklist, que é aplicado automaticamente à tarefa criada.
4. **Migração**: nova importação "Checklists" na tela Migração Projuris (só admin). Ela recebe os 4 arquivos, liga cada checklist à tarefa já migrada pela chave do Projuris, mantém o marcado/não marcado e a ordem, registra cada item para deduplicar e permite "desfazer lote". Checklists sem tarefa correspondente (incluindo os 5 do módulo 39) aparecem no relatório final, sem serem importados.

## Detalhes técnicos
- Novas tabelas: `checklist_modelos` (coordenacao_id, nome, descricao, ativo), `checklist_modelo_itens` (modelo_id, titulo, ordem), `checklist_itens` (tipo_item, item_id, titulo, ordem, marcado, marcado_por, marcado_em, modelo_id). Na migração, os campos de quem marcou ficam vazios porque o Projuris não guardava isso.
- RLS seguindo o mesmo acesso de `subatividades_item` e dos itens: quem pode ver ou editar a tarefa pode ver ou editar o checklist; os modelos ficam limitados aos membros da coordenação, e admins podem tudo. GRANTs para authenticated e service_role.
- `workflow_etapas` ganha `checklist_modelo_id` (nullable); `workflowExecutor` copia os itens ao criar a tarefa.
- Importação em Web Worker e em lotes de 500, registrando em `migracoes_projuris_itens` com os tipos `checklist_modelo` e `checklist_item`; a tarefa é encontrada pela `chave_externa` do tipo `tarefa`.
- Testes: mapeamento CSV → itens (ordem, S/N), ligação com a tarefa e cópia do modelo.

## Pergunta em aberto
Na importação, os modelos vão para qual coordenação? Proposta: a coordenação das tarefas que mais usaram cada modelo (Santander Cível).

# Retirar cópias antigas duplicadas vindas de carga, sem uso

## Regra (todas as condições ao mesmo tempo)
1. A tarefa tem uma cópia igual (mesmo código TAR.) criada na carga de 25/11 — a de 25/11 nunca é apagada nem alterada.
2. A cópia antiga foi criada até 13/11 (BRT) **por carga comprovada**:
   - lote registrado "Projuris Agenda Futura 13/11/2026", ou
   - carga em massa de 01/10/2026 às 10:01 (BRT): 6.666 tarefas Projuris gravadas no mesmo minuto. O nome que aparece como criador (Marcela, Altina, Lucas etc.) é o responsável preenchido pela carga, não alguém digitando.
3. Ninguém da equipe mexeu nela: nenhuma alteração, troca de pessoas, comentário ou anexo.
4. Não é a única cópia com comentários do Projuris.

## Quantidade
- 4.518 da carga de 01/10 + 239 da carga de 13/11 = **4.757 tarefas**.
- Ficam de fora 29 cópias sem uso cuja carga não dá para comprovar (criadas sem lote e fora da carga em massa) e 2 que têm comentários só na cópia antiga.
- Depois da retirada sobram 1.404 duplicadas, para decisão da equipe.

## O que será feito
1. Excel `copias_antigas_para_retirar.xlsx` com as 4.757 (processo, título, código TAR., carga de origem, data de criação, situação, vencimento, responsáveis e a cópia de 25/11 que permanece) para conferência antes de apagar.
2. Backup completo (tarefa, responsáveis, envolvidos, comentários importados, etiquetas, registros de migração) em tabelas próprias, permitindo restaurar.
3. Exclusão apenas da lista fixa de IDs, sem notificações; a lista é recalculada no momento e, se alguém tiver mexido em alguma desde agora, ela sai da lista.
4. Conferência final: nenhuma tarefa de 25/11 alterada; contagem das duplicadas restantes.

## Detalhes técnicos
- Par: tarefa de 25/11 com `observacoes` "Identificador Projuris: TAR.x" ↔ tarefa com `identificador_projuris = TAR.x`.
- Carga comprovada: `migracoes_projuris_itens` do lote Agenda Futura, ou `origem='projuris'` com `created_at` no minuto 01/10/2026 10:01 BRT.
- Sem uso: nenhuma linha em `auditoria_tarefas` (exceto `criar`) nem `comentarios_tarefas` de usuário que não seja o admin; nenhum `documentos`.
- Backup `backup_copias_antigas_duplicadas_20261127` (+ filhas) antes do delete.

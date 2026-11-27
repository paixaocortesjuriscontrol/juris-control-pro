# Retirar cópias duplicadas da carga de 13/11 sem uso

## O que foi encontrado (somente leitura)
- 728 tarefas da carga de 13/11 (Agenda Futura) têm uma cópia igual criada em 25/11 (mesmo código TAR.).
- 487 delas foram usadas pela equipe (alteração, troca de pessoas, comentário ou anexo): ficam como estão.
- 241 nunca foram tocadas por ninguém da equipe (só pela importação/sistema), sem anexos e sem comentários da equipe. Todas estão em aberto e a cópia de 25/11 de cada uma já tem responsável.
- Em 2 dessas 241, só a cópia de 13/11 tem os comentários vindos do Projuris: essas 2 também ficam, para não perder nada.

## O que será feito
1. Excel `copias_13-11_para_retirar.xlsx` com as 239 tarefas (processo, título, código TAR., situação, vencimento, responsáveis e a cópia de 25/11 que permanece), para conferência.
2. Backup completo das 239 (tarefa, responsáveis, envolvidos, comentários importados, histórico de migração) em tabela própria, permitindo restaurar.
3. Exclusão apenas dessas 239 cópias de 13/11, sem notificações.
4. Conferência final: nenhuma tarefa de 25/11 alterada; contagem de pares duplicados restantes.

Nada de 25/11 é apagado ou alterado.

## Detalhes técnicos
- Par: tarefa de 25/11 com `observacoes` "Identificador Projuris: TAR.x" ↔ tarefa com `identificador_projuris = TAR.x` registrada em `migracoes_projuris_itens` do lote "Projuris Agenda Futura 13/11/2026".
- "Sem uso": nenhuma linha em `auditoria_tarefas` (exceto `criar`) nem `comentarios_tarefas` de usuário que não seja o admin da importação; nenhum `documentos`.
- Backup `backup_copias_1311_duplicadas_20261127` (+ filhas), depois delete por lista fixa de IDs; itens de `migracoes_projuris_itens` dessas tarefas também salvos e removidos.

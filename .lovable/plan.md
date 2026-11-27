# Corrigir falsas duplicadas entre coordenações

## O que aconteceu
Os códigos TAR do Projuris se repetem entre bases diferentes. A Santander Trabalhista e a Dr. Thomás têm backups próprios, com a numeração começando do zero, por isso o mesmo TAR.0000093 aparece em tarefas diferentes. Nas análises de hoje, comparei os códigos sem conferir a coordenação:
- **4.518 tarefas da Santander Trabalhista foram apagadas por engano** na retirada das "cópias antigas". Elas não eram cópias de nada da Santander Cível: nenhuma tinha o mesmo processo ou o mesmo título.
- 915 das 1.404 tarefas marcadas agora há pouco (909 da Trabalhista e 6 da Dr. Thomás) receberam a etiqueta e o aviso sem motivo.
- As 239 tarefas apagadas e as 489 marcadas da Santander Cível estão corretas, porque foram comparadas dentro da mesma coordenação.
- A proteção nas futuras importações já compara dentro da mesma coordenação. Ela não muda.

## Passos
1. Devolver as 4.518 tarefas da Santander Trabalhista a partir do backup, com os mesmos IDs, situação, datas, responsáveis, envolvidos, comentários e registros de migração, sem notificar ninguém.
2. Tirar a etiqueta e o aviso das 915 tarefas marcadas por engano, voltando as observações ao texto guardado no backup.
3. Revisar as 489 da Santander Cível: 3 delas não estão no mesmo processo da cópia de 25/11. Essas 3 também saem da marcação, a não ser que o título e o código confirmem a duplicidade.
4. Conferir no fim: 4.518 de volta, com as mesmas contagens de pessoas e comentários do backup; só tarefas da Santander Cível com a etiqueta. Gerar um Excel das tarefas devolvidas.

## Detalhes técnicos
- Fontes: `backup_copias_antigas_duplicadas_20261127` e as tabelas filhas `_resp`, `_env`, `_com` e `_mig`, filtradas pela coordenação Santander Trabalhista; `backup_obs_copias_mantidas_20261127` para as observações.
- Restauração com `session_replication_role = replica` para não disparar notificações, e `ON CONFLICT DO NOTHING`.
- Anexos (`documentos`) não foram apagados na exclusão; conferir se continuam ligados aos mesmos IDs.
- Registrar no AGENTS.md: as comparações de duplicadas do Projuris sempre usam o código TAR junto com a coordenação.

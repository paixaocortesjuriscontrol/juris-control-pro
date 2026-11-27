# Devolver 2 tarefas de ACOMPANHAMENTO da Santander Cível

## Passos
1. Devolver a partir do backup as tarefas TAR.0083930 (vencimento 07/12/2026) e TAR.0034749 (vencimento 30/11/2026), com a mesma situação, datas, responsáveis, envolvidos, comentários e registros de migração, sem notificar ninguém.
2. Conferir que as duas voltaram e mostrar aqui no chat: código, título, situação, vencimento, responsáveis e o processo da cópia de 25/11 correspondente.

## Detalhes técnicos
- Fonte: `backup_copias_antigas_duplicadas_20261127` e as tabelas filhas `_resp`, `_env`, `_com` e `_mig`, pelos IDs 213f73a9-b0ea-49e0-bc5b-86aa3ba9ee56 e c800ca54-4384-4303-8200-5101d303a516.
- Usar `session_replication_role = replica` e `ON CONFLICT DO NOTHING`, do mesmo jeito que na restauração da Trabalhista.
- As cópias de 25/11 não mudam.

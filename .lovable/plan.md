# Marcar publicações DJEN até 31/10/2026 como lidas pela Isabela Constantino

## O que será feito
- Coordenação Santander Cível, publicações DJEN com data de disponibilização até 31/10/2026 (horário de Brasília): **28.772 publicações**.
- 75 já estão lidas pela Isabela Constantino e ficam como estão.
- As outras **28.697** passam a constar como lidas por ela, com o nome dela no registro de leitura.
- Todas ficam marcadas como lidas na tela (hoje só 80 estão).
- Ninguém recebe aviso. Publicações de outras coordenações não são tocadas.

## Detalhes técnicos
- Escopo: `coalesce(publicacoes_djen.coordenacao_id, monitoramentos_djen.coordenacao_id) = Santander Cível` e `coalesce(data_disponibilizacao, data_publicacao) < 2026-11-01 00:00 -03`.
- Backup `backup_leitura_djen_santander_civel_20261125` (id, lida) antes da mudança.
- Inserir em `publicacoes_djen_leituras` (tabela_origem `termo`, usuario_id da Isabela, usuario_nome "Isabela Constantino", lida_em = agora) só onde ainda não existe, em lotes.
- `UPDATE publicacoes_djen SET lida = true` no mesmo escopo.
- Conferir contagens ao final.

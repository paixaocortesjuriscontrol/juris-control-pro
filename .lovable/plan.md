# Auditoria completa da Distribuição TST

Objetivo: registrar todas as alterações feitas nos registros da Distribuição TST (tabela `dados_benner`) e disponibilizar uma tela de consulta no menu **Administração TST**, restrita a administradores.

Hoje essa tabela não possui nenhum registro de histórico (só os gatilhos de `updated_at` e sincronismo de data de distribuição), por isso não é possível saber quem alterou ou apagou um campo — foi exatamente o que aconteceu na conferência do quadro Julgamento. A auditoria passa a valer de agora em diante.

## O que será registrado

Para cada criação, alteração e exclusão de um registro da Distribuição TST:

- Data/hora, usuário que fez a alteração e coordenação do registro
- Processo (CNJ), dossiê e equipe do registro
- Ação: criado, alterado ou excluído
- Campo a campo: nome do campo, valor anterior e valor novo (inclusive campos do quadro Julgamento, matérias, chances de êxito, situação de envio, tags etc.)
- Origem da alteração (tela de análise, importação em lote, preenchimento por IA, JUDIT, rotina administrativa)

Campos técnicos (`updated_at`, marcações internas de controle) são ignorados no diff para não gerar ruído.

## Tela de consulta

Nova opção no menu Administração TST, grupo "Distribuição TST": **Auditoria da Distribuição TST** (`/admin-tst/auditoria-distribuicao`), visível apenas para administradores.

Recursos da tela:

- Busca por processo (CNJ, aceitando com ou sem pontuação) ou dossiê
- Filtros: período (de/até), usuário, coordenação, ação (criado/alterado/excluído), origem e campo alterado (ex.: "Data Julgamento")
- Lista paginada com data/hora, usuário, processo/dossiê, ação, origem e resumo dos campos alterados
- Detalhe em modal: tabela "Campo | De | Para" com rótulos em português, mais o registro completo antes/depois
- Visão por registro: ao abrir um processo/dossiê, linha do tempo completa de todas as alterações daquele registro
- Exportar o resultado filtrado para Excel

## Detalhes técnicos

1. Nova tabela `auditoria_distribuicao_tst`: `dados_benner_id`, `processo`, `dossie`, `equipe`, `coordenacao_id`, `usuario_id`, `acao`, `origem`, `dados_antes` (jsonb), `dados_depois` (jsonb), `campos_alterados` (jsonb: campo/de/para), `created_at`. Índices por `dados_benner_id`, `created_at`, processo normalizado (só dígitos), `dossie` e `usuario_id`. GRANTs para `authenticated` (somente leitura) e `service_role`; RLS liberando leitura apenas para administradores (`has_role(auth.uid(),'admin')`) e inserção apenas via gatilho/`service_role`.
2. Função `audit_dados_benner_changes()` (SECURITY DEFINER, espelhando o padrão de `audit_item_changes`) + gatilho `AFTER INSERT/UPDATE/DELETE` em `public.dados_benner`. Em UPDATE, sai sem gravar quando o diff é vazio.
3. Origem: a função lê `current_setting('app.audit_origem', true)`; rotinas de importação/IA/JUDIT passam a definir esse valor quando possível, com fallback `'tela'`/`'desconhecida'`.
4. Volume: importações em massa geram muitos registros. O diff guarda apenas campos realmente alterados, e será criada uma rotina de retenção (limpeza de registros com mais de 12 meses) para manter a tabela sob controle.
5. Frontend: hook `useAuditoriaDistribuicaoTst` (React Query com paginação por `range`), página `src/pages/admin-tst/AuditoriaDistribuicaoTst.tsx` usando `MainLayout` e protegida por `AdminRoute`, rota em `src/App.tsx` e novo card em `src/pages/AdminTst.tsx`.
6. Extra: botão "Histórico de alterações" no formulário de análise da Distribuição TST, abrindo a linha do tempo do registro aberto (apenas admin).

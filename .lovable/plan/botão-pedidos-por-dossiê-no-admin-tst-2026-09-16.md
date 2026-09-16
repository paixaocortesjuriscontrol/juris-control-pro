# Botão "Pedidos por dossiê" no Admin. TST

Levar a importação da planilha "Pedidos por dossiê" (hoje só existe como botão na tela Distribuição TST) também para a tela Admin. TST, seguindo o mesmo padrão das demais importações (card + página própria com instruções).

## O que será feito

### 1. Nova página `/admin-tst/pedidos-por-dossie`
- Arquivo `src/pages/admin-tst/PedidosPorDossie.tsx`, usando o componente padrão `PaginaImportacao` (mesmo visual das outras telas de importação do Admin TST).
- Título "Pedidos por Dossiê", com instruções de uso:
  - planilha `.xlsx` com coluna A = Dossiê e coluna B = pedidos separados por `|`;
  - a importação substitui os pedidos dos dossiês presentes na planilha (dossiês fora da planilha não são afetados);
  - pedidos novos são cadastrados automaticamente na lista oficial de matérias.
- A ação da página é o componente existente `PedidosPorDossieDialog` (sem alterar sua lógica).

### 2. Card na tela Admin. TST
- Novo card "Pedidos por Dossiê" no grupo **Importações Distribuição TST** de `src/pages/AdminTst.tsx`, com ícone e descrição explicando que importa a planilha de pedidos por dossiê usada para destacar as matérias na ficha.

### 3. Rota
- Registrar `/admin-tst/pedidos-por-dossie` em `src/App.tsx` com `ProtectedRoute`, ao lado das demais rotas `/admin-tst/*`.

### 4. Botão original mantido
- O botão "Pedidos por dossiê" na tela Distribuição TST **permanece** (a mesma importação fica acessível nos dois lugares).

## Detalhes técnicos
- Nenhuma migração ou mudança de banco: a tabela `pedidos_por_dossie` e o diálogo de importação já existem.
- `AdminTst.tsx` ganha um item em `groups[0].tools`; o card respeita o padrão visual existente.
- Permissões: a página Admin. TST já é restrita a admin/coordenador (`AdminRoute` no App); nenhuma permissão nova.

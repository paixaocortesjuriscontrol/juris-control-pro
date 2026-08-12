# Ajuste de menu no Painel de Controle

## Objetivo
Remover os botões "Indicadores" e "Rel. Auditoria" do header do Painel de Controle, colocá-los como itens do menu lateral logo abaixo de "Painel de Controle", e remover o botão "Somente Hoje" dos filtros do Painel de Controle.

## Alterações

### 1. Painel de Controle (`src/pages/PainelControle.tsx`)
- Remover do `headerActions`:
  - Botão `Link` para `/indicadores` (texto "Indicadores").
  - Botão `Link` para `/auditoria-itens` (texto "Rel. Auditoria"), condicional a `isAdminOrCoordinator`.
- Remover dos filtros o botão de toggle "Somente Hoje" (`somenteHoje`) e seu estado/efeitos relacionados somente se não forem usados por outros componentes da tela. Se o estado for usado por outros trechos, mantê-lo em memória e apenas remover o botão visível.

### 2. Menu lateral (`src/config/menuItems.ts`)
- Adicionar import do ícone `BarChart3` (o `FileText` já está importado).
- Inserir dois itens novos logo abaixo de "Painel de Controle" na seção `menuItemsPublicos`:
  - `{ icon: BarChart3, label: "Indicadores", path: "/indicadores" }` — sem restrição extra, já que a própria página controla acesso interno.
  - `{ icon: FileText, label: "Rel. Auditoria", path: "/auditoria-itens", adminOrCoordOnly: true }` — mantendo a mesma permissão do botão atual.

## Verificação
- Abrir o Painel de Controle: o header deve conter apenas os botões de totalizadores, filtros e configurações de notificações (além de "Rel. Audiências"), sem "Indicadores" e "Rel. Auditoria".
- No menu lateral, "Indicadores" e "Rel. Auditoria" devem aparecer imediatamente abaixo de "Painel de Controle".
- O botão "Somente Hoje" não deve aparecer mais entre os filtros.
- Navegar pelos novos itens do menu e confirmar que as rotas `/indicadores` e `/auditoria-itens` continuam funcionando.

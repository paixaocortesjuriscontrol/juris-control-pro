# Versão v7.0.0 no menu

## O que muda

O selo de versão no menu lateral passa de **v6.0.1** para **v7.0.0**, e o histórico interno de versões ganha o registro da nova versão.

Como o menu já lê a versão de um ponto central, basta atualizar esse valor em dois lugares que precisam andar juntos:

1. `src/constants/version.ts`
   - `APP_VERSION = "6.0.1"` → `"7.0.0"`
   - Nova entrada no histórico: `{ version: "7.0.0", date: "2026-09-06", notes: "Reformulação da tela Distribuição TST: cards combináveis, linha dupla com tags, indicadores de pendência e matérias por dossiê" }`

2. `public/version.json`
   - `"version": "6.0.1"` → `"7.0.0"` (esse arquivo é o que faz o sistema avisar os usuários logados de que há versão nova; se ficar desatualizado, o aviso some)

O badge no menu (`Sidebar.tsx`, que exibe `v{APP_VERSION}`) atualiza sozinho — nenhuma outra tela é tocada.

## Verificação

- `npx tsgo --noEmit -p tsconfig.app.json` sem erros e `build OK`
- Conferir no preview: o menu lateral passa a mostrar **v7.0.0**

# Versão v7.7.0 no menu

## O que muda

O selo de versão no menu lateral passa de **v7.6.1** para **v7.7.0**, e o histórico interno de versões ganha o registro desta release.

Alteração em um único arquivo, `src/constants/version.ts`:

1. `APP_VERSION = "7.6.1"` → `"7.7.0"`
2. Nova entrada no fim do histórico:

```text
{ version: "7.7.0", date: "2026-10-07", notes: "Restaurar em lote na tela Arquivados da Distribuição TST (planilha de dossiês/processos e tag existente ou nova); envolvida marcada em 'Quem pode mudar cada situação' pode aplicar aquela situação ao item" }
```

O badge do menu (`Sidebar.tsx`, que exibe `v{APP_VERSION}`) e o aviso de "nova versão" para os usuários atualizam sozinhos: o arquivo `public/version.json` é reescrito a cada build pelo plugin `write-version-json` (em `vite.config.ts`), lendo o valor de `APP_VERSION`. Nenhuma outra tela, consulta ou regra de acesso é tocada.

## Verificação

- Compilação sem erros e `build OK`
- Conferir no preview: o menu lateral passa a mostrar **v7.7.0**

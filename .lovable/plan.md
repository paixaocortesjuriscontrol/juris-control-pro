# Atualizar versão para v5.0.0 e publicar

## Objetivo
Alterar a versão exibida no menu/app de **4.5.5** para **5.0.0** e publicar a versão atualizada.

## Arquivos afetados
- `src/constants/version.ts`: `APP_VERSION` e `VERSION_HISTORY`
- `public/version.json`: `version` e `buildTime`

## Passos
1. Atualizar `APP_VERSION` para `"5.0.0"`.
2. Adicionar entrada `v5.0.0` no `VERSION_HISTORY` com a data atual (2026-08-18) e descrição do marco.
3. Atualizar `public/version.json` para `"5.0.0"` e ajustar `buildTime` para o momento atual.
4. Verificar scan de segurança e publicar a aplicação via `preview_ui--publish`.

## Nota
A publicação será feita apenas após aprovação do plano e confirmação de que não há findings críticos de segurança pendentes.

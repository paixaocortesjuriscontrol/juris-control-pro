

# Plano: Atualizar para Versão 1.0.7

## Resumo

Atualização do número de versão do sistema de `1.0.6` para `1.0.7` com registro das alterações feitas nesta release.

---

## O Que Será Feito

### 1. Atualizar o arquivo de versão

**Arquivo:** `src/constants/version.ts`

- Alterar `APP_VERSION` de `"1.0.6"` para `"1.0.7"`
- Adicionar nova entrada no `VERSION_HISTORY` com:
  - Data: `2026-02-02` (data atual)
  - Notas: Baseado no último diff, a alteração foi no filtro "Apenas Hoje" na página de Análise DJEN

---

## Nota Sugerida para o Changelog

Com base na última alteração feita (filtro "Apenas Hoje" marcado por padrão na Análise DJEN):

> **v1.0.7** - "Filtro 'Apenas Hoje' ativado por padrão na Análise DJEN"

---

## Após a Implementação: Como Fazer o Pull Request

1. **No GitHub**, acesse: `https://github.com/paixaocortesjuriscontrol/juris-control-pro`
2. Clique em **"Compare & pull request"** (aparecerá automaticamente após o commit na branch `main_v1.0.7`)
3. Ou vá em **Pull requests** → **New pull request**:
   - **base:** `main`
   - **compare:** `main_v1.0.7`
4. Adicione um título descritivo (ex: "Release v1.0.7 - Filtro Apenas Hoje ativado por padrão")
5. Clique em **"Create pull request"**
6. Após revisar, clique em **"Merge pull request"** para mesclar à `main`

---

## Detalhes Técnicos

```typescript
// Antes
export const APP_VERSION = "1.0.6";

// Depois
export const APP_VERSION = "1.0.7";

// Nova entrada no histórico
{ version: "1.0.7", date: "2026-02-02", notes: "Filtro 'Apenas Hoje' ativado por padrão na Análise DJEN" }
```


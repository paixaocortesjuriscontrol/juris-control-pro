## Reorganizar bloco final em `src/pages/CompararDjSantander.tsx`

**Layout novo:**

```text
┌──────────────────────────────────────────────────┐
│ Processos em Comum  — grid 4 colunas (lg)        │
└──────────────────────────────────────────────────┘
┌────────────────────────┬────────────────────────┐
│ Somente Doc (1 coluna) │ Somente PDF (1 coluna) │
└────────────────────────┴────────────────────────┘
```

**Mudanças:**

1. Trocar wrapper externo `grid md:grid-cols-3` por `space-y-6`.
2. **Em Comum** → wrapper interno vira `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2` (largura total + 4 colunas).
3. **Somente Doc + Somente PDF** → envolver os dois Cards em `grid md:grid-cols-2 gap-6`; conteúdo interno vira `flex flex-col` (lista vertical de 1 coluna).
4. Adicionar `whitespace-nowrap` aos 3 Badges (Em Comum, Somente Doc, Somente PDF) para impedir quebra do CNJ.

Sem alteração em lógica, dados ou PDF.
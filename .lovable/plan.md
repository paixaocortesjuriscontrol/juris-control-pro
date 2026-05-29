## Objetivo
Na tela **Distribuição TST**, salvar automaticamente o conteúdo atual ao trocar de aba (Distribuição TST, Centralizadores, Dados Benner, Análise Judit, Anexos), como se o usuário tivesse clicado em **Salvar**.

## Arquivo a alterar
`src/components/distribuicao-tst/DistribuicaoTstDetail.tsx`

## Como funciona hoje
- Botão **Salvar** chama `handleSaveTop()` (linha 257), que persiste:
  - Form de Distribuição TST (via `formRef.current.save()`)
  - Form de Dados Benner (via `bennerFormRef.current.save()`)
  - Switches "Pronto para Enviar", "Problema Judit", "Trânsito em Julgado", "Outro escritório", "Segredo de Justiça"
- Troca de aba: `<Tabs onValueChange={(v) => setTab(v as any)}>` (linha 390), sem auto-save.

## Mudança
Trocar o handler do `Tabs` para um novo `handleTabChange(novaAba)` que:
1. Se a aba atual for diferente da nova **e** não estiver em pleno auto-save, chama `await handleSaveTop()`.
2. Em seguida, faz `setTab(nova)`.
3. Falha silenciosa: se o save falhar, ainda permite trocar de aba (o `handleSaveTop` já mostra toast de erro internamente). Sem bloqueio adicional.

Notas:
- A aba **Log Judit** (visível apenas para o usuário interno) entra no mesmo fluxo — qualquer troca dispara o save.
- Mantém o botão Salvar do header funcionando exatamente como hoje (nenhuma mudança em `handleSaveTop`).
- Sem alterações em outros componentes, hooks, edge functions, schema ou migrations.

## Detalhes técnicos
```tsx
const handleTabChange = async (v: string) => {
  if (v === tab) return;
  try { await handleSaveTop(); } catch { /* toast já tratado dentro do save */ }
  setTab(v as any);
};
// ...
<Tabs value={tab} onValueChange={handleTabChange} ...>
```

Indicador visual: enquanto `savingTop` for `true`, o botão Salvar do header já exibe spinner — nada novo a adicionar.
## Problema

Na tela **Distribuição TST**, o processo `0010079-69.2024.5.15.0126` aparece duplicado (mesmo `processo`, dossiês diferentes em `dados_benner`). Ao marcar um card como **Pronto para Enviar**, o efeito aparece no outro card.

## Causa

Em `src/components/distribuicao-tst/DistribuicaoTstDetail.tsx`, `fetchBennerByProcesso` busca a linha de `dados_benner` por **processo** apenas:

```ts
.from("dados_benner").select("*").eq("processo", processoNumero).limit(1)
```

Quando existem 2 linhas com o mesmo processo, qualquer card aberto carrega sempre a **primeira** linha. O switch "Pronto para Enviar" então salva no `id` dessa linha, e o usuário vê a mudança no card "errado".

Mesma falha no fallback de **Problema Judit** (`.eq("processo", processoNumero)` sem `id`), que pode atualizar todas as duplicatas de uma vez.

`dado.id` já é o `dados_benner.id` (confirmado em `bennerToDistribuicao`), então a chave correta já está disponível no card aberto.

## Correção

1. **`fetchBennerByProcesso`** — buscar por `id` quando `dado?.id` existe; só cair para `processo` quando for registro novo (sem id).
2. **`handleSaveTop` (Problema Judit)** — remover o fallback `eq("processo", processoNumero)`. Se não houver `id`, exigir reload antes de salvar (ou abortar com toast). Nunca atualizar por processo.
3. **Lista (`DistribuicaoTst.tsx`)** — quando o mesmo `processo` aparece em mais de uma linha, exibir o **dossiê** no card de forma destacada para o usuário diferenciar visualmente as duplicatas.
4. **Invalidar cache pelo id correto** após o save, garantindo que o card recarrega só sua própria linha.

## Verificação

- Abrir cada um dos dois cards do processo `0010079-69.2024.5.15.0126` e confirmar via console/logs que `bennerDado.id` é diferente em cada abertura.
- Marcar Pronto em um → conferir no banco/lista que somente aquele `id` ficou `pronto_envio`.
- Marcar Problema Judit em um → conferir que o outro permanece intacto.
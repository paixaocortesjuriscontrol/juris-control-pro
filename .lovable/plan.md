## Problema

Na tela DJEN Servidor, com filtro Origem = "DJEN Termos" e data 29/06, o comparador mostra `Total Browser 4338` × `Total Servidor 3374` e `Só Browser 964`. A diferença não é real:

- `publicacoes_djen` (lado Browser) recebe inserções tanto do motor DJEN Browser quanto da edge `kurier-consultar-publicacoes` (linhas com `fonte='kurier'`, `execucao_id=NULL`).
- `publicacoes_djen_servidor` é isolada e nunca recebe Kurier.
- O filtro atual de Origem só faz `tipo_publicacao != 'pauta'`; não exclui `fonte='kurier'`.

Resultado: todas as publicações importadas pelo Kurier no dia (964) aparecem falsamente como "Só Browser". Os 3 da coord Dr. Thomás (TRT1, TRT18, TJMT) já foram confirmados como `fonte='kurier'`, `execucao_id=NULL`.

## Mudança

Arquivo único: `src/hooks/useDjenServidor.ts`, no bloco onde Origem é aplicado (linhas 501-511 do trecho atual).

Adicionar, quando `origem === "termos"` ou `origem === "pautas"`, um filtro no lado Browser que exclua linhas inseridas pelo Kurier:

```ts
if (origem === "termos") {
  servQ = servQ.or("tipo_publicacao.is.null,tipo_publicacao.neq.pauta");
  browQ = browQ
    .or("tipo_publicacao.is.null,tipo_publicacao.neq.pauta")
    .or("fonte.is.null,fonte.neq.kurier"); // ⬅ novo
} else if (origem === "pautas") {
  servQ = servQ.eq("tipo_publicacao", "pauta");
  browQ = browQ
    .eq("tipo_publicacao", "pauta")
    .or("fonte.is.null,fonte.neq.kurier"); // ⬅ novo
}
```

Em "kurier" e "todos" não filtra (Kurier deve aparecer nessas modalidades).

Manter o servidor (`servQ`) sem alteração — ele já não tem Kurier.

## Validação

1. Reabrir a tela DJEN Servidor, 29/06 × 29/06, Origem "DJEN Termos", "Analisar".
2. Esperado:
   - Coord Dr. Thomás: 48 / 48 / 48 / 0 / 0.
   - "Só Browser" total cai de 964 para próximo de 0 (apenas diferenças reais entre os dois motores DJEN).
3. Trocar Origem para "Todas" e conferir que o Kurier volta a aparecer no resumo por fonte.
4. Trocar para "Kurier" e validar que só Kurier aparece.

Sem migração de banco. Sem mudança no motor Browser, Servidor ou Kurier.

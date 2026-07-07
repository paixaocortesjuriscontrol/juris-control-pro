## Objetivo

Fazer o motor "DJEN Servidor" (VPS) gravar diretamente nas tabelas do "DJEN Local":
- Publicações válidas → `publicacoes_djen` (em vez de `publicacoes_djen_servidor`)
- Publicações descartadas → `publicacoes_djen_descartadas` (mesma tabela do Local — hoje o Servidor só ignora)

Toda a UI de Análise DJEN (Local) já lê `publicacoes_djen`, então o resultado do Servidor passa a aparecer nas mesmas telas do Local, unificado.

## Onde mexer

### Único arquivo tocado
`supabase/functions/monitorar-djen/index.ts`

#### 1) `targetTable` (linha 519)
Antes:
```ts
const targetTable = persistMode.servidor ? 'publicacoes_djen_servidor' : 'publicacoes_djen';
```
Depois:
```ts
const targetTable = 'publicacoes_djen';
```

#### 2) Metadata do insert (linhas 549-552)
Manter `execucao_id` também no fluxo Servidor (coluna já existe em `publicacoes_djen`). Remover o `origem = 'servidor'` (a coluna não existe no destino; o Local usa `fonte`, deixamos `null` como hoje):
```ts
if (persistMode.servidor) {
  insertRow.execucao_id = persistMode.execucaoServidorId ?? null;
}
```

#### 3) Conflict target do upsert (linhas 556-558)
Ativar o upsert `(coordenacao_id, id_djen)` para os dois fluxos — o unique index `uq_pub_djen_coord_iddjen` já existe em `publicacoes_djen`:
```ts
let onConflictCols: string | undefined;
if (coordenacaoId && idDjen) onConflictCols = 'coordenacao_id,id_djen';
```

#### 4) Descartadas (linhas 471-486 e 497-512)
Remover os dois `if (!persistMode.servidor)` — Servidor passa a gravar em `publicacoes_djen_descartadas` igual ao Local.

### O que NÃO muda
- Tabelas `execucoes_servidor`, `workers_djen_vps`, progresso ao vivo, cancelamento — tudo continua igual.
- `publicacoes_djen_servidor` fica intocada (dados antigos preservados; ninguém escreve mais lá pelo motor).
- Motor Paralela (browser) e comparador — inalterados.
- Frontend — inalterado; as telas do Local já cobrem tudo.

## Efeitos práticos

- Deduplicação passa a ser cruzada: se o Local já capturou algo antes, o Servidor cai no unique `(coordenacao_id, id_djen)` e conta como duplicata. Isso é o comportamento desejado por "gravar nas tabelas do Local".
- Contagem em `useDjenServidor` (`execucoesDjenServidor`, progresso) segue funcionando — lê `execucoes_servidor`, não a tabela de publicações.
- Alertas de coordenação, resumo IA, marcação de lidas — tudo já opera sobre `publicacoes_djen` e passa a incluir as publicações do Servidor automaticamente.

## Memória de projeto a atualizar depois do build

Substituir a regra atual "DJEN Servidor é isolado do Browser: motor nunca lê/escreve `publicacoes_djen`" pela nova regra: **motor DJEN (Servidor e Browser) grava em `publicacoes_djen` e `publicacoes_djen_descartadas`. `publicacoes_djen_servidor` é legado (somente leitura histórica).**

## Risco / rollback

- Rollback: reverter as ~4 mudanças no arquivo. Nada de schema, nada de dados apagados.
- Nenhum GRANT novo necessário (edge function usa service_role).
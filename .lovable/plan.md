## Objetivo

Na tela **Análise DJEN Servidor**, marcar e mostrar as publicações que apareceram em execuções **posteriores** do mesmo dia (mesma `data_disponibilizacao`), comparando execuções consecutivas. Kurier fora.

## Modelo de dados

### Nova tabela `publicacoes_djen_servidor_execucoes` (junção)

Registra **toda vez** que uma execução "viu" uma publicação — inclusive quando ela já existia (duplicata). Sem isso, não há como dizer "a execução das 12:00 também viu as 140 da execução das 7:00".

Colunas:
- `publicacao_id uuid` → FK `publicacoes_djen_servidor(id)` ON DELETE CASCADE
- `execucao_id uuid` → FK `execucoes_servidor(id)` ON DELETE CASCADE
- `tipo_engine text` (`paralela` | `pautas`)
- `created_at timestamptz default now()`
- PK composta `(publicacao_id, execucao_id)`
- Índices: `(execucao_id)` e `(publicacao_id)`

RLS / GRANTs:
- `GRANT SELECT` para `authenticated`
- `GRANT ALL` para `service_role`
- Policy SELECT: `authenticated` lê tudo (mesma postura da `publicacoes_djen_servidor`)
- Sem policies de escrita — só `service_role` (edge functions) escreve

## Mudanças nas engines (gravar na junção)

### 1. `monitor-servidor/engines/paralela.js` (Termos servidor)
Logo após o INSERT bem-sucedido **e** no caminho "já existe / duplicata" (quando obtemos o `publicacao_id` da linha existente), fazer:
```js
await supabase.from('publicacoes_djen_servidor_execucoes')
  .upsert({ publicacao_id, execucao_id: execucaoId, tipo_engine: 'paralela' },
          { onConflict: 'publicacao_id,execucao_id', ignoreDuplicates: true });
```

### 2. `supabase/functions/executar-djet-pautas-agendado` (Pautas servidor)
Depois do upsert em `publicacoes_djen_servidor`, recuperar os ids (via `select`/`returning`) e inserir em lote na junção com `tipo_engine='pautas'`, `onConflict` ignorado.

### 3. Kurier
Não alterar.

## Backfill (opcional, mas recomendado para histórico recente)

Migration única: copiar `(id, execucao_id, 'paralela')` de `publicacoes_djen_servidor` onde `execucao_id IS NOT NULL` para a junção. Isso garante que execuções antigas tenham pelo menos o registro "vista pela primeira vez". Sem dados de "vista de novo", mas suficiente para a tela funcionar daí em diante.

## UI — `src/pages/AnaliseDjenServidor.tsx` + hook

### Card "Execuções do dia" (novo)
Aparece quando há mais de uma execução servidor para a `data_disponibilizacao` filtrada (ou hoje, quando nada filtrado), respeitando o filtro de coordenação já ativo na tela.

Para cada execução do dia, em ordem cronológica:
- Horário (HH:MM) + tipo (Termos / Pautas)
- Total de publicações vistas naquela execução (`count` na junção, com join na publicação para aplicar filtros de coordenação)
- **Novas vs. execução anterior do mesmo dia**: publicações cujo `publicacao_id` aparece nesta execução **e não aparece** em nenhuma execução anterior do mesmo `data_disponibilizacao` (e mesmo escopo de filtros).
  - Ex.: 7:00 → 140 vistas, 140 novas. 12:00 → 149 vistas, **9 novas**.
- Badge clicável "Ver X novas" filtra a lista principal para esse subconjunto.

### Marcação visual na lista principal
Cada linha de publicação ganha uma pílula discreta quando ela é "nova em execução posterior" (ou seja, a primeira execução que a viu **não é** a primeira execução do dia): `Nova na execução HH:MM`. Tooltip mostra de quais execuções ela veio.

### Hook `usePublicacoesDjenServidorUnificadas`
- Aceitar filtros opcionais: `execucaoId` (limita à junção dessa execução) e `apenasNovasNaExecucao` (limita às que não aparecem em execução anterior do mesmo dia).
- Trazer, junto com cada publicação, a lista de `execucao_ids` em que ela apareceu (para tooltip e marcação).

## Cálculo de "novas vs. anterior" (definição precisa)

Para a execução `E` com `data_disponibilizacao = D`:
```text
novas(E) = { p | (p, E) ∈ junção
             AND NÃO EXISTE E' tal que
                 (p, E') ∈ junção
                 AND execucoes_servidor(E').data_disponibilizacao = D
                 AND execucoes_servidor(E').started_at < execucoes_servidor(E).started_at }
```
Implementado via subquery `NOT EXISTS` no servidor — não no cliente.

## Fora de escopo
- Kurier.
- Mudanças em `AnaliseDjen.tsx` (browser) e em `usePublicacoesDjenUnificadas`.
- Comparação entre dias diferentes (só consecutivas do mesmo dia).

## Arquivos

- migration: criar tabela `publicacoes_djen_servidor_execucoes` + GRANTs + RLS + índices + backfill.
- editar: `monitor-servidor/engines/paralela.js` (upsert na junção em ambos os caminhos).
- editar: `supabase/functions/executar-djet-pautas-agendado/index.ts` (insert em lote na junção).
- editar: `src/hooks/usePublicacoesDjenServidorUnificadas.ts` (filtros `execucaoId` / `apenasNovasNaExecucao` + execucao_ids por publicação).
- novo: `src/components/djen/ExecucoesDoDiaCard.tsx`.
- editar: `src/pages/AnaliseDjenServidor.tsx` (montar o card + pílula nas linhas).

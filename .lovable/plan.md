## Objetivo

Adicionar uma terceira opção de filtragem por vínculo (Login Kurier × Coordenação), ao lado das já existentes:

- **Captura total** — entrega tudo, sem filtro de termos
- **Só Kurier** — usa apenas monitoramentos marcados como `somente_kurier = true`
- **Termos DJEN** *(NOVA)* — usa apenas monitoramentos comuns (`somente_kurier = false`), ou seja, os "Termos DJEN normais" cadastrados na coordenação

Hoje, quando nenhuma flag está ligada, o motor usa **todos** os monitoramentos (comuns + somente_kurier). A nova flag permite restringir somente aos comuns.

## Comportamento das três flags (mutuamente exclusivas por vínculo)

| Flag ligada      | Monitoramentos considerados                       |
|------------------|---------------------------------------------------|
| Captura total    | Nenhum filtro — entrega tudo                      |
| Só Kurier        | Apenas `somente_kurier = true`                    |
| Termos DJEN      | Apenas `somente_kurier = false`                   |
| (nenhuma)        | Todos (comportamento atual padrão)                |

Regras de UI:
- Só uma das três pode estar ligada por vez no mesmo vínculo
- Ligar "Captura total" desliga "Só Kurier" e "Termos DJEN"
- "Só Kurier" e "Termos DJEN" ficam desabilitados quando "Captura total" estiver ligada

## Mudanças técnicas

### 1. Banco — migration
- Adicionar coluna `somente_djen_only boolean NOT NULL DEFAULT false` em `kurier_credencial_coordenacoes`
- Constraint para impedir combinações inválidas (no máx. 1 entre `captura_total`, `somente_kurier_only`, `somente_djen_only`)

### 2. Edge function `kurier-consultar-publicacoes`
- Carregar set `coordsTermosDjenOnly` (coords com `somente_djen_only = true` neste login), análogo ao `coordsSoKurier`
- Filtro de monitoramentos (linhas 361–364):
  - Se coord ∈ `coordsSoKurier` → `m.somente_kurier === true`
  - Se coord ∈ `coordsTermosDjenOnly` → `m.somente_kurier !== true`
  - Caso contrário → todos
- Excluir essas coords do bloco de `captura_total` (já filtra por `somente_kurier_only=false`; adicionar `somente_djen_only=false`)

### 3. UI `KurierCredenciaisPanel.tsx`
- Carregar nova coluna no `select` dos vínculos
- Adicionar coluna **"Termos DJEN"** no popover, ao lado de "Só Kurier"
- Nova função `toggleTermosDjenOnlyVinculo`
- Lógica de exclusão mútua: ligar uma desliga as outras
- Badge resumo (`X só DJEN`) no botão do popover
- Atualizar texto explicativo no topo do popover descrevendo as 3 opções

### 4. Tipos
- `src/integrations/supabase/types.ts` é regenerado automaticamente após a migration

## Arquivos afetados

- `supabase/migrations/<novo>.sql` (nova migration)
- `supabase/functions/kurier-consultar-publicacoes/index.ts`
- `src/components/configuracoes/KurierCredenciaisPanel.tsx`

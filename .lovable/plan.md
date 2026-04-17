

## Diagnóstico

Existem hoje **duas tabelas com dados sobrepostos**:
- `distribuicoes_tst` (3.592 registros) — origem: importação de planilhas Dr. Renata
- `dados_benner` (1.806 registros) — fonte de verdade, atualizada via Judit

**1.801 processos coincidem** entre as duas. **1.791 distribuições não têm Benner** ainda. A solução é unificar: transformar `dados_benner` na **única tabela mestre** e descontinuar leitura/gravação direta de `distribuicoes_tst` para esses campos.

## Mapeamento de campos

Campos que **já existem em ambas** (Benner prevalece quando preenchido):
`processo`, `dossie`, `relator`, `turma`, `tipo_recurso`, `data_distribuicao`, `recorrente` (= `parte_recorrente`)

Campos **exclusivos de distribuicoes_tst** que precisam ser preservados (migrar para `dados_benner` adicionando colunas):
- `aba_origem`, `equipe`, `reclamante`, `reclamada`
- `relator_favorabilidade`, `turma_favorabilidade` (já existem como `posicao_relator_favoravel/desfavoravel` e `posicao_turma_*` — converter)
- `tipo_recurso_reclamante`, `tipo_recurso_banco`, `materias_recurso_*`, `aparelhamento_*`, `chance_exito_*`
- `honra`, `tema`, `execucao`, `midia_negativa`, `decisao_quarteirizado`, `recurso_terceiros`
- `benner_atualizado`, `transito_julgado`
- `judit_preenchido`, `judit_preenchido_em`, `judit_preenchido_por`

## Plano de unificação

### Etapa 1 — Migração de schema (`dados_benner`)
Adicionar colunas faltantes em `dados_benner`:
```
aba_origem, equipe, reclamante, reclamada,
tipo_recurso_reclamante, materias_recurso_reclamante, aparelhamento_reclamante, chance_exito_reclamante,
tipo_recurso_banco, materias_recurso_banco, aparelhamento_banco, chance_exito_banco,
honra, tema, execucao, midia_negativa, decisao_quarteirizado, recurso_terceiros,
benner_atualizado (boolean), transito_julgado (boolean),
judit_preenchido (boolean), judit_preenchido_em (timestamptz), judit_preenchido_por (uuid),
parte_recorrente_origem (text)  -- para distinguir origem do dado
```

### Etapa 2 — Migração de dados (1.791 distribuições órfãs)
Para cada registro em `distribuicoes_tst` que **não tem** correspondente em `dados_benner`:
- INSERT em `dados_benner` com todos os campos copiados
- `processo` ← `processo_numero`, `recorrente` ← `parte_recorrente`
- Mapear `relator_favorabilidade='Positiva'` → `posicao_relator_favoravel=true` (e idem turma/negativo)
- `status = 'rascunho'`

Para os 1.801 já presentes em ambas:
- UPDATE em `dados_benner` preenchendo apenas campos NULL/vazios em Benner com valores da distribuição (Benner prevalece)
- Copiar os campos exclusivos (`aba_origem`, `equipe`, `honra`, `tema`, etc.) sempre que estiverem vazios em Benner

### Etapa 3 — Refatoração da UI (`/distribuicao-tst`)
- **`useDistribuicoesTst.ts`**: trocar a fonte primária para `dados_benner`. A tela de "Distribuição TST" passa a ler de `dados_benner` filtrando por `tribunal='TST'` (ou pela presença de `aba_origem`).
- Remover o "enriquecimento" via lookup secundário (não é mais necessário — já é uma única tabela).
- Manter os mesmos filtros (processo, dossiê, relator, turma, parte, aba, mês, judit, benner_atualizado).
- A grid e o formulário de edição abrem direto o registro de `dados_benner`.

### Etapa 4 — Ajuste dos pontos de escrita
- **`DistribuicaoTstImport.tsx`** (importação Dr. Renata): passar a fazer upsert direto em `dados_benner` (chave: `processo + dossie`).
- **`ImportarProcessos.tsx`**: idem — gravar em `dados_benner`.
- **`DossieUpdateImport.tsx`**: atualizar dossiê em `dados_benner`.
- **`ProcessoDistribuicoesTab.tsx`** e **`DadosBennerDistribuicaoTab.tsx`**: ler de `dados_benner` filtrando por `processo`.
- **`CargaBennerFromDb.tsx`**: usar `dados_benner` como fonte.
- **Bulk Judit** em `DistribuicaoTst.tsx`: simplificar — só atualiza `dados_benner` (sem mais escrita dupla em `distribuicoes_tst`).
- **`useDadosBenner.ts`**: o filtro `tem_distribuicao` deixa de ter sentido (vira `aba_origem IS NOT NULL`).

### Etapa 5 — Descomissionamento
- Renomear `distribuicoes_tst` → `distribuicoes_tst_legacy` (mantida read-only por 30 dias para auditoria/rollback).
- Após validação do usuário em produção, DROP definitivo via nova migration.

## Considerações técnicas

- A regra **"Benner prevalece quando atualizado pela Judit"** é aplicada na migração inicial (UPDATE só preenche NULLs em Benner) e também no fluxo futuro: a Judit grava direto em `dados_benner`, então não há mais conflito.
- `processo + dossie` continua sendo a chave única funcional (memory: `dados-benner-uniqueness`).
- A página `/distribuicao-tst` continua existindo com o mesmo nome e UX — muda apenas a tabela por trás.
- RLS de `dados_benner` já existe; nenhuma nova política necessária.
- Coordenação `coordenacao_id` em `dados_benner` será preenchida via lookup em `processos` quando possível, senão fica NULL.

## Diagrama do fluxo final

```text
                  ┌──────────────────┐
  Planilha Dr.    │                  │
  Renata ─────────┤  dados_benner    │◄─── Judit API (prevalece)
                  │  (única tabela)  │
  Importação ─────┤                  │◄─── Edição manual (form)
  processos       └────────┬─────────┘
                           │
                ┌──────────┴──────────┐
                │                     │
        /distribuicao-tst       /dados-benner
        (filtro: aba_origem    (todos os
         IS NOT NULL)           registros)
```


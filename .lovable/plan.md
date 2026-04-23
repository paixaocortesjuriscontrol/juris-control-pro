

## Reconciliar números: Planilha vs Sistema (Distribuição TST)

### Divergências reportadas pela análise externa

| Métrica | Sistema | Planilha | Diferença |
|---|---|---|---|
| Processos únicos | 3.591 | 3.604 | -13 |
| Benner = SIM | 414 | 349 | +65 |

### Etapa 1 — Diagnóstico (somente leitura no banco)

Antes de qualquer correção, preciso confirmar no banco o que de fato foi importado. Vou rodar consultas SELECT em `public.dados_benner` (escopo `tribunal = 'TST'` ou `aba_origem IS NOT NULL`):

1. **Total bruto de linhas** vs **processos distintos** vs **(processo, dossie) distintos**.
2. **Distribuição de valores na coluna `analise_quarteirizado`** (campo "Benner") — listar todos os valores normalizados (`upper(btrim(...))`) com contagem para identificar `-----`, `Não localizei`, vazios, etc.
3. **Quantos processos distintos têm pelo menos uma linha com Benner = SIM** (DISTINCT processo) vs **quantas linhas totais têm Benner = SIM** — isso confirma a hipótese do usuário (414 = linhas; 349 = processos distintos).
4. **Processos repetidos** (mesmo `processo` com 2+ linhas em abas diferentes) — listar os top 20 com contagem.
5. **Linhas com `processo` ainda fora do padrão CNJ** (após o cleanup feito antes), para identificar os 13 que talvez estejam faltando ou com formato inválido.

### Etapa 2 — Apresentar conclusão ao usuário

Com base nos resultados, vou produzir um relatório curto explicando:

- Se a diferença de **65** vem realmente de duplicidade entre abas (1 processo em 2 abas, ambas SIM, contado 2x). A regra correta é: **contar processos distintos, não linhas**.
- Se a diferença de **13** vem de:
  - (a) registros descartados na importação (linhas sem CNJ válido), ou
  - (b) processos da planilha que ficaram fora porque o número não bateu com o regex CNJ, ou
  - (c) duplicidade na própria planilha que o sistema deduplicou corretamente.
- Tratamento de valores inválidos na coluna Benner (`-----`, `Não localizei`): hoje qualquer string ≠ vazio fica salva como veio. Vou propor normalizar para `NULL` (ou manter explícito) conforme a preferência.

### Etapa 3 — Plano de correção (a executar APÓS aprovação do diagnóstico)

Dependendo do que o diagnóstico mostrar, as ações possíveis são:

**A) Corrigir contagem de "Benner = SIM" na UI**
- Localizar onde a tela `/distribuicao-tst` calcula o KPI "Benner SIM".
- Ajustar a query/agregação para usar `COUNT(DISTINCT processo)` em vez de `COUNT(*)`, garantindo que processos em múltiplas abas contem 1x.

**B) Normalizar valores inválidos da coluna Benner**
- Migration para converter `analise_quarteirizado` em `NULL` quando o valor for `-----`, `--`, `Não localizei`, vazio ou variações sem significado.
- Atualizar o importador (`DistribuicaoTstImport.tsx`) para fazer essa limpeza no momento da importação.

**C) Recuperar os 13 processos faltantes**
- Se forem processos da planilha rejeitados por formato CNJ inválido: pedir ao usuário para reimportar a planilha original (já com a versão atual do parser corrigido) ou listar os números problemáticos para correção manual.
- Se forem deduplicações legítimas, apenas documentar — não há correção a fazer.

### Detalhes técnicos

- Tabela: `public.dados_benner`, escopo TST identificado por `tribunal = 'TST'` (preferencial) ou `aba_origem IS NOT NULL`.
- Campo "Benner" da planilha → coluna `analise_quarteirizado` (conforme `DistribuicaoTstImport`).
- Identificador único funcional: `(processo, dossie)` (memo `dados-benner-uniqueness`).
- Toda contagem de processos deve usar `COUNT(DISTINCT processo)`; toda contagem de registros importados pode usar `COUNT(*)`. Documentar essa distinção na UI dos KPIs.
- Migration necessária apenas se decidirmos normalizar `analise_quarteirizado` no banco; mudanças de UI não precisam de migration.

### O que será entregue agora (após aprovação)

1. Rodar as 5 consultas SELECT da Etapa 1 e apresentar tabela com os resultados reais.
2. Conclusão objetiva sobre cada divergência (-13 e +65).
3. Lista priorizada das correções (A/B/C) com recomendação do que aplicar.

Nenhuma alteração em dados ou código é feita nesta etapa — só leitura e relatório. As correções vêm em mensagem seguinte, com sua aprovação por item.


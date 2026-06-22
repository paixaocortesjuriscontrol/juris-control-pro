## Diagnóstico

A advogada está certa — depois que a aba "Dados Benner" foi removida e o formulário unificado na aba "Distribuição TST", o botão **Judit** preenche corretamente os campos na tela, mas só grava em **`distribuicoes_tst_legacy`**. A tabela **`dados_benner`** (de onde a planilha Benner / Carga Benner / relatórios leem `relator`, `turma`, `dossie`, `reclamante`, `reclamada`, `recorrente`, `tipo_recurso*`, `situacao_processo`, `processo_baixado`) NÃO recebe mais esses valores.

Hoje:
- `DistribuicaoTstForm.handleSave` só envia ao `onSaveBennerExtra` os campos da lista `BENNER_EXTRA_FIELDS` (apenas análise/risco/julgamento/resultado).
- Os campos preenchidos pela Judit em `apply("relator", …)`, `apply("turma", …)`, etc. ficam apenas no `form` (Distribuição) e nunca chegam ao `dados_benner`.

Caso testado (`0011464-08.2022.5.15.0034 / 07.02.033.0003391925/22`): `dados_benner.relator` e `dados_benner.turma` aparecem populados porque foram gravados antes da unificação. Em processos novos pós-unificação, o Benner fica vazio mesmo a Judit tendo respondido corretamente.

## O que mudar

Em `src/components/distribuicao-tst/DistribuicaoTstForm.tsx`:

1. Adicionar uma constante `BENNER_MIRROR_FIELDS` com os campos que existem nas DUAS tabelas e que devem ser espelhados no `dados_benner` quando alterados na aba unificada:
   - `relator`, `turma`, `dossie`, `reclamante`, `reclamada`, `recorrente`, `parte_recorrente`, `tipo_recurso`, `tipo_recurso_reclamante`, `tipo_recurso_banco`, `tipo_recurso_terceiro`, `situacao_processo`, `processo_baixado`, `data_distribuicao_real`, `data_transito_julgado`.

2. Após a aplicação dos dados da Judit (logo depois do bloco `apply(...)` em ~linha 945), espelhar para `bennerExtra`/`bennerDirtyRef` todo campo da lista que tiver valor — usando o mesmo `setExtra` lógico (marca como dirty para entrar no diff).

3. Estender `set()` (a função genérica de edição manual do form) para que, quando o campo editado pertencer a `BENNER_MIRROR_FIELDS`, também propague para `bennerExtra` + `bennerDirtyRef` — assim edições manuais (não-Judit) também sincronizam.

4. No `buildBennerDiff` (≈ linha 1104), nada muda na estrutura — basta que esses campos passem a entrar em `bennerDirtyRef`. O diff continua enviando apenas o que mudou e o pre-check de `extraLoaded` evita race.

5. Adicionar `BENNER_MIRROR_FIELDS` ao `buildBennerExtra` para que o snapshot inicial inclua esses valores; assim o diff de "voltou ao original" funciona certo.

## Validação

- Abrir um processo TST novo, clicar **Buscar Judit** → conferir que `dados_benner.relator/turma/dossie/tipo_recurso*` ficam preenchidos com o mesmo valor que aparece na tela.
- Editar manualmente um desses campos na aba Distribuição TST e salvar → conferir que o `dados_benner` reflete a alteração.
- Para o processo `0011464-08.2022.5.15.0034`, reclicar Judit e confirmar nos dois `SELECT` (distribuicoes_tst_legacy e dados_benner).

## Detalhes técnicos

- Arquivo único alterado: `src/components/distribuicao-tst/DistribuicaoTstForm.tsx`.
- Sem migração SQL (as colunas já existem em ambas as tabelas).
- Sem mudança no edge function `buscar-judit` — ele já devolve os campos corretos (validado in-loco).
- `handleSaveBennerLocal` em `DistribuicaoTstDetail.tsx` segue intocado: ele recebe um `patch` mais rico, simplesmente atualiza por `id` na `dados_benner`.
- Nenhum efeito na aba "Dados Benner" (já era somente conferência / read-only).

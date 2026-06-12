## Objetivo

Reorganizar a tela de detalhe do processo em **Distribuição TST** para concentrar a edição em um único lugar, transformar a aba **Dados Benner** em conferência e isolar a lista de **Partes do Processo** em sua própria aba.

## Mudanças

### 1) Nova aba "Partes do processo" (última posição)
- Criar `src/components/distribuicao-tst/PartesProcessoTab.tsx`.
- Lê de `partes_processo_benner` pelo `dados_benner_id` (mesma query que hoje está no `DadosBennerForm` em `carregarPartesPersistidas`).
- Renderiza a mesma tabela (Polo / Tipo / Nome / CPF-CNPJ) que existe hoje no rodapé do `DadosBennerForm` (linhas 1318–1365).
- Continua sendo **populada pelo botão Judit** já existente no cabeçalho do detalhe — após o auto-save, a aba recarrega via `useQuery` invalidada por `processoNumero` / `dadosBennerId`.
- Adicionar `<TabsTrigger value="partes">Partes do processo ({n})</TabsTrigger>` no final do `TabsList` em `DistribuicaoTstDetail.tsx`, depois de "Anexos".

### 2) Aba Dados Benner = somente leitura (conferência)
- Remover o bloco "Partes do Processo" do `DadosBennerForm.tsx` (linhas 1318–1365) e o estado/efeitos associados (`partesJudit`, `carregarPartesPersistidas`, persistência em `partes_processo_benner` dentro do `handleSave`).
- Aba Benner passa a renderizar o form com `readOnly`: novo prop `readOnly?: boolean` no `DadosBennerForm` que:
  - Desabilita todos os inputs/selects/switches/textarea (`disabled` + `pointer-events-none` nos containers de tabela editável).
  - Oculta o footer (já existe `hideFooter`) e o botão Salvar.
  - Esconde o botão "Judit" interno (a busca passa a ser feita só pelo botão do cabeçalho do detalhe).
- Em `DistribuicaoTstDetail.tsx` passar `readOnly` para o `DadosBennerForm` da aba `benner`; remover `bennerFormRef.current.handleSave()` da rotina `handleSaveTop()` quando a aba ativa é Benner (não há mais o que salvar ali).

### 3) Unificação Distribuição TST × Dados Benner (inline)
A edição dos campos hoje exclusivos do Benner passa a viver dentro do `DistribuicaoTstForm`. Aba "Dados Benner" continua existindo apenas como conferência (item 2).

Campos **deduplicados** (já existem nas duas — manter um único editor no Distribuição TST que grava em ambas via `handleSaveTop`):
- `processo / dossie / turma / relator / tribunal`
- `data_distribuicao` (Benner) ↔ `data_distribuicao_real / data_distribuicao_planilha` (Distribuição)
- `parte_recorrente` ↔ `recorrente`
- `tipo_recurso_reclamante / tipo_recurso_banco`, `materias_recurso_*`
- `situacao_processo`, `transito_julgado`, `segredo_justica`, `processo_outro_escritorio`, `recurso_terceiro`, `cejusc`

Campos **exclusivos de `dados_benner`** a adicionar inline no `DistribuicaoTstForm` (distribuídos nas seções existentes mais próximas; criar uma seção nova **"Dados Benner"** ao final do form somente para o que sobrar sem grupo natural):
- Status interno Benner: `status`, `situacao_envio_carga`, `benner_atualizado`, `data_envio_benner`
- Datas Benner: `data_publicacao`, `data_intimacao`, `data_protocolo`, `data_baixa`, `data_arquivamento`
- Processo: `processo_baixado`, `honra`, `equipe`, `execucao`, `midia_negativa`
- Posições: `posicao_relator_favoravel/desfavoravel`, `posicao_turma_favoravel/desfavoravel`, `aparelhamento_*`, `chance_exito_*`
- Análise: `tema_irr` (já renomeado), `decisao_quarteirizado`, observações Benner (`observacoes`, `observacoes_internas`)

Regras:
- Cada campo Benner adicionado lê seu valor inicial de `bennerDado` carregado por `DistribuicaoTstDetail`, e seu valor é persistido pelo mesmo `handleSaveTop` que hoje grava `distribuicoes_tst` + `dados_benner` em paralelo.
- Onde o campo já existe nos dois (lista acima), manter **um único input** vinculado ao state do `DistribuicaoTstForm` e propagar para o payload Benner no `handleSaveBennerLocal` (`DistribuicaoTstDetail.tsx`).
- Não duplicar visualmente; o usuário não deve ver o mesmo campo em dois lugares editáveis.

### Resultado visual das abas
`Distribuição TST` | `Centralizadores` | `Dados Benner` (read-only) | `Log Judit` | `Análise Judit` | `Anexos (n)` | `Partes do processo (n)`

## Detalhes técnicos

- Arquivos editados:
  - `src/components/distribuicao-tst/DistribuicaoTstDetail.tsx` — adicionar TabsTrigger/TabsContent "partes"; passar `readOnly` ao `DadosBennerForm`; remover chamada `bennerFormRef.handleSave` quando aba ativa = benner.
  - `src/components/distribuicao-tst/DistribuicaoTstForm.tsx` — adicionar seções/campos Benner inline; estender `DistribuicaoTstFormHandle` para retornar também o payload Benner unificado.
  - `src/components/benner/DadosBennerForm.tsx` — novo prop `readOnly`; remover bloco `partesJudit` (tabela + estado + persistência).
- Arquivo novo:
  - `src/components/distribuicao-tst/PartesProcessoTab.tsx` — useQuery em `partes_processo_benner`, render da tabela.
- Sem migração de banco: tabelas `dados_benner` e `partes_processo_benner` permanecem como estão; apenas a UI é reorganizada.
- `handleSaveTop` continua salvando os dois registros (`distribuicoes_tst` + `dados_benner`) em paralelo — só muda quem origina os valores dos campos compartilhados (agora todos do `DistribuicaoTstForm`).
- O botão **Judit** do cabeçalho do detalhe continua sendo o único ponto que popula partes; após sucesso, invalidar a query de `PartesProcessoTab`.

## Fora de escopo
- Mudanças em `useDadosBenner` / `useDistribuicoesTst` que não sejam estritamente necessárias.
- Alterar importação, cron, ou a tela de lista.
- Outras telas que consomem `DadosBennerForm` (`DadosBennerDetail`) — lá continua editável (sem prop `readOnly`).
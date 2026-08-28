# Dois novos botões de exportação em Processos e Casos

Adicionar, ao lado do botão "Exportar" atual, duas novas exportações Excel nos formatos exatos das planilhas enviadas pela advogada. Cada botão abre um diálogo onde o usuário escolhe o escopo antes de gerar: **usar os filtros da tela**, **usar os processos selecionados** ou **exportar tudo**.

## Botão 1 — "Excel Monitoramento"

Gera a aba `Relatório` com as colunas, nesta ordem exata:

`Nº do Processo | Órgão | Cliente | Data do Andamento | Descrição | Responsáveis | Lido | Habilitado`

- Uma linha por movimentação/andamento dos processos do escopo escolhido.
- Órgão = tribunal do processo; Cliente = cliente vinculado.
- Data do Andamento em DD/MM/AAAA.
- Descrição = texto da movimentação.
- Responsáveis = responsáveis do processo, em maiúsculas, separados por vírgula.
- Lido = Sim/Não conforme o estado de leitura da movimentação; Habilitado = Sim/Não conforme o processo estar em acompanhamento/monitoramento.
- Filtro de período de andamentos no diálogo (padrão: últimos 30 dias), pois um "tudo" sem recorte pode gerar volume muito alto.

## Botão 2 — "Excel Cadastro em Lote"

Gera a aba `Sheet1` com as 38 colunas do modelo padrão, na ordem original:

`Tipo, Assunto, Situação, Responsável, Grupo de trabalho, Marcadores, Pasta Física, Descrição, Justiça, Cidade, Estado, Instância, Órgão (Comarca / Tribunal), Órgão Julgador (Vara / Câmara), Número do processo, Numeração Outro Padrão, Sistema, Área, Fase, Distribuído, Classe – CNJ, Valor da ação, Probabilidade, Risco, Parte Ativa, Envolvimento Ativo, CPF/CNPJ Parte Ativa, Parte Passiva, Envolvimento Passivo, CPF/CNPJ Parte Passiva, Parte Terceira, Envolvimento Terceiro, CPF/CNPJ Terceiro, Nome Parte Cliente, Complemento Órgão Julgador, Código externo, Código externo adicional, Carteira`

- Uma linha por processo do escopo escolhido.
- Cada coluna é preenchida quando o sistema tem o dado (Tipo, Assunto, Situação, Responsável, Pasta Física, Justiça, Cidade/Estado, Instância, Órgão, Órgão Julgador, Número, Valor da ação, Partes ativa/passiva e envolvimentos, CPF/CNPJ, Nome Parte Cliente, Carteira, etc.).
- Colunas sem dado equivalente ficam em branco, preservando a posição — o arquivo continua importável no formato padrão.

## Detalhes técnicos

- Nenhuma alteração de banco. Reaproveita `fetchTodosProcessosFiltrados` (lotes + progresso) já usado pelo Exportar atual e busca partes/responsáveis/movimentações em lotes por `processo_id` (`processos_partes`, `processos_responsaveis`, `movimentacoes`).
- Novos arquivos: `src/lib/exportMonitoramentoExcel.ts` e `src/lib/exportCadastroLoteExcel.ts` com a montagem das linhas; `src/components/processos/ExportarModeloDialog.tsx` para a escolha de escopo/período.
- `src/pages/Processos.tsx`: os três botões de exportação passam a ficar num dropdown ("Exportar") com as opções: Exportação padrão, Excel Monitoramento, Excel Cadastro em Lote — para não alargar a barra de ações.
- Datas em DD/MM/AAAA e truncamento seguro de células acima de 32.000 caracteres, como já feito nas outras exportações.
- Toast de progresso e cancelamento do carregamento em lotes.

# Base PCA - TST - Distribuições: travas contra processos duplicados

## O que a conferência mostrou

- Hoje, antes de cadastrar, a opção confere na base inteira se o número do processo já existe, comparando só os dígitos. Um processo que já está na base **não é cadastrado de novo**, mesmo que o número esteja escrito de outro jeito ou com outro dossiê.
- A última importação pela Base PCA foi em 06/08/2026, às 21h41 (BRT), antes dessa conferência existir. Dela ficaram **220 números de processo repetidos** na base, a maioria cadastrada em agosto.

## Brechas que ainda deixam duplicar

1. **Mesmo processo em duas linhas da planilha, com dossiês diferentes:** as duas linhas são cadastradas, porque a planilha é conferida por processo + dossiê.
2. **Número com menos de 20 dígitos** (incompleto ou digitado errado): passa sem conferir a base.
3. **Fichas arquivadas não são conferidas:** um processo arquivado pode voltar como ficha nova.
4. **O banco não tem trava:** a proteção existe só nesta tela. Se duas pessoas importarem ao mesmo tempo, ou se outra importação cadastrar o mesmo processo, ele duplica.

## O que será feito

1. Conferir a planilha só pelo número do processo. Se o mesmo processo aparecer em duas linhas, entra uma vez e a outra linha vai para a lista de ignorados, com o motivo.
2. Números com menos de 20 dígitos não são cadastrados: vão para a lista de ignorados como "número de processo incompleto".
3. Conferir também as fichas arquivadas. Se o processo estiver arquivado, não cadastra e avisa "já existe como arquivado".
4. Antes de gravar, conferir de novo os números logo antes de salvar cada lote.
5. Os 220 repetidos que já existem **não serão apagados**. Eles continuam no card "Duplicados" da Distribuição TST, para a advogada decidir qual manter, como já é feito hoje.

## Detalhes técnicos

- `src/pages/AdminTstBasePcaDistribuicoes.tsx`, `cadastrarNaoEncontrados`: `chaveLinha` passa a ser só `dig`; filtro `processoDigitos.length === 20`, com motivo "número incompleto" nos demais; nova conferência imediatamente antes de cada `insert`.
- A RPC `dados_benner_processos_existentes` passa a incluir `dados_benner_arquivados` (união por dígitos), marcando a origem como arquivado.
- Não será criado índice único no banco: com 220 repetidos já na base, esse índice falharia até que os repetidos sejam resolvidos.

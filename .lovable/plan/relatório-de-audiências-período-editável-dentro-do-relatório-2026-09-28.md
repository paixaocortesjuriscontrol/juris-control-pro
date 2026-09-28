# Relatório de Audiências: período editável dentro do relatório

## Objetivo
Hoje, ao abrir o Relatório de Audiências pelo Painel de Controle, o período vem travado no filtro do painel ("Período do painel: ..."), sem como mudar. A senhora quer poder alterar o período depois de abrir o relatório.

## O que muda

**Arquivo:** `src/components/audiencias/RelatorioAudienciasDialog.tsx`

1. **Período editável:** quando o relatório abre com o período do painel, em vez do texto fixo aparecem dois campos de data (**De** / **Até**), já preenchidos com o período do painel. Mudar qualquer uma das datas refaz a busca e a exportação Excel na hora.
2. **Alternar para mês/ano:** um botão "Usar mês/ano" troca os campos De/Até pelos seletores de mês e ano (como já existe quando o relatório é aberto sem período). E um botão "Usar período" faz o caminho de volta.
3. **Estado interno:** o período passa a ser estado local do relatório (iniciado com os valores recebidos do painel), em vez de usar direto as props. Assim a tela e a exportação Excel sempre seguem o período escolhido dentro do relatório.
4. **Exportação:** o nome do arquivo Excel e o título continuam refletindo o período efetivo escolhido.

Nada muda no Painel de Controle nem em quem abre o relatório sem período (continua com mês/ano).

## Detalhes técnicos
- Novos estados `dataDe`/`dataAte` (yyyy-MM-dd) e `modoPeriodo` ("painel" | "mesAno"), inicializados das props ao abrir (`useEffect` no `open`).
- `usaPeriodoExterno` passa a ser `modoPeriodo === "painel" && dataDe && dataAte`; a query e o `queryKey` usam `dataDe`/`dataAte`.
- Inputs `<Input type="date">` para De/Até; validação simples: se De > Até, mostra aviso e não busca.
- Verificação: typecheck + build; teste visual não é possível sem login.

# Pautas do Cejusc (outubro/2026): relatório detalhado e explicação da falha

Nada será cadastrado nem alterado no sistema. Esta etapa só faz leituras no banco e gera um Excel.

## 1. Excel detalhado

Arquivo novo: `Relatorio_Pautas_CEJUSC_out2026_DJEN_v2.xlsx`, com 4 abas.

- **Resumo:** uma linha para cada um dos 27 processos da planilha. Mostra a data e o horário da pauta, o reclamante, o advogado gestor, a situação (Capturada / Não capturada), quantas publicações foram encontradas, a data da intimação do Cejusc, a data e o horário que a intimação informa, se essa data bate com a planilha, se a publicação foi lida e em quais coordenações ela está.
- **Capturadas – detalhe:** uma linha por publicação de 15/08/2026 em diante. Traz o processo, o dia da disponibilização, o dia da publicação, o tribunal, o órgão (ex.: CEJUSC-TST), o tipo de comunicação, o ID no DJEN, a origem da captura (monitoramento ou Kurier), a coordenação, se foi lida e por quem, e o **texto completo** da publicação. As publicações que trazem a data da audiência ficam destacadas.
- **Não capturadas:** os 2 processos sem a intimação com a data da audiência:
  - **0000405-29.2014.5.09.0015:** só existe a distribuição ao Cejusc, de 03/09/2026.
  - **0010482-37.2014.5.01.0010:** não há nada.

  Para cada um, a aba diz o que foi procurado (publicações capturadas, descartadas e o índice diário do DJEN), se o processo está cadastrado e em qual coordenação, e se algum termo de monitoramento cobriria esse processo (advogado, OAB ou parte).
- **Descartadas:** as publicações desses processos que o sistema descartou, com o motivo, caso existam (na consulta anterior não apareceu nenhuma).

O arquivo segue o padrão das planilhas do projeto: fonte Arial, cabeçalho escuro, verde para Capturada e vermelho para Não capturada, primeira linha fixa e datas no formato DD/MM/AAAA, no horário de Brasília.

## 2. Explicação da falha

O que já está confirmado no banco:
- 25 das 27 pautas foram capturadas pelo DJEN e estão na coordenação **Dra. Renata Oficial**.
- Todas estão **não lidas**.
- Nenhuma audiência foi criada para elas.

O que **ainda não está confirmado:** o motivo de a equipe não ver essas publicações. Antes de explicar, vou conferir estes pontos e incluir o resultado numa aba **Diagnóstico** e na resposta:

1. Com o mesmo filtro da tela Análise DJEN (coordenação Dra. Renata Oficial e período da disponibilização), a consulta da tela devolve essas publicações? Também vou ver se o filtro de tipo ou origem, ou a opção de esconder repetidas, tira essas publicações da lista.
2. A Tatiana e as outras pessoas que leem as publicações são membros da coordenação Dra. Renata Oficial? Se não forem, a tela recusa a consulta.
3. As publicações caem em datas que a equipe não costuma olhar? Por exemplo, a intimação saiu em setembro e a equipe procurou pelo mês de outubro, que é o mês da audiência.
4. Por que os 2 processos não foram capturados: falta um termo de monitoramento que cubra o processo, ou a publicação não existe no DJEN.

A resposta final vai dizer qual dessas causas foi confirmada, em linguagem simples, sem propor nenhuma correção automática.

## Detalhes técnicos

- Somente leitura, com consultas em `publicacoes_djen`, `publicacoes_djen_descartadas`, `djen_diario_publicacoes`, `publicacoes_djen_leituras`, `monitoramentos_djen`, `membros_coordenacao` e `processos`. Os processos são comparados pelos dígitos (`dedup_processo_digits`).
- A RPC `get_djen_publicacoes_unificadas` será analisada pela definição dela, aplicando os mesmos filtros, sem mudar nada no banco.
- O Excel é gerado com openpyxl em /tmp e salvo em /mnt/documents. O texto completo fica numa célula com quebra de linha, limitado a 32 mil caracteres.

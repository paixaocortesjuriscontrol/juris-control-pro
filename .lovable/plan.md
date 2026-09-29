# Cadastrar processos e prazos da planilha da Emilly (Coordenação GOL)

## O que tem na planilha
- 357 linhas de prazos, com 243 processos diferentes (alguns processos têm mais de um prazo).
- Colunas: Classe (ATOrd/CumSen), Processo, Reclamante, Providência, Prazo (dias), Prazo Fatal, Status, Cliente, UF, Responsável, Observação, Nota, Depósito e Custas (as duas últimas estão vazias).
- Situação: 290 no prazo, 52 vencem hoje (29/09/2026), 15 vencidos.
- Em uma amostra de 30 processos, nenhum está cadastrado no sistema. Antes de gravar, confiro todos os 243.

## Etapa 1 - Processos (tela Processos e Casos)
- Cadastro de cada processo que ainda não existir, na **Coordenação GOL**, área trabalhista, situação ativo.
- Dados da planilha: número, reclamante (polo ativo), cliente (polo passivo; "GOL" vira GOL Linhas Aéreas), UF e classe.
- Processo que já existe: não duplica; só liga os prazos a ele.
- A linha com dois números juntos ("0021375-41... - 0021316-53...") vira dois processos.
- Depois, **preenchimento pela Judit** de cada processo novo (tribunal, vara, partes, valor da causa, movimentações), em lotes pequenos com pausa entre as consultas.

## Etapa 2 - Prazos e tarefas (tela Painel de Controle)
- Um item por linha (357), ligado ao processo, na Coordenação GOL.
- **Audiências** (195 linhas "AUDIÊNCIA ..."): cadastradas como Audiência, com data e hora tiradas do texto ("INSTRUÇÃO 18/11/2026 às 08:40"); sem hora, usa a data do Prazo Fatal.
- **Demais providências** (Manifestação, Defesa, Razões, Perícia, Comprovar, Conferir etc.): cadastradas como Prazo, com data fatal = Prazo Fatal e título = Providência.
- Observação e Nota vão para a descrição do item.
- Situação: todos entram como **Pendente** (os vencidos aparecem como atrasados automaticamente).
- Responsáveis ligados às pessoas da GOL: PHELIPE = Phelipe Sampaio, EMILLY = Emilly Rodrigues, BEATRIZ / BEATRIZ ANJOS = Beatriz Anjos, GABRIELLY = Gabrielly Garcias, MARIA LUIZA = Maria Luiza Vieira, DAIANE = Daiane Souza, FERNANDA = Fernanda Sousa, VICTÓRYA = Victórya Gadelha. "EMILLY/PHELIPE" fica com os dois.
- Todos os nomes da planilha têm correspondência na Coordenação GOL.

## Etapa 3 - Conferência
- Relatório final: processos criados / já existentes, processos com e sem retorno da Judit, audiências e prazos criados, e linhas não importadas com o motivo.

## Pontos de atenção
- A consulta à Judit tem custo por processo (cerca de 243 consultas).
- Não é possível entrar no sistema como a Emilly para testar; a conferência será feita direto nos dados.

## Detalhes técnicos
- Gravação por migração/inserção em lotes de ~50 (evita estouro de tempo), com `fonte_importacao` identificando a planilha para permitir desfazer.
- Busca de existentes por dígitos do número CNJ (`regexp_replace(numero,'\D','','g')`).
- Judit via a função de borda já usada na tela de processos, disparada em lotes com espera entre chamadas.
- Prazos em `tarefas` (tipo prazo, `data_fatal`), audiências no fluxo de audiências já usado pelo Painel; responsáveis em `tarefa_responsaveis`.

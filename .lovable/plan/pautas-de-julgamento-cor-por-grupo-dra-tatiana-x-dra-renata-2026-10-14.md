# Pautas de Julgamento: cor por grupo (Dra. Tatiana x Dra. Renata)

## O que já funciona
- Depois do DJEN, a rotina separa as pautas e liga cada uma à Distribuição TST pelo número do processo. Quando acha a ligação, preenche o dossiê e a equipe.
- A lista já mostra a etiqueta "TST · situação" quando existe uma distribuição.

O pedido da Dra. Lienne procede: a ligação já existe. O que falta é identificar o grupo de cada pauta.

## Regra dos grupos
- **Grupo Dra. Tatiana** (Anna, Tatiana, Daniela e Lienne), em azul:
  - equipes Terceiros, Coligadas e Acordo;
  - processos dos TRT 1, 2, 3, 15 e 17 (Sudeste).
- **Grupo Dra. Renata** (Renata, Taís, Priscila e Paula), em roxo:
  - equipes Corporativas e Complementação de Aposentadoria;
  - processos dos demais TRTs (Outros Estados).
- **Execução, Ações Especiais, Redes, Sudeste e Noroeste Sul** seguem o TRT do processo.
  - Quando a Execução tem a equipe entre parênteses, vale essa equipe. Exemplos: "Execução (Terceiros)" vai para o Grupo Dra. Tatiana; "Execução (Complementação)" vai para o Grupo Dra. Renata.
- O TRT sai do número do processo (posições 15 e 16 do CNJ).
- Pauta sem processo válido ou com "Dossiê não localizado" fica sem grupo, em cinza.

## O que muda na tela
- Uma etiqueta colorida ao lado do dossiê, na lista e no detalhe da pauta: **Grupo Dra. Tatiana** (azul) ou **Grupo Dra. Renata** (roxo).
- Um novo filtro **Grupo**, com as opções Todos, Dra. Tatiana, Dra. Renata e Sem grupo.
- Uma coluna **Grupo** na exportação para Excel.
- O grupo é calculado na hora, pela equipe e pelo número do processo. Nada é gravado no banco, então as pautas antigas também ganham a cor.

## Detalhes técnicos
- Novo `src/lib/pautasGrupo.ts` com `grupoDaPauta(equipe, processo_numero)`. Ele normaliza o texto (sem acentos, em minúsculas) e casa as palavras-chave: terceir, coligad, acordo, corporativ, complementa. O texto entre parênteses tem prioridade. Para os outros casos, usa o TRT do número do processo.
- Cores novas no design (`--grupo-tatiana`, `--grupo-renata`) em `index.css`, usadas por um `Badge`.
- Em `PautasTst.tsx`: etiqueta, estado do filtro (aplicado sobre a lista já carregada) e coluna na exportação. Em `PautasTstForm.tsx`: etiqueta no cabeçalho.
- Nenhuma mudança no banco.

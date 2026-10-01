# Pauta TRT18 (0000541-71.2025.5.18.0053) — corrigir o que ainda está errado

## O que conferi no banco
O texto gravado agora tem o cabeçalho (data 08/10/2026, 9h, Sala Cedro, avisos). Comparando com o Astrea/Kurier, ainda há 5 defeitos:

1. **Falta o topo da pauta**: "PODER JUDICIÁRIO DA UNIÃO / TRIBUNAL REGIONAL DO TRABALHO 18ª REGIÃO / COORDENADORIA DE APOIO À 3ª TURMA JULGADORA" — o recorte começa em "PAUTA DE JULGAMENTO Nº 32/2026" e descarta as linhas de cima.
2. **Rodapé das páginas do PDF misturado no meio do texto**: "Código para aferir autenticidade deste caderno: 241197 4556/2026 … 32" e "Data da Disponibilização: Quarta-feira, 30 de Setembro de 2026" aparecem duas vezes no meio da publicação.
3. **Palavras quebradas**: "QUE S E ENCONTRAM N O NOME D A SALA" e espaços triplos ("EXCETO   NO   CASO").
4. **Pedaço do próximo processo no final**: o texto termina com "4. Processo ROT-", que é o começo do processo seguinte da pauta.
5. **Partes e Advogados vazios** no lado esquerdo da ficha, embora o texto traga Recorrente, Recorrido, Advogados (com OAB) e Perito.

## O que vou fazer
1. **Recorte da pauta** — incluir as linhas institucionais logo acima de "PAUTA DE JULGAMENTO" (Poder Judiciário, Tribunal, Coordenadoria/Secretaria/Turma).
2. **Limpar rodapés do DEJT** — remover as linhas "Código para aferir autenticidade deste caderno…" e "Data da Disponibilização: …" que o PDF repete em cada página.
3. **Espaçamento correto** — montar o texto do PDF usando a posição real das letras, juntando letras soltas da mesma palavra e reduzindo espaços repetidos.
4. **Cada processo no seu lugar** — o trecho de cada processo começa na própria linha "N. Processo ROT-…" e termina antes da linha do processo seguinte; o "4. Processo ROT-" do vizinho deixa de aparecer, e o cabeçalho deixa de levar o "1. Processo…" do primeiro processo para os outros.
5. **Partes e Advogados na ficha** — reconhecer o formato de pauta (Recorrente(s), Recorrido(s), Reclamante, Reclamado, Advogado(s) com "OAB: número/UF", Perito) para preencher as colunas da esquerda.
6. **Reprocessar o DEJT de 30/09/2026** só para as publicações que já existem (sem criar novas), atualizando o texto nas três cópias (principal, servidor e por processo) e mantendo leituras, situações e vínculos. Depois confiro no banco o texto final da 0000541 e das outras corrigidas ontem (TRT2 e TRT9).

## Fora do escopo
- Não cadastro audiências nem tarefas.
- A publicação 0000623-69.2025.5.18.0161 continua como pendência separada, a menos que você peça.

## Detalhes técnicos
- `supabase/functions/buscar-dejt-pautas/index.ts`:
  - `makePautaStreamSegmenter`: ao achar o marcador, recuar até ~8 linhas/800 caracteres enquanto as linhas forem cabeçalho institucional (`PODER JUDICI`, `TRIBUNAL REGIONAL`, `\d+ª REGIÃO`, `COORDENADORIA|SECRETARIA|GABINETE|TURMA`).
  - `iteratePdfPages`: usar `transform[4]`/`width` dos itens do pdfjs para só inserir espaço quando houver distância real; aplicar `stripDejtPageFurniture` (regex por linha para "Código para aferir autenticidade deste caderno" e "Data da Disponibilização: <dia>, <d> de <mês> de <aaaa>") e colapsar `[ \t]{2,}`.
  - `splitBlocoByProcessos`: âncora no início da linha de cada CNJ (padrão `^\s*\d+\.\s*Processo\s+[A-Z]+-?\s*$` na linha anterior ou mesma linha); `headerEnd` = início da linha do primeiro item; fim do item = início da linha do próximo item.
- `src/components/djen/PublicacaoConteudoDjen.tsx` (`extractPartesAndAdvogados`): novo passo para linhas `Recorrente(s) :`, `Recorrido(s) :`, `Agravante/Agravado(s) :`, `Perito(s) :` (partes, com rótulo) e `Advogado(s) : NOME - OAB: 12345/UF` em linha única (advogados), juntando quebras "OAB:\n67252/GO".
- Reprocessamento via `executar-djet-pautas-agendado` com `force` e `reprocessarEdicoes`, restrito a atualização; replicação para `publicacoes_djen_servidor` e `publicacoes_djen_processos` por id / processo+data.
- Atualizar a regra de pautas DEJT em `AGENTS.md` (cabeçalho institucional, sem rodapé de página, limite por linha de item).

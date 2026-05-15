## Objetivo

Reformular o PDF "Gerar PDF por Tribunal" para ser uma **lista prática de termos por tribunal**, pensada para o advogado abrir o comunica.pje, escolher um tribunal (ex: TRT 10) e ver rapidamente quais termos pesquisar.

## Mudanças em `src/utils/gerarRelatorioTermosDjenPorTribunal.ts`

Reescrever o layout do PDF mantendo o agrupamento atual (um termo aparece em cada tribunal em que está configurado), mas com foco no que importa: **o termo a ser buscado**.

### Capa (simplificada)
- Título: "Termos DJEN por Tribunal"
- Coordenação + data
- Filtros aplicados (mantém)
- Pequeno índice clicável: lista das siglas de tribunais com a contagem de termos (TST — 12, TRT1 — 5, TRT10 — 8, …) em colunas compactas. Sem tabela "ativos/inativos" — informação de baixa relevância para o caso de uso.

### Uma seção por tribunal (foco no termo)
Para cada tribunal (página nova, ou várias por página se couber):

- **Cabeçalho grande** com a sigla do tribunal (ex: `TRT 10`) e contagem de termos ativos.
- **Tabela enxuta** com 4 colunas:
  1. **Termo de busca** (coluna larga, em destaque/negrito) — é o que o advogado vai colar no comunica.pje
  2. **Tipo** (Parte / Palavra-chave / Advogado / Processo)
  3. **Descrição** (rótulo interno do monitoramento)
  4. **Refinamentos** (uma única coluna combinando, em linhas curtas dentro da célula):
     - `OR: termo1 | termo2`
     - `Concomitante: ...`
     - `Excluir: ...`
     - `OAB: 12345/DF`
     Só aparecem as linhas que tiverem conteúdo. Se nada existir, mostrar "—".
- **Termos inativos**: por padrão **não entram** nessa lista (advogado não vai usar). Adicionar parâmetro opcional `incluirInativos` (default `false`) e, quando `true`, listá-los em uma sub-seção cinza no fim da página do tribunal com a marca "Inativo".
- Ordenar por **Tipo** (Parte > Advogado > Palavra-chave > Processo) e depois pela própria string do termo, para o advogado escanear visualmente.

### Bucket "Sem tribunal definido"
Mantém uma seção final, mesmo formato, com nota: "Estes termos são aplicados em todos os tribunais."

## Mudanças em `src/pages/TermosDjen.tsx`

- Manter o botão `Gerar PDF por Tribunal` como está.
- Não passar `incluirInativos` (default `false`) — mantém o relatório enxuto. Caso a página tenha o filtro de status "Inativos" explicitamente selecionado, passar `incluirInativos = true` para respeitar a intenção do usuário.

## Detalhes técnicos
- Continuar usando `jsPDF` landscape A4 + `autoTable`.
- Reaproveitar `asArray`, `ordenarTribunais`, `drawHeaderFooter`, `TIPO_LABEL`, paleta de cores.
- Refinamentos como célula multi-linha: usar `\n` entre os rótulos (Or:, Concomitante:, Excluir:, OAB:) e `overflow: "linebreak"` (já configurado).
- Nome do arquivo: manter padrão atual.
- Sem mudanças em hooks, banco ou outros componentes.

## Fora de escopo
- Lógica de busca DJEN/Pautas (já discutida em outras tarefas).
- Edição/criação de monitoramentos.

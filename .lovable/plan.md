# Novo botão "Doc Resumo Intimação (corrigido)" para comparação

## Objetivo
Criar um botão novo na tela Análise DJEN que gera o documento com as regras corrigidas. O botão "Doc Resumo Intimação sem repetição" continua exatamente como está, para as advogadas compararem os dois documentos lado a lado.

## O que o botão novo faz
Usa as mesmas publicações da tela (os mesmos filtros e a mesma seleção) e o mesmo formato do documento atual. Muda só estas regras:

1. **Cejusc não conta como pauta:** as intimações de audiência do Cejusc entram, com o texto completo. Continuam fora só as pautas de julgamento das Turmas: cabeçalho "Pauta de Julgamento" ou "Aditamento à Pauta", ou sessão virtual/presencial.
2. **Lista de distribuição pelo tipo:** a publicação só sai quando o tipo de comunicação é "Lista de distribuição". Não sai mais por citar a expressão no meio do texto.
3. **Repetidas:** usa a mesma regra de hoje, que junta só as cópias da mesma comunicação.
4. **Quadro no começo do documento:** mostra quantas publicações entraram e lista as que saíram, com processo, data e motivo (lista de distribuição, pauta de Turma ou repetida).

## Na tela
- Ao lado do botão atual: botão **"Doc Resumo Intimação (corrigido)"**, com uma marca "Teste" para não confundir.
- Nome do arquivo: `resumo_intimacao_corrigido_djen_AAAA-MM-DD_HHmm.docx`.
- Título no documento: "Resumo de Intimações DJEN — regra corrigida (Cejusc incluído)".

## O que não muda
- Nenhum outro botão: Doc, PDF, Resumos, Excel, Docs TST e Clipping.
- A regra de pauta usada pelos outros documentos.
- Nada no banco de dados.

## Conferência
Depois de pronto, vou simular as regras novas nas publicações do Cejusc da Dra. Renata Oficial (desde 01/09/2026) e informar quantas entram nos dois documentos, o atual e o corrigido. Quando as advogadas aprovarem, a regra corrigida pode substituir a atual em outra etapa.

## Detalhes técnicos
- Em `src/pages/AnaliseDjen.tsx`, criar a função `isPautaTurma(conteudo)`. É uma cópia de `isPautaDeJulgamento` sem o critério `temCejusc`, usada só pelo botão novo.
- Criar `handleGerarDocResumoIntimacaoCorrigido`, com base em `handleGerarDocResumoIntimacao(true)`, em que:
  - o filtro de lista olha só `tipo_comunicacao`;
  - a exclusão de pautas usa `isPautaTurma`;
  - a junção de repetidas usa `dedupPubsSemDestinatarios`, que é a mesma regra de hoje;
  - o texto vem de `extractResumoSemIA`, como hoje (Cejusc continua em texto completo);
  - os itens que saem, com o motivo, vão para um quadro gerado com o mesmo `buildDocHeader` e o mesmo estilo dos parágrafos.
- Criar um novo estado de carregamento `gerandoDocResumoIntimacaoCorrigido`.
- O botão fica no grupo atual, com estilo outline e o selo "Teste".

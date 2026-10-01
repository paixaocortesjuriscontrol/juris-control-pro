# Verificar se os documentos-resumo da Análise DJEN estão perdendo pautas do Cejusc

## Objetivo
Responder com certeza se algum botão de resumo (Doc, PDF Resumo, Doc Resumo Intimação, versões "sem repetição", Excel) deixa de fora as intimações de audiência do Cejusc que o sistema capturou. Primeiro só investigar e entregar um relatório; corrigir só depois que você aprovar.

## Pontos suspeitos já encontrados na tela
1. **"Doc Resumo Intimação sem repetição"** tira de propósito tudo o que reconhece como "pauta de julgamento". A regra procura palavras como "Sessão Presencial/Virtual" e "Pauta de Julgamento". Uma intimação do Cejusc com "sessão presencial/virtual de conciliação" pode cair nesse filtro e sumir do documento.
2. **Filtro de "Lista de Distribuição"** (nos dois Doc Resumo Intimação): remove a publicação se o texto citar "lista de distribuição" em qualquer parte. Isso pode tirar avisos do Cejusc que tragam esse texto.
3. **Regra "sem repetição"** junta publicações do mesmo processo, mesmo dia e mesmo teor. Precisa conferir se duas comunicações diferentes do mesmo processo estão sendo juntadas.
4. **O que entra no documento** é só o que está carregado na tela com os filtros do momento: período, coordenação e lidas/não lidas. Se a equipe gera o documento pelo mês da audiência (outubro), não pega a intimação, que saiu em setembro.

## Como vou verificar (sem alterar nada)
- Pegar as 169 publicações capturadas dos 27 processos da planilha e as 155 do Cejusc da Dra. Renata Oficial desde 01/09/2026.
- Rodar sobre elas exatamente as mesmas regras de cada botão: lista de distribuição, pauta de julgamento e sem repetição.
- Montar uma planilha com uma linha por publicação e uma coluna por botão, marcando "entra" ou "fica de fora" e o motivo. Uma aba de resumo vai mostrar quantas pautas cada botão perde.

## Depois (somente com sua aprovação)
Se algum botão estiver perdendo pautas, a proposta será:
- fazer o filtro de "pauta de julgamento" não pegar audiências e conciliações do Cejusc;
- fazer o filtro de "lista de distribuição" olhar só o tipo ou o título da publicação, não o texto inteiro;
- mostrar um aviso no documento: "X publicações foram retiradas (motivo)".

## Detalhes técnicos
- Regras em `src/pages/AnaliseDjen.tsx`: `handleGerarDocResumoIntimacao` (`ehListaDistribuicao`, `isPautaDeJulgamento`), `handleGerarPdfResumoSemRepeticao` e `handleGerarDocResumoSemRepeticao`; `getPubsParaGerar`, que usa a lista carregada ou a seleção, com limite de 20.000.
- Junção de repetidas: `dedupPubsSemDestinatarios` em `src/utils/djenDedup.ts`, com a chave dígitos + data + docId + assinatura do teor.
- Detector de pauta: `isPautaDeJulgamentoMd` em `src/lib/publicacao-markdown.ts`.
- Simulação em script local (bun) importando as mesmas funções, com dados lidos por consulta só de leitura. Planilha entregue em /mnt/documents.

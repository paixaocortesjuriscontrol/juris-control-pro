# Pauta de Julgamento: Equipe, Advogado Interno e relatório de dados faltantes (Dra. Lienne)

## O que já existe hoje
- Ao criar uma pauta pelo DJEN, o sistema já busca na Distribuição TST os 12 campos pedidos: equipe, advogado interno (os responsáveis da ficha), dossiê, reclamante, reclamada, tipo de recurso, matérias, aparelhamentos, honra e mídia negativa. Só preenche o que estiver vazio.
- Isso roda sozinho, mas só para pautas automáticas do DJEN e só com julgamento nos últimos 15 dias. Pautas importadas por planilha ou cadastradas à mão não são complementadas.
- Entre as 490 pautas a partir de 10/11, faltam: equipe em 266, advogado interno em 274 e dossiê em 185. Destas, 179 não têm ficha na Distribuição TST.

## O que procede e o que vou fazer

### 1. Equipe padronizada
- A lista de equipes da Distribuição TST passa a ter exatamente as 9 opções enviadas, todas com "Jurídico Trabalhista - ...". Entra "Autos de Infração", que não existia.
- Hoje a mesma equipe aparece de dois jeitos, por exemplo "Núcleo Sudeste" (664 fichas) e "Jurídico Trabalhista - Núcleo Sudeste" (994). Vou unificar os nomes nas fichas e nas pautas.
- "Acordo Extrajudicial", que não está na lista dela, fica como está nas fichas que já usam. Só deixa de ser sugerido.
- Na pauta, a equipe vem da Distribuição TST. Se não houver, vai para o relatório de dados faltantes.

### 2. Advogado interno em letras maiúsculas
- Na pauta e no Excel, o advogado interno aparece em MAIÚSCULAS. Ele vem dos responsáveis da ficha na Distribuição TST.
- Se não houver, vai para o relatório de dados faltantes.

### 3. Completar sempre pela Distribuição TST
- O complemento passa a valer para todas as pautas (DJEN, planilha e manual) da semana aberta e das futuras, não só as do DJEN.
- Novo botão "Completar pela Distribuição TST" na tela de Pautas, para rodar na hora.
- Continua sem sobrescrever o que já estiver preenchido. Não busca os itens 23 a 27, como ela pediu.

### 4. Relatório "PAUTA DE JULGAMENTO - dados faltantes"
- Novo botão na tela de Pautas, para a semana ou um período, que gera um Excel para enviar à Dra. Iara.
- Colunas: Data do julgamento, Número do processo, Reclamante, Dossiê, Equipe, Advogado Interno, Centralizador e uma coluna "Falta", com o que não foi encontrado.
- Entra toda pauta sem dossiê, equipe ou advogado interno. O centralizador vem da Distribuição TST, quando houver.
- Mesmo padrão visual das planilhas da Distribuição TST: Calibri, centralizado, alinhado no meio e com quebra de texto.

### 5. Excel da Pauta de Julgamento igual ao modelo enviado
Mesmas colunas e na mesma ordem do modelo. A coluna de modalidade passa a se chamar "MODALIDADE". Todo o texto fica centralizado, alinhado no meio e com quebra automática. Regras por campo:
- **Equipe e advogado interno:** como nos itens 1 e 2.
- **Dossiê:** vem da Distribuição TST. Se não houver, vai para o relatório de faltantes.
- **Número do processo, reclamante e data do julgamento:** vêm da publicação do DJEN.
- **Reclamada:** uma das opções SANTANDER, AYMORÉ, F1RST ou SANTANDER CORRETORA. O sistema reconhece o nome da publicação, por exemplo "BANCO SANTANDER (BRASIL) S.A." vira SANTANDER.
- **Parte recorrente e tipo de recurso:** vêm do DJEN ou da Distribuição TST. Se não houver, ficam "a preencher".
- **Horário:** o da publicação. Se não houver, 00:00.
- **Modalidade:** VIRTUAL, PRESENCIAL ou TELEPRESENCIAL, em maiúsculas.
- **Link de acesso:** em branco, para preencher.
- **Relator:** só o nome do ministro, em MAIÚSCULAS, sem "MINISTRO" e sem ponto final.
- **Matérias, aparelhamentos e honra (itens 14 a 18):** vêm da Distribuição TST. Se não houver, ficam "a preencher".
- **Decisão, Sustentação oral e Desistência do recurso:** em branco. Ao preencher na tela, só aceitam as opções dela, em maiúsculas:
  - Decisão: PROSSEGUIR, RECURSO DA UNIÃO, RECURSO DO RECLAMANTE, RECURSO DEMAIS RECLAMADAS.
  - Sustentação oral: SIM, NÃO, NÃO CABE.
  - Desistência do recurso: SIM, NÃO, -------.
- **Mídia negativa:** vem da Distribuição TST. Se não houver, fica em branco. Opções: SIM, NÃO, A PREENCHER.
- **Itens 23 a 28:** ficam em branco, a preencher. Não são buscados na Distribuição TST. Entra a coluna nova "COMENTÁRIOS ADVOGADO INTERNO RESPONSÁVEL DO BANCO".
- Os mesmos padrões valem na tela de Pautas: modalidade, relator e advogado em maiúsculas, e as opções fixas nas listas.

## Detalhes técnicos
- `DistribuicaoTstForm.tsx`: `EQUIPE_OPTIONS` com os 9 nomes completos. `EquipeUpdateImport` e o import do Admin TST param de remover o prefixo e passam a normalizar para o nome completo. Função compartilhada `normalizarEquipeTst` em `src/lib`, com teste.
- Migração: UPDATE em `dados_benner.equipe` e `pautas_tst.equipe` adicionando o prefixo aos 8 nomes curtos conhecidos. `pauta_preencher_de_benner` normaliza a equipe e aplica `upper()` ao advogado interno. `pautas_reverificar_benner` deixa de filtrar `origem = 'djen_auto'`. Nova RPC `pautas_completar_periodo(de, ate)`.
- `pautasSemanaExport.ts`: cabeçalhos e ordem do modelo, estilo com a mesma rotina das planilhas TST (centralizar, alinhar no meio, quebrar texto) e funções puras de normalização (`normalizarReclamada`, `relatorSoNome`, `horarioPadrao`), com testes. `PautasTstForm`: selects com as opções fixas. Nova coluna `comentarios_advogado_banco` em `pautas_tst`.
- Advogado em maiúsculas. Novo `exportarPautasFaltantes`, que lê o centralizador de `dados_benner` por `dados_benner_id`/processo, com estilo padronizado.

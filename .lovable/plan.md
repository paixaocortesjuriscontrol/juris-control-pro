## Nova aba "PDF Diário" em Comparar DJ Santander

Hoje a tela tem 2 modos: **PDF Resumo** (DOC × PDF do advogado) e **DJEN** (DOC × base). Vou adicionar um terceiro modo **PDF Diário (DJ)** que compara um PDF de diário oficial (ex.: DJDF) contra as publicações DJEN da base, sem usar IA, extraindo processos apenas dos títulos.

### Fluxo da nova aba
1. Usuário seleciona **Coordenação** + **Data de disponibilização** (mesmos selects do modo DJEN).
2. Usuário faz upload de **um ou mais PDFs** do diário oficial.
3. Frontend extrai texto do PDF via `pdfjs-dist` (já em uso) e identifica processos **só nos títulos**.
4. Botão **Buscar publicações DJEN** carrega os processos da base (reusando a lógica atual do modo DJEN).
5. Botão **Comparar** roda `compararListas(processosPdfDiario, processosDjen)` e mostra os 3 grupos: Em Comum / Somente no PDF Diário / Somente no DJEN. Exporta PDF como já faz hoje.

### Regra de extração de títulos (sem IA)

Inspecionei o PDF enviado (DJDF_14.pdf) e os títulos aparecem em 2 formatos consistentes, sempre no início de uma linha curta, antes do bloco de texto da publicação:

```text
Processo 0730933-03.2024.8.07.0001
Nº Processo: 5003480-51.2024.8.21.0016
```

E há ocorrências inline (corpo) que **devem ser ignoradas**, ex.:

```text
VARA DE RELAÇÕES DE CONSUMO ... Processo: 0006...   (no meio de linha longa)
TEXTO:Processo 4005145-90.2026.8.26.0152 distribuido...
SINOP DECISÃO Processo: 1001481-79.2025.8.11.0015. AUTOR: ...
```

Regex de título (linha inteira, ancorada em `^...$` após `normalizarLinha`):

```text
^(N[ºo°]\s*)?Processo\s*[:#-]?\s*<CNJ>\s*$
```

Onde `<CNJ>` é o padrão CNJ já definido em `CNJ_PATTERN` no arquivo. Uso a mesma estratégia de `extrairProcessos` (split por linhas + match por linha) já existente, **sem** ativar `permitirComunicacaoInline`. Isso descarta automaticamente os casos inline acima porque a linha contém texto extra antes/depois do número.

Como `pdfjs-dist` concatena `items` com espaço e `\n` entre páginas, vou também tratar o caso em que o título e o número CNJ ficam em "items" diferentes mas na mesma linha visual: já é coberto porque toda a linha após normalização vira algo como `Nº Processo: 5003480-51.2024.8.21.0016` e bate no regex.

### Mudanças de código (apenas frontend)

Arquivo único: `src/pages/CompararDjSantander.tsx`

1. `mode` passa a ser `"pdf" | "djen" | "pdf-diario"`.
2. `<TabsList>` ganha 3ª aba **PDF Diário (DJ)**.
3. Nova função `extrairProcessosTitulosPdf(texto)`:
   - reusa `normalizarLinha` + split por `\r?\n+`,
   - aplica novo `PROCESSO_TITULO_DJ_REGEX` que aceita prefixo opcional `Nº` antes de `Processo`,
   - retorna lista deduplicada e formatada via `formatarCNJ`.
4. Estados novos: `pdfDiarioFiles: File[]`, `pdfDiarioProcessos: string[]`, handler `handlePdfDiarioUpload` que aceita múltiplos arquivos e concatena os processos extraídos.
5. Reuso de `handleBuscarDjen` / `djenProcessos` / `selectedCoordenacao` / `selectedDate` (mesmos selects renderizados quando `mode === "pdf-diario"`).
6. Em `handleComparar`, novo branch para `pdf-diario` chamando `compararListas(pdfDiarioProcessos, djenProcessos)`.
7. `sourceLabel` / `sourceFileName` ganham caso para `pdf-diario` (ex.: `"PDF Diário - <coord> - <data>"`).
8. Painel de resultados: rótulos das colunas viram **Somente no PDF Diário** / **Somente no DJEN** quando o modo for `pdf-diario`.

### Fora de escopo
- Não altero a aba PDF Resumo nem a aba DJEN.
- Não uso IA (sem chamar `comparar-dj-santander`).
- Sem mudanças em backend, schema, edge functions ou rotas.
- Sem persistência: a comparação roda em memória, igual aos modos atuais.

### Validação
- Testar com `DJDF_14.pdf` enviado: deve extrair os títulos `Processo NNNN...` e `Nº Processo: NNNN...` e ignorar as ocorrências inline tipo `SINOP DECISÃO Processo: ...` e `TEXTO:Processo ...`.
- Conferir contagem total batendo com `grep -E '^(Nº ?)?Processo[ :]' /tmp/DJDF_14.txt | wc -l` após extração.

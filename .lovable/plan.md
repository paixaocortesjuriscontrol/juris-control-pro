## Objetivo

Reescrever o "Gerar DOC Resumo" e "Gerar PDF Resumo" da Análise DJEN para emitir o **mesmo padrão estruturado por processo** que o advogado anterior produzia, mantendo `gpt-4o` (sem trocar modelo) e **sem alterar o Resumo Rápido**.

## Padrão alvo (igual ao `resumo_TST_SANTANDER_29.04.26_1.docx`)

Para cada publicação, um bloco:

```
COMUNICAÇÃO PJE #<numero>
Processo: <numero>
Órgão: <órgão/turma>
Data de disponibilização: <DD/MM/AAAA>
Tipo de Comunicação: <Edital/Intimação/Pauta/...>
Meio: <D/E>
Inteiro teor: Clique aqui   (hyperlink p/ o link da publicação)

Parte(s):
- ...

Advogado(s):
- ...

Conteúdo Integral:
<EXTRATO CIRÚRGICO — não o texto bruto>

Intimado(s) / Citado(s):
- ...
```

Regra do "Conteúdo Integral":
- **Decisão / acórdão**: do marcador `A C Ó R D Ã O` (ou último parágrafo dispositivo do tipo "DOU PROVIMENTO… / Nego provimento… / DENEGO seguimento…") até a assinatura do Relator (ex.: "Brasília, 27 de abril de 2026. Lelio Bentes Corrêa, Ministro Relator"), descartando relatório e voto.
- **Pauta de julgamento**: bloco da sessão (data, modalidade virtual/presencial, início/encerramento, complementos/observações).
- **Edital / Intimação para contrarrazões**: o parágrafo do despacho ("fica intimado o agravado para…") + assinatura do secretário.
- Sem markdown, sem bullets, sem títulos dentro do "Conteúdo Integral" — texto corrido como no original.

## Mudanças

### 1. `supabase/functions/resumir-publicacoes/index.ts`

Adicionar novo modo no body: `modo: "blocoEstruturado"` (mantendo `resumoIndividual`/`apenasTrecho` intactos). Resposta JSON estrita:

```json
{
  "processo": "...",
  "orgao": "...",
  "tipo_comunicacao": "...",
  "meio": "D|E",
  "data_disponibilizacao": "DD/MM/AAAA",
  "partes": ["..."],
  "advogados": ["..."],
  "intimados": ["..."],
  "conteudo_integral": "texto corrido cirúrgico"
}
```

- Modelo: continua `gpt-4o` (`OPENAI_SUMMARY_MODEL`).
- `temperature: 0.1`, `max_tokens: 1500`, `response_format: json_object`, backoff 429.
- Input: `conteudoMd` segmentado por `selecionarBlocoPorProcesso` + metadados conhecidos (processo, link).
- Novo `SYSTEM_PROMPT_BLOCO`: persona advogado sênior, regras estritas de extração (nunca inventar, deduplicar partes/advogados, normalizar OAB), regra do "Conteúdo Integral" descrita acima.
- Pauta usa o mesmo modo (a IA decide o que é o "extrato" da pauta) — mantém o curto‑circuito determinístico apenas como fallback se a IA falhar/devolver < 80 chars no `conteudo_integral`.

### 2. `src/pages/AnaliseDjen.tsx` — só `gerarDocResumo` e `gerarPdfResumo`

- Para cada publicação selecionada, chamar `resumir-publicacoes` com `modo: "blocoEstruturado"` (em vez do texto corrido atual). Manter o throttle de 800ms e o toast de progresso.
- Nova renderização do DOCX (`docx-js`) reproduzindo o layout do original:
  - Heading "COMUNICAÇÃO PJE #..." (negrito, tamanho ~14).
  - Linhas `Label: valor` com label em negrito.
  - "Inteiro teor: Clique aqui" usando `ExternalHyperlink` (link da publicação `link_consulta` / `hashHandler` quando disponível, senão omite o "Clique aqui").
  - Listas com `LevelFormat.BULLET` (sem unicode •) para Parte(s), Advogado(s) e Intimado(s)/Citado(s).
  - "Conteúdo Integral:" seguido de parágrafos do `conteudo_integral` da IA.
  - `PageBreak` entre processos (igual ao original que quebra por bloco).
- PDF: replicar o mesmo bloco no gerador atual (`jsPDF`/`html2canvas` — manter biblioteca já usada por `gerarPdfResumo`).

### 3. `src/lib/publicacao-markdown.ts`

Sem mudança de assinatura. Reaproveita `prepararConteudoParaIA` para enviar Markdown segmentado.

### 4. Resumo Rápido — INTOCADO

`gerarPdfResumoRapido` / `gerarDocResumoRapido` e o modo `apenasTrecho` continuam exatamente como hoje (determinístico).

## Validação

1. Selecionar as mesmas publicações do `publicacoes_djen_2026-05-12_1554.docx` (Santander/TST 29/04/26) e gerar o DOC Resumo: comparar visualmente com `resumo_TST_SANTANDER_29.04.26_1.docx` — cabeçalho, ordem dos campos, "Conteúdo Integral" cirúrgico, lista de Intimados.
2. Testar com pauta TST: confirmar que o "Conteúdo Integral" traz a sessão (data/modalidade/horário) e não o texto corrido inteiro.
3. Testar Resumo Rápido: confirmar que segue idêntico ao comportamento atual (sem regressão).
4. Logs do edge: `[resumir-publicacoes] bloco-estruturado pub=… ai_len=… campos=…`.

## Fora de escopo

- Troca do modelo OpenAI (continua `gpt-4o`).
- Resumo Rápido (Doc e PDF).
- Mudanças em `gerarDocPublicacoes` (relatório bruto).
- Persistência/pgvector.

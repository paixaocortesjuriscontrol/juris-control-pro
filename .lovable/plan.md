## Objetivo

Corrigir resumos de **PAUTA** truncados nos botões "Gerar PDF Resumo" e "Gerar DOC Resumo" da tela Análise DJEN, sem alterar o "Resumo Rápido". A causa raiz é o curto-circuito determinístico (`resumirPautaDeterministico`) que opera sobre HTML colapsado e devolve 1 linha quando o regex não casa o layout daquela pauta. A indexação Markdown atual é construída mas ignorada nesse caminho.

Estratégia escolhida: **Híbrido** — mantém o caminho determinístico rápido/barato, mas faz fallback automático para a IA (gpt-4o, OpenAI direta) com o **bloco do processo já em Markdown segmentado** quando o resultado vier insuficiente.

## Mudanças

### 1. `supabase/functions/resumir-publicacoes/index.ts` — fluxo `resumoIndividual` (linhas ~432-466)

**Adicionar heurística de qualidade** após `resumirPautaDeterministico`:

- Considera "insuficiente" quando o resumo determinístico:
  - Tem menos de 250 caracteres, **ou**
  - Não contém pelo menos 2 dos marcadores essenciais: `Relator`, `AGRAVANTE|RECORRENTE|RECLAMANTE`, `ADVOGADO`, `Intimado`, `Sessão`/`Pauta`, **ou**
  - Não contém o número do processo de interesse.

- Quando insuficiente **E** `isPautaDeJulgamentoMd(conteudoMd)` for verdadeiro:
  - Recorta o bloco do processo via `selecionarBlocoPorProcesso(conteudoMd, processo)` (já existe).
  - Envia esse bloco em Markdown para a IA usando o mesmo `callOpenAI` já presente no fluxo, com **um novo system prompt específico para pauta** (`SYSTEM_PROMPT_PAUTA`):
    - Persona: advogado sênior contencioso (mesma do PDF).
    - Instrução: produzir resumo fluido (sem markdown, sem bullets), com obrigatoriedade de citar quando presentes — Sessão/data, Relator(a), Turma/Órgão, Partes (ativa/passiva), Advogado(s), Intimados, Complemento/observações da pauta.
    - Restrição: usar SOMENTE o bloco fornecido; nunca inventar dados.
  - `max_tokens: 1200`, `temperature: 0.1`, `response_format: json_object` com schema `{ resumo: string, orgao?: string }`.
  - Retry/backoff já existente (`callOpenAI`).

- Se a IA falhar (após retries) **ou** vier vazia, devolve o resumo determinístico original como fallback final (não regredir).

- Logging: `[resumir-publicacoes] pauta-fallback pub=… det_len=… ai_len=… motivo=…` para auditoria.

### 2. `supabase/functions/resumir-publicacoes/index.ts` — fluxo `apenasTrecho` (linhas ~365-371)

**Não alterar.** Resumo Rápido continua usando `extrairTrechoPauta` determinístico, conforme pedido do usuário.

### 3. Front-end (`src/pages/AnaliseDjen.tsx`)

**Não alterar.** O `conteudoMd` já é enviado na chamada do `resumoIndividual` (PDF/DOC) graças à indexação anterior. A nova lógica de fallback consome o `conteudoMd` do payload no backend.

### 4. Memória do projeto

Atualizar `mem://features/monitoring/djen-analysis-pdf-summary-ia` registrando o fluxo híbrido: pauta usa determinístico → fallback IA quando insuficiente; Resumo Rápido permanece 100% determinístico.

## Detalhes técnicos

**Heurística "insuficiente" (pseudo)**:
```text
const det = resumirPautaDeterministico(htmlBruto, processo);
const camposEssenciais = [/Relator/i, /(AGRAVANTE|RECORRENTE|RECLAMANTE|RECLAMADO|AGRAVADO|RECORRIDO)/i,
                          /ADVOGAD[OA]/i, /Intimad/i, /(Sess[aã]o|Pauta)/i];
const acertos = camposEssenciais.filter(re => re.test(det)).length;
const temProc = String(processo).replace(/\D/g,'').length>=15
              && det.replace(/\D/g,'').includes(String(processo).replace(/\D/g,''));
const insuficiente = !det || det.length < 250 || acertos < 2 || !temProc;
```

**Chamada de IA no fallback**:
```text
bloco = selecionarBlocoPorProcesso(conteudoMd, processo)  // já existe, devolve MD do processo
userMsg = `Pauta de Julgamento — Markdown estruturado do bloco do processo.
Processo: ${processo}\nData: ${dataPub}\n\n--- BLOCO ---\n${bloco}\n--- FIM ---\n
Retorne JSON {"resumo":"…","orgao":"…"} com texto fluido sem markdown.`;
respJson = await callOpenAI(SYSTEM_PROMPT_PAUTA, userMsg, 1200);
```

**Fallback final**:
```text
return resumo: respJson?.resumo?.trim() || det || 'Publicação sem conteúdo suficiente para resumir.'
```

## Validação

1. Deploy `resumir-publicacoes`.
2. Em Análise DJEN, selecionar uma pauta TST que hoje vira 1 linha (ex.: "Aditamento à Pauta") e clicar "Gerar PDF Resumo".
3. Confirmar que o PDF traz: relator, partes, advogados, intimados e complemento — texto fluido.
4. Selecionar uma decisão comum (não-pauta) e confirmar que o comportamento atual permanece (sem regressão).
5. Selecionar uma pauta com layout "bem-comportado" (Quinta Turma típica) e confirmar que o caminho determinístico ainda é usado (logs sem `pauta-fallback`).
6. Conferir Edge Function logs: `pauta-fallback pub=… det_len=… ai_len=…`.
7. Resumo Rápido: testar mesma pauta, confirmar texto inalterado (caminho determinístico).

## Fora de escopo

- Mudar provider/modelo de IA (segue OpenAI gpt-4o direto).
- Alterar Resumo Rápido (`apenasTrecho`).
- Persistir resumos em Postgres / pgvector.
- Mudanças de UI.
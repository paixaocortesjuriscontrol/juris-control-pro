
# Avaliação do prompt + viabilidade no botão "Ler com IA & preencher"

## Parte 1 — Avaliação do prompt proposto

### Pontos fortes (aplicar como está)

1. **Regra de ouro explícita ("NUNCA invente, retorne null")** — corrige o problema #1 do edge function atual (`preencher-form-ia-anexos/index.ts:20`), onde a única defesa é "Não invente".
2. **Schema fechado por enums** (`"S"|"N"`, modalidade, sustentação, tribunal) — elimina formatos errados ("Sim", "Tribunal Superior do Trabalho") sem precisar de pós-processamento.
3. **Separação Judit vs PDF** — campos A,B,C,D,E,F,AA marcados como "copiar literalmente". Hoje o LLM reescreve esses campos mesmo quando a Judit já trouxe.
4. **Resultado R/S/T/U podendo coexistir** — captura provimento parcial que o prompt atual perde.
5. **`_evidencia` por campo** + `_confianca` + `_alertas` + `_campos_pendentes_revisao_humana` — viabiliza UI de revisão e auditoria. Hoje não temos nada disso.
6. **Documentos pré-rotulados e ordenados cronologicamente** — resolve "mistura de fontes" mencionada no diagnóstico.
7. **Regras X/Y por caso (A/B/C)** — bem desenhadas, mas devem migrar para validador (camada 4), não LLM, conforme o próprio plano sugere.
8. **2 exemplos few-shot** (sem julgamento + provimento parcial) — bons; cobrem os casos limite.

### Pontos a ajustar / riscos

1. **`AA_recorrente` literal "BANCO SANTANDER (BRASIL) S.A."** — frágil. Bases reais trazem variações ("Banco Santander S/A", "BANCO SANTANDER BRASIL S.A.", razão social antiga). Deve ser **normalizada por código** (regex/CNPJ), não por string match no prompt.
2. **`Q_sustentacao_oral = "Não cabe"` para AIRR/AgR** — regra do RITST é mais nuançada (cabe em AIRR-E, AgR em recurso ordinário rescisório, etc.). Como heurística inicial está OK, mas prompt deve ressalvar "se em dúvida, retornar null", não chutar "Não cabe".
3. **`_confianca` subjetiva** — `gpt-4o-mini` tende a marcar tudo como "alta". Sugestão: forçar "baixa" automaticamente quando `_evidencia.trecho` < 30 chars ou ausente (regra programática, não confiar no LLM).
4. **Output como JSON puro (sem tool_call)** — o edge function atual já usa `tool_call` com `parameters` schema, que é mais robusto contra "vazamento" de markdown. Recomendo manter `tool_call` e converter o schema do prompt para o formato `parameters` da OpenAI.
5. **Modelo Sonnet 4.6 sugerido** — viola memory `ai-provider-standard` (OpenAI direto). Equivalente: `gpt-4o` para extração e `gpt-4o-mini` para classificação.
6. **Tamanho do prompt** — ~6 KB de system prompt + 90 KB de PDFs por chamada. Sem prompt caching no OpenAI direto (somente Anthropic tem nativo), o custo escala. Mitigar com classificador (camada 2) que descarta `outro`.
7. **Campos G/H/I/AB-AH** — o prompt manda retornar `null` mas adicioná-los a `_campos_pendentes_revisao_humana`. Isso é redundante: melhor o validador (camada 4) injetar todos automaticamente sem desperdiçar tokens no LLM.
8. **Falta tratamento OCR / PDF imagem** — prompt assume texto extraído. Hoje `extrairTextoPdfNoNavegador` (`AnexosJuditTab.tsx:121`) usa `pdf.js` puro, sem OCR. PDFs escaneados retornam string vazia e o LLM aluciná. Antes do prompt, validar que cada documento tem texto mínimo (>200 chars/página média) e marcar `tipo: "outro"` + alerta caso contrário.
9. **`AA_recorrente` é obrigatório no schema** mas se a Judit não confirmar (memory `judit-resource-attribution-rules`), pode vir vazio. Schema deve permitir `string | null` e validador trata.

### Veredicto do prompt
**80% pronto, 20% precisa ajuste.** Adotar a estrutura geral (regra de ouro, enums, evidência, alertas, exemplos), mas:
- Converter schema para tool_call OpenAI.
- Tirar regras determinísticas (X/Y, K, normalização de Recorrente, "Não cabe") do LLM e mover para validador.
- Ajustar `_confianca` via regra programática.
- Adicionar pré-check de OCR.

## Parte 2 — Viabilidade no botão atual

Diagnóstico do código atual (`AnexosJuditTab.tsx` + `preencher-form-ia-anexos/index.ts`):

| Aspecto | Hoje | Plano | Gap |
|---|---|---|---|
| Hidratação Judit | Não passa `dados_judit` para o LLM | Camada 1 determinística | Pequeno — adicionar payload |
| Schema | tool_call genérico, sem enums | tool_call com enums fechados | Médio — reescrever schema |
| Classificação de PDFs | Inexistente | Camada 2 com Haiku/`gpt-4o-mini` | Grande — nova edge function ou step |
| Validador | Inexistente | Camada 4 com 8 checks | Médio — novo `validar.ts` |
| UI de revisão | Toast só | Badges nos campos pendentes | Médio — UI nos forms |
| Schema de campos A–AH | Não existe — form usa `relator`/`turma`/etc. | 34 colunas Santander | Grande — depende do escopo final |

### Roadmap recomendado (ordem do PDF, ajustado)

**Fase 1 (alto impacto / baixo esforço): Hidratação Judit + schema fechado**
- `AnexosJuditTab.tsx`: montar `dados_judit` (dossie, tribunal, tipo_recurso, data_distribuicao, turma, relator, recorrentes) a partir do form atual e passar no body.
- `preencher-form-ia-anexos/index.ts`:
  - Receber `dados_judit` e passar como contexto (não pedir ao LLM).
  - Substituir `SYSTEM_PROMPT` pelo texto da seção 4, adaptado.
  - Reescrever `tool.function.parameters` com enums fechados e campos `_evidencia`, `_alertas`, `_campos_pendentes_revisao_humana`.
  - Manter `gpt-4o-mini` na primeira iteração; subir para `gpt-4o` só se qualidade não bater.

**Fase 2 (qualidade): Validador programático**
- Novo `supabase/functions/preencher-form-ia-anexos/validar.ts` com os 8 checks da seção 5 + normalização de Recorrente (regex Santander) + injeção de campos G/H/I/AB-AH em pendentes.
- Resposta passa a ter `{ campos, pendentes, alertas, evidencias }`.
- `AnexosJuditTab.tsx`: badge âmbar nos campos pendentes (paralelo ao verde da Judit).

**Fase 3 (custo): Classificador de PDFs**
- Nova edge function `classificar-pecas-ia` ou step extra antes da extração: rotula cada `documento_id` em 7 tipos.
- Salva em coluna nova `documentos.tipo_peca_ia` (migration leve).
- Camada 3 recebe só documentos relevantes (acórdão, decisão, pauta, intimação, despacho, baixa). Reduz tokens em 50–70%.
- Inclui pré-check OCR (descarta páginas com <200 chars).

**Fase 4 (entrega final): Exportação Santander A–AH**
- Estender `CargaBennerFromDb.tsx` ou criar `gerarCargaSantander.ts` para emitir as 34 colunas.
- Só depois das fases 1–3 estarem estáveis.

### Memory a respeitar
- `ai-provider-standard` — OpenAI direto, sem Lovable Gateway, default `gpt-4o-mini`.
- `judit-resource-attribution-rules` — `tipo_recurso`/`recorrente` só vêm da Judit confirmada; vazio sobrescreve.
- `inline-editing-strategy` — sem botão "Edit"; preenchimento é direto no form.
- `cache-invalidation-pattern` — `await invalidateQueries` antes de fechar.
- `dados-benner-naming-convention` — coluna `processo`, nunca `contrato`.

### Recomendação final
**Sim, viável e altamente aderente.** Começar pela **Fase 1 + Fase 2 juntas** elimina ~80% das alucinações sem migration, sem custo extra de IA e sem mudar UX. Fases 3 e 4 ficam para depois de validar com 5–10 processos reais.

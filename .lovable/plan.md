## Problema

A função `isPautaDeJulgamento` em `src/pages/AnaliseDjen.tsx` (linha 1429) classifica como pauta qualquer publicação que contenha a expressão "Pauta de Julgamento" em qualquer ponto do texto. Acórdãos do TST frequentemente citam essa expressão dentro do dispositivo (ex.: "determinar a reautuação do processo e a publicação de nova pauta de julgamento (RITST, art. 122)"), e por isso são tratados como pauta — o resumo sai errado.

O mesmo critério frouxo existe no backend em `supabase/functions/resumir-publicacoes/markdown.ts` (`isPautaDeJulgamentoMd`), usado pela rota híbrida de IA.

## Solução

Endurecer a detecção exigindo marcadores estruturais de pauta e descartando claramente quando o texto for um acórdão/decisão.

### Regras novas para `isPautaDeJulgamento` (frontend) e `isPautaDeJulgamentoMd` (backend)

1. **Exclusão prioritária (acórdão / decisão monocrática):** se o conteúdo limpo contém qualquer um dos marcadores abaixo, NÃO é pauta, mesmo que apareça "Pauta de Julgamento" no meio do texto:
   - `A\s*C\s*Ó\s*R\s*D\s*Ã\s*O` (cabeçalho "A C Ó R D Ã O" típico de acórdão TST)
   - `\bACORDAM\s+os\s+Ministros` / `\bACORDAM\s+as?\s+(Turma|Desembargadora|Desembargadores)`
   - `\bISTO\s+POSTO\b`
   - `Embargos\s+de\s+declara[çc][ãa]o\s+acolhidos`
   - `\bRelator[(:]` seguido de voto (`V\s*O\s*T\s*O`)
   - `\bDECIS[ÃA]O\s+MONOCR[ÁA]TICA\b`

2. **Confirmação positiva de pauta** (precisa de pelo menos UMA destas):
   - Cabeçalho explícito: `^(?:\s*)?PAUTA\s+DE\s+JULGAMENTO` ou `Aditamento\s+[àa]\s+Pauta` aparecendo nos primeiros ~500 caracteres limpos do conteúdo, OU
   - Combinação atual `Sessão (Ordinária|Extraordinária|Virtual|Presencial)` + `sessão (virtual|presencial)` (mantida), OU
   - `\bCEJUSC\b` (mantida — audiências de conciliação)

3. Remover o match isolado de "Pauta de Julgamento" em qualquer posição do texto (causa do falso positivo).

### Arquivos a alterar

- `src/pages/AnaliseDjen.tsx` — substituir o corpo de `isPautaDeJulgamento` (linhas 1428-1436) pelas regras acima. Não tocar em `extractTrechoPauta`, `resumirTrechoPauta` nem nos fluxos de PDF/DOC — só a detecção precisa mudar.
- `supabase/functions/resumir-publicacoes/markdown.ts` — espelhar o ajuste em `isPautaDeJulgamentoMd` (mantém os dois lados em sincronia, conforme o cabeçalho do arquivo já alerta).

### Validação

- Caso reportado (processo `0000986-45.2023.5.13.0006`, acórdão de EDCiv-RR da 5ª Turma com "publicação de nova pauta de julgamento" no dispositivo): passa a ser tratado como publicação normal — o resumo seguirá a rota padrão (IA / trecho final), não a rota de pauta.
- Pautas reais (cabeçalho "PAUTA DE JULGAMENTO" no topo, "Aditamento à Pauta", "Sessão Virtual"/"Sessão Presencial", CEJUSC) continuam sendo detectadas.

### Memória

Atualizar `mem://features/monitoring/djen-analysis-pdf-summary-ia.md` (ou criar um arquivo dedicado) registrando que a detecção de pauta agora exige marcador estrutural no topo e descarta automaticamente acórdãos, para não regredir.

## Fora de escopo

- Mudanças no comportamento do resumo de pautas reais (texto determinístico, fallback IA, formato do PDF/DOC).
- Alterações na classificação `TEMAS_IRR / PAUTA / CEJUSC / DISTRIBUICOES / PRAZOS` da IA — é outro fluxo.

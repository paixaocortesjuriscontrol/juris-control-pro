# Memory: features/monitoring/djen-analysis-pdf-summary-ia
Updated: 22/06/2026

'Gerar PDF Resumo' e 'Gerar DOC Resumo' (Análise DJEN) usam OpenAI direto (`gpt-4o`, env `OPENAI_SUMMARY_MODEL`). Persona: advogado sênior de contencioso. Texto corrido, sem markdown/bullets/títulos, começando direto pelo conteúdo. Foca em: dispositivo, ementa/tese, resultado, prazos, providências, certidões, audiências. Cada publicação é resumida individualmente para evitar timeout, com progresso via toast.

PAUTAS DE JULGAMENTO usam estratégia HÍBRIDA no edge `resumir-publicacoes` (modo `resumoIndividual`):
1. Tenta `resumirPautaDeterministico` (regex local sobre HTML, rápido/sem custo).
2. Se o resultado for insuficiente — < 250 chars, OU < 2 dos campos essenciais (Relator / parte / advogado / intimado / sessão), OU sem o número do processo — faz fallback para IA com o bloco do processo já em Markdown segmentado (`selecionarBlocoPorProcesso(conteudoMd, processo)`), system prompt específico de pauta (`SYSTEM_PROMPT_PAUTA`), `max_tokens: 1200`, `response_format: json_object`.
3. Se a IA falhar/devolver < 120 chars, retorna o determinístico (não regredir).

Resumo Rápido (`apenasTrecho`) NÃO usa fallback de IA — segue 100% determinístico via `extrairTrechoPauta`.

Pré-indexação Markdown: o front (`AnaliseDjen.tsx`) envia `conteudoMd` no body via `prepararConteudoParaIA`; o backend recalcula via `htmlParaMarkdown` se ausente. Logging do fallback: `[resumir-publicacoes] pauta-fallback pub=… det_len=… ai_len=… acertos=… temProc=…`.

Detecção de Pauta (`isPautaDeJulgamento` no front e `isPautaDeJulgamentoMd` no backend): NÃO basta a frase "Pauta de Julgamento" aparecer no texto — acórdãos do TST citam "publicação de nova pauta de julgamento (RITST, art. 122)" no dispositivo. Regras:
1. Exclusão prioritária (retorna false mesmo com a frase): "A C Ó R D Ã O", "ACORDAM os Ministros/as Turma/Desembargador(es)", "ISTO POSTO", "Embargos de declaração acolhidos", "DECISÃO MONOCRÁTICA", ou "Relator:/(" + "V O T O".
2. Positivo só se: cabeçalho "PAUTA DE JULGAMENTO" / "Aditamento à Pauta" nos primeiros 500 chars limpos, OU "Sessão (Ordinária|Extraordinária|Virtual|Presencial)" + "sessão (virtual|presencial)", OU "CEJUSC".
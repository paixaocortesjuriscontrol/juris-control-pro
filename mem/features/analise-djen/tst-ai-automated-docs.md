---
name: Docs TST classification rules
description: Botão "Docs TST" no Análise DJEN classifica publicações por palavras-chave (sem IA) em 5 categorias TEMAS_IRR/PAUTA/CEJUSC/DISTRIBUIÇÕES/PRAZOS
type: feature
---
Botão "Docs TST" (Análise DJEN) gera até 5 `.docx` classificando publicações filtradas por **regras determinísticas case-insensitive** (sem IA, sem Anthropic, sem Edge Function). Primeira regra que casa vence:

1. **TEMAS_IRR** → (`sobrestamento`|`sobrestar`) E (`tema XX`|`tema vinculante`|`IncJulgRREmbRep`). Badge `Tema XX` quando regex captura.
2. **PAUTA** → contém `pauta de julgamento` E NÃO contém marcadores de acórdão (`ACORDAM`, `A C Ó R D Ã O` espaçado, `EMENTA`, `VOTO`). Evita falso positivo com acórdãos TST que trazem cabeçalho "PAUTA DE JULGAMENTO (ÍNTEGRA)".
3. **CEJUSC** → contém `plataforma zoom`.
4. **DISTRIBUIÇÕES** → contém `lista de distribuição`.
5. **PRAZOS** (default) → restante. Conteúdo integral (sem corte).

Edge Function `classificar-publicacoes-tst` ficou órfã (pode ser removida em limpeza futura).

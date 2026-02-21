# Memory: infrastructure/monitoring/djen-certidao-advogados-v1
Updated: 21/02/2026

## Busca de Advogados via Certidão HTML

O sistema agora busca a certidão HTML (`/comunicacao/{id}/certidao`) para cada publicação nova capturada, extraindo advogados reais com OAB.

### Fluxo:
1. Engine captura publicações via API de listagem (`/comunicacao`)
2. Para cada publicação NOVA (não duplicada), busca certidão via `fetchCertidaoAdvogados(hash)` — usa o campo `hash` alfanumérico, NÃO o `id` numérico (que retorna 422 "Hash inválido")
3. Faz parse do HTML com DOMParser para extrair advogados (OAB) e partes (papéis)
4. Prioridade: certidão > metadata API > regex do conteúdo
5. Salva em `advogados_json` com formato `["NOME - OAB UF-NUMERO"]`

### Arquivos:
- `src/utils/pjeComunicaClient.ts`: `fetchCertidaoAdvogados()` e `parseCertidaoHtml()`
- `src/hooks/useDjenTermosEngine.ts`: integração no fluxo de salvamento (linha ~1203)
- `src/components/djen/PublicacaoConteudoDjen.tsx`: exibição no sidebar esquerdo

### Rate Limiting:
- 500ms de delay entre certidões
- Timeout de 15s por certidão
- Fallback silencioso se falhar (usa extractAdvogadosFromMeta)

### Nota:
Publicações JÁ salvas antes desta mudança continuam com `advogados_json` contendo nomes de partes. Apenas novas capturas terão advogados reais.

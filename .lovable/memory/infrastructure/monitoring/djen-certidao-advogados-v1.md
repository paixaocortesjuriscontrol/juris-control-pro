# Memory: infrastructure/monitoring/djen-certidao-advogados-v1
Updated: 21/02/2026

## Busca de Advogados via Certidão PDF

O sistema agora busca a certidão (`/comunicacao/{hash}/certidao`) para cada publicação nova capturada, extraindo advogados reais com OAB.

### Fluxo:
1. Engine captura publicações via API de listagem (`/comunicacao`)
2. Para cada publicação NOVA (não duplicada), busca certidão via `fetchCertidaoAdvogados(hash)` — usa o campo `hash` alfanumérico, NÃO o `id` numérico (que retorna 422 "Hash inválido")
3. O endpoint retorna **PDF** (Content-Type: application/pdf), NÃO HTML
4. Usa `pdfjs-dist` para extrair texto do PDF, depois aplica regex para OAB
5. Prioridade: certidão > metadata API > regex do conteúdo
6. Salva em `advogados_json` com formato `["NOME - OAB UF-NUMERO"]`

### Arquivos:
- `src/utils/pjeComunicaClient.ts`: `fetchCertidaoAdvogados()` e `parseCertidaoHtml()`
- `src/hooks/useDjenTermosEngine.ts`: integração no fluxo de salvamento
- `src/components/djen/PublicacaoConteudoDjen.tsx`: exibição no sidebar esquerdo

### Rate Limiting:
- 500ms de delay entre certidões
- Timeout de 15s por certidão
- Fallback silencioso se falhar (usa extractAdvogadosFromMeta)

### Nota:
Publicações JÁ salvas antes desta mudança continuam com `advogados_json` contendo nomes de partes. Apenas novas capturas terão advogados reais.

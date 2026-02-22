# Memory: infrastructure/monitoring/djen-destinatarios-advogados-v4
Updated: 22/02/2026

## Separação de Destinatários e Advogados

O sistema diferencia entre **destinatários** (partes notificadas da API) e **advogados** (profissionais extraídos da API + texto).

### Problema resolvido (v4):
A API PJE Comunica retorna advogados estruturados no campo **`destinatarioadvogados`** da resposta de listagem (`/comunicacao`). Cada item contém `{ advogado: { nome, numero_oab, uf_oab } }`. Esse campo estava sendo ignorado pelo sistema.

### Solução: extração da API + fallback regex
Advogados são capturados de 3 fontes, com deduplicação:
1. **API `destinatarioadvogados[]`**: fonte primária com dados estruturados (nome, OAB, UF)
2. **Regex do texto**: `NOME - OAB UF-12345` (com OAB)
3. **Regex do texto**: `ADVOGADO: NOME` ou `ADV.: NOME` (sem OAB)

### Campos no banco (`publicacoes_djen`):
- `partes_json`: Destinatários da API PJE Comunica. São partes do processo (ex: "BANCO SANTANDER S.A.").
- `advogados_json`: Advogados extraídos da API (`destinatarioadvogados`) + regex do texto.

### Fluxo:
1. `extractDestinatariosFromMeta(pub)` → destinatários da API → `partes_json`
2. `extractAdvogadosFromApiMeta(pub)` → advogados da API (inclui `destinatarioadvogados[]`) → base de `advogados_json`
3. `extrairPartesAdvogadosDoConteudo(conteudo)` → advogados do texto (regex) → merge com API
4. Merge: API + texto, sem duplicatas

### Arquivos alterados (v4):
- `src/utils/djenLikeConteudo.ts`: `extractAdvogadosFromApiMeta` agora processa `pub.destinatarioadvogados[]`
- `supabase/functions/monitorar-djen/utils.ts`: `extrairAdvogadosDeRawJson` agora processa `obj.destinatarioadvogados[]`
- `supabase/functions/buscar-djen/index.ts`: passa `destinatarioadvogados` nos dados mapeados

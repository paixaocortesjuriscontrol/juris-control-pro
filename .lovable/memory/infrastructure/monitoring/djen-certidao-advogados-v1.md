# Memory: infrastructure/monitoring/djen-destinatarios-advogados-v3
Updated: 22/02/2026

## Separação de Destinatários e Advogados

O sistema diferencia entre **destinatários** (partes notificadas da API) e **advogados** (profissionais extraídos do texto).

### Problema resolvido (v3):
A API PJE Comunica NÃO retorna advogados estruturados no endpoint de listagem. O portal comunica.pje.jus.br mostra advogados no "lado esquerdo" porque provavelmente usa um endpoint de detalhe (`/certidao/{hash}`), que não temos acesso.

### Solução: extração do texto
Advogados são extraídos do TEXTO da publicação via regex em dois formatos:
1. **Com OAB**: `NOME - OAB UF-12345` → capturado com número OAB
2. **Sem OAB**: `ADVOGADO: NOME` ou `ADV.: NOME` → capturado pelo padrão "ADVOGADO:" seguido de nome

### Campos no banco (`publicacoes_djen`):
- `partes_json`: Destinatários da API PJE Comunica. São partes do processo (ex: "BANCO SANTANDER S.A.").
- `advogados_json`: Advogados extraídos do TEXTO da publicação (formato "NOME - OAB UF-NUMERO" ou apenas "NOME").

### Fluxo:
1. `extractDestinatariosFromMeta(pub)` → destinatários da API → `partes_json`
2. `extrairPartesAdvogadosDoConteudo(conteudo)` → advogados do texto (OAB patterns + "ADVOGADO:" pattern) → `advogados_json`
3. `extractAdvogadosFromApiMeta(pub)` → advogados da API (geralmente vazio, mas mantido como fallback)
4. Merge: API + texto, sem duplicatas

### Backfill:
- Backfill SQL executado para extrair "ADVOGADO: NOME" de publicações existentes
- Resultado: 385 publicações com advogados (de 2658 total)
- Publicações que não mencionam advogados no texto NÃO terão advogados no sidebar (limitação da API)

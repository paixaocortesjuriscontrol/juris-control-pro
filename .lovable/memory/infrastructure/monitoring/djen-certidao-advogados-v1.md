# Memory: infrastructure/monitoring/djen-destinatarios-advogados-v2
Updated: 22/02/2026

## Separação de Destinatários e Advogados

O sistema agora diferencia corretamente entre **destinatários** (partes notificadas pela API) e **advogados** (profissionais com OAB extraídos do texto).

### Campos no banco (`publicacoes_djen`):
- `partes_json`: Destinatários da API PJE Comunica (`pub.destinatarios`, `pub.destinatarioNome`). São as partes do processo (ex: "BANCO SANTANDER S.A."), NÃO advogados.
- `advogados_json`: Advogados reais extraídos do texto da publicação via regex (formato "NOME - OAB UF-NUMERO").

### Fluxo:
1. Engine captura publicações via API (`buscarPjeComunicaPaginado`)
2. `extractDestinatariosFromMeta(pub)` extrai nomes de destinatários da API → salva em `partes_json`
3. `extrairPartesAdvogadosDoConteudo(conteudo)` extrai advogados com OAB do texto → salva em `advogados_json`
4. `buildDjenLikeConteudo` injeta "Destinatário(s):" (não mais "Advogados:") no conteúdo formatado

### Display (PublicacaoConteudoDjen.tsx):
- Sidebar esquerda mostra "Destinatário(s)" (de `partes_json`) e "Advogado(s)" (de `advogados_json`)
- Replica exatamente o layout do portal comunica.pje.jus.br

### Arquivos alterados:
- `src/utils/djenLikeConteudo.ts`: `extractAdvogadosFromMeta` → `extractDestinatariosFromMeta`
- `src/hooks/useDjenTermosEngine.ts`: salva destinatários em `partes_json`, advogados em `advogados_json`
- `src/components/djen/PublicacaoConteudoDjen.tsx`: display + limpeza de logs de debug

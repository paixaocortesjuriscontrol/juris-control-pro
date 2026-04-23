

# Engine de Busca STF Digital — consulta direta

## Objetivo
Replicar o "DJEN Termos" para o portal `digital.stf.jus.br/publico/publicacoes`, fazendo consulta direta ao endpoint público oficial e integrando os resultados ao mesmo fluxo de Análise/Notificações que já existe para DJEN.

## API descoberta (oficial, pública, sem autenticação)

- `GET https://digital.stf.jus.br/decisoes-publicacoes/api/public/ultimo-dje` → última data de DJE disponível.
- `POST https://digital.stf.jus.br/decisoes-publicacoes/api/public/publicacoes`
  ```json
  {
    "termo": "OSMAR MENDES",
    "processo": "",
    "pagina": 1,
    "quantidade": 10,
    "data": 1776927600000,
    "dataFim": 1776973781451,
    "tipoPesquisa": ["PUBLICACAO","DIVULGACAO"],
    "filtros": { "Tipo": [], "Relator": [], "Sessão": [], "Colegiado": [] }
  }
  ```
  Resposta: `publicacoes[]` com `id, processo, processoId, tipo, relator, divulgacao, publicacao, texto` (HTML).

## Estratégia anti-WAF (mais barata possível)

Em vez de proxy externo (n8n) — que já consumiu créditos sem sucesso — vamos fazer **chamada direta a partir do navegador do próprio usuário**, mesmo padrão que o `pjeComunicaClient.ts` já usa hoje para o DJEN. O próprio IP do usuário resolve o desafio AWS WAF naturalmente (cookie `aws-waf-token` é setado pelo browser dele).

Vantagens:
- Zero custo de infra (sem Edge Function, sem n8n, sem proxy).
- Zero risco de WAF block — é uma sessão real de browser.
- Mesmo padrão arquitetural do DJEN Flash que já funciona.

Tradeoff aceito: a busca só roda quando o usuário está com a aba aberta (igual DJEN Flash hoje).

## Arquitetura

```text
┌──────────────────────────────────────┐
│ UI: card "STF Termos" no painel       │
│  Executar / Retomar / Cancelar        │
└────────────────┬─────────────────────┘
                 │
   useStfTermosFlash (hook React)
                 │
   useStfTermosFlashEngine (singleton)
                 │
   stfDigitalClient.ts (fetch direto do browser)
        ├─ getUltimoDje()
        └─ buscarPublicacoes(termo, dataIni, dataFim, pagina)
                 │
   validação (frase exata + exclusões) — reusa djenTermoMatch.ts
                 │
   INSERT em publicacoes_stf (via supabase-js no browser)
                 │
   view publicacoes_unificadas (já existente, ganha fonte 'stf')
```

## Etapas de implementação

1. **Migração DB**
   - Criar `public.publicacoes_stf` (id, monitoramento_id, coordenacao_id, processo_numero, tipo, relator, data_divulgacao, data_publicacao, texto_html, texto_limpo, hash_conteudo, fonte='stf_digital', stf_id, created_at).
   - Índices: `(monitoramento_id, hash_conteudo)`, `(coordenacao_id, data_publicacao)`, `(processo_numero)`.
   - RLS por `coordenacao_id` (mesmo padrão de `publicacoes_djen`).
   - Atualizar view `publicacoes_unificadas` para incluir fonte 'stf'.
   - Atualizar CHECK constraint de `execucoes_agendadas.tipo` para aceitar `'stf'`.

2. **Cliente HTTP `src/utils/stfDigitalClient.ts`**
   - Fetch direto do browser para os 2 endpoints, com headers realistas (`Accept`, `Referer`, `X-Requested-With`, `Content-Type`).
   - Função `buscarPublicacoesStf({ termo, dataInicio, dataFim, pagina })` retornando shape padronizado.
   - Paginação interna até esgotar.

3. **Engine singleton `src/hooks/useStfTermosFlashEngine.ts`**
   - Padrão idêntico a `useDjenTermosFlashEngine.ts` (estado global, checkpoint em localStorage, subscribe pattern).
   - Itera `dias × monitoramentos × termos`.
   - Delay 1500ms entre termos, 800ms entre páginas.
   - Validação por frase exata via `conteudoContemFraseExata` (já existe em `djenTermoMatch.ts`).
   - Dedup por hash de conteúdo limpo.
   - INSERT direto em `publicacoes_stf` via `supabase` client.

4. **Hook wrapper `src/hooks/useStfTermosFlash.ts`** — toasts + invalidate queries (espelho de `useDjenTermosFlash.ts`).

5. **UI `src/components/configuracoes/StfTermosDashboardCard.tsx`** — mesmo layout dos cards Flash/Pro: Executar / Retomar / Cancelar / Limpar checkpoint, contadores (novas, duplicadas, descartadas), barra de progresso por dia.

6. **Integração unificada**
   - View `publicacoes_unificadas` já é consumida pelas telas de Análise/Notificações — basta incluir fonte 'stf'.
   - Filtros existentes ganham automaticamente "STF Digital" como origem.

## Escopo do MVP

- Migração DB.
- Cliente HTTP browser-side.
- Engine + hook + card UI.
- Integração na view unificada.

**Fora do MVP** (fase 2 se necessário): Edge Function server-side (só se descobrirmos que o WAF bloqueia o IP do usuário em uso real), cron diário, retry avançado.

## Riscos

| Risco | Mitigação |
|---|---|
| WAF bloquear o navegador do usuário | Headers realistas + `credentials: 'include'`. Se ocorrer, usuário vê erro claro e pode recarregar a página (renova token WAF). |
| API mudar | Logs detalhados no engine; falha silenciosa por termo sem travar o lote. |
| Volume alto (~1.500 pubs/dia STF) | Paginação com delay; processar 1 dia por vez. |
| Termo genérico = ruído | Reusa `condicao_concomitante` e `exclusoes_djen` do monitoramento (mesma estrutura). |

## Custo estimado de créditos

Drasticamente menor que tentativas anteriores: sem n8n, sem proxy, sem deploy de Edge Function. Apenas DB migration + 4 arquivos de frontend. Estimativa: **5–10 créditos** para entrega completa do MVP.


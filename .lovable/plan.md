## Recuperar publicações Kurier de 07/07

Os 2404 payloads brutos estão preservados em `kurier_publicacoes_raw`. Vou fazer o replay a partir deles.

### 1. Modo `replay_raw` em `kurier-consultar-publicacoes`

Em `supabase/functions/kurier-consultar-publicacoes/index.ts`, aceitar:

```json
{ "replay_raw": true, "data_inicio": "YYYY-MM-DD", "data_fim": "YYYY-MM-DD", "credencial_id": "<opcional>" }
```

Quando `replay_raw=true`:
- Pula toda chamada HTTP à API Kurier.
- Lê `kurier_publicacoes_raw` na janela BRT (por `created_at`), paginado 500/500, opcional filtro por `credencial_id`.
- Para cada linha, reaproveita **o mesmo bloco de normalização + INSERT em `publicacoes_djen`** que já existe (linhas ~876–1015). Nada de reimplementar lógica em paralelo.
- Dedup natural (`origem='kurier' + id_externo`) evita duplicar se alguma sobrou.
- Não reinsere em `kurier_publicacoes_raw`; só atualiza `publicacao_djen_id` da linha raw com o novo UUID.
- Retorna `{ replayed, novas, duplicadas, descartadas }` no mesmo formato dos outros modos.

### 2. Botão "Reprocessar dia" no card Kurier

Em `src/components/configuracoes/MonitoramentoTermosKurierCard.tsx`, adicionar um bloco novo abaixo do "Executar Kurier":

- Campo `<Input type="date">` com valor default = hoje (BRT).
- Botão **"Reprocessar dia (a partir do bruto)"** que chama:
  ```ts
  supabase.functions.invoke("kurier-consultar-publicacoes", {
    body: { replay_raw: true, data_inicio: dia, data_fim: dia }
  })
  ```
- Toast com o resumo devolvido (`X novas, Y duplicadas, Z descartadas`).
- Texto de ajuda curto: "Reprocessa payloads já baixados da Kurier neste dia. Use quando as publicações foram apagadas por engano — não consome a fila da Kurier."

### 3. Verificação após você clicar

Depois do replay, confiro:
- `SELECT COUNT(*) FROM publicacoes_djen WHERE origem='kurier' AND data_publicacao::date='2026-07-07'`
- Tela Análise DJEN mostrando as publicações de novo.

### Escopo estrito

- Não toco em `kurier_publicacoes_raw` além do `UPDATE publicacao_djen_id`.
- Não chamo a API Kurier, não altero fila, não altero `confirmada`.
- Modo padrão da função continua inalterado.
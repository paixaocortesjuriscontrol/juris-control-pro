## Diagnóstico

A execução de hoje (28/05/2026) capturou apenas **2 publicações** de **544 recebidas** porque o scheduler do Kurier está rodando em **modo personalizado** (`/api/KJuridico/ConsultarPublicacoesPersonalizado`), que filtra pela **data de PUBLICAÇÃO** do jornal — não pela disponibilização.

### O que está acontecendo

1. `src/hooks/useDjenTermosKurierScheduler.ts` (linha 93) dispara sempre com `modoPersonalizado=true` e `data_inicio=data_fim=hoje`.
2. A edge function consulta `Personalizado?data=2026-05-28` (e `2026-05-29` por extensão D+1).
3. O endpoint retorna publicações com `DATA_PUBLICACAO=28/05/2026` — mas a maioria dessas tem `DATA_DIVULGACAO=27/05/2026`, então caem em `foraJanela` (linha 555–565) e são **descartadas silenciosamente sem incrementar nenhum contador**.
4. Esse modo (`useDateMode`) **não confirma** nada na fila Kurier (apenas leitura), então `total_confirmadas=0`.
5. O endpoint personalizado também devolve payload em `UPPER_SNAKE` (`N_RECORTE`, `DATA_DIVULGACAO`…) que `buildConfirmacaoKurier` (espera PascalCase `IdProcesso`) não consegue confirmar mesmo se chamado.

Evidência (`kurier_execucoes` últimas 24h):
- 11:00 hoje: 6 execs, **544 recebidas, 4 novas, 0 confirmadas, 0 descartadas**.
- 02:00 hoje: 12 execs, 288 recebidas, 33 novas, **288 confirmadas** (eram runs em modo fila — funcionou).

### Conclusão

O modo correto para "varrer até chegar nas publicações do dia" é o **modo fila** (`/api/KJuridico/ConsultarPublicacoes`), que devolve a fila ordenada por antiguidade, com payload PascalCase confirmável, e onde já existe filtro local estrito por `data_disponibilizacao`.

## Mudanças

### 1. `src/hooks/useDjenTermosKurierScheduler.ts`

- Linha 93: trocar `executarDjenTermosKurier(false, undefined, undefined, hojeYmd, hojeYmd, false, true)` por `executarDjenTermosKurier(false, undefined, undefined, hojeYmd, hojeYmd, false, false)` — i.e. **modoPersonalizado=false**.
- Mesma mudança em qualquer ponto que invoque o engine automaticamente (verificar `useDjenTermosParalela.ts` — atualmente já passa `false`, OK).

### 2. `src/hooks/useDjenTermosKurierEngine.ts`

- Linha 148: hoje força `max_lotes=1` quando há data; remover esse `? 1 : 3` e passar sempre `max_lotes: 3` (ou o cap da edge function).
- Linha 178: remover o `if (modoPersonalizado) break;` já não importa porque sempre seremos fila; manter a condição de saída por `recebidas === 0` ou `lotes_processados === 0` (linha 181).
- Resultado: o engine encadeia até 200 chamadas (`MAX_CALLS_PER_CREDENCIAL`), cada uma drena vários lotes de 50 da fila Kurier até esvaziar ou cancelar.

### 3. `supabase/functions/kurier-consultar-publicacoes/index.ts`

- Aumentar `MAX_LOTES_PER_CALL` de **1 para 5** (drena até 250 itens por chamada — caber dentro do orçamento de CPU da Edge Function; a função já tem `delay(150ms)` entre lotes).
- **Contabilizar itens fora-janela**: hoje (linhas 555–566) o `continue` silencioso some com os itens. Adicionar `totalDescartadas++` e armazenar `motivo_descarte='fora_janela_disp'` no `kurier_publicacoes_raw` para auditoria.
- **Não parar cedo em fila**: o `break` da linha 506 (`if (!pubs.length) break`) está correto. A linha 775 (`if (!useDateMode && pubs.length < LOTE_SIZE) break`) está OK — significa que a fila esvaziou parcialmente. Manter.
- **Critério de parada por data**: adicionar verificação extra — se em um lote **todos** os itens têm `data_disponibilizacao > data_fim`, parar (significa que ultrapassamos a janela; itens futuros não devem ser confirmados, devem ficar na fila para o dia certo). Hoje esses itens caem em `foraJanela` mas o código confirma (linha 559–564) — corrigir para **não confirmar** quando `refYmd > data_fim` (só confirmar quando `refYmd < data_inicio`, ou seja, atrasado mesmo).
- Continuar usando estritamente `data_disponibilizacao` para o filtro local.

### 4. Telemetria

- Logar a cada lote: `recebidas, fora_janela_antes_hoje, fora_janela_depois_hoje, na_janela, novas, duplicadas, confirmadas, total_fila_restante (estimado)`.
- Atualizar `mensagem` da track no engine para incluir esses números, ajudando o usuário a saber quanto falta da fila.

## Arquivos afetados

- `src/hooks/useDjenTermosKurierScheduler.ts`
- `src/hooks/useDjenTermosKurierEngine.ts`
- `supabase/functions/kurier-consultar-publicacoes/index.ts`

## Não incluído (deixa para depois se quiser)

- Reescrever a confirmação para suportar payload `N_RECORTE` (endpoint personalizado). Como vamos parar de usar Personalizado, fica fora.
- Backfill de publicações perdidas hoje: depois que o fix subir, basta rodar Kurier manualmente (drenarBacklog) que a fila vai puxar até alcançar 28/05 corretamente.

## Validação

- Após deploy, disparar manualmente (botão Kurier) com janela hoje–hoje.
- Verificar `kurier_execucoes` hoje: `total_recebidas` deve ser alto (drenando fila antiga), `total_confirmadas` ≈ itens antigos drenados, `total_novas` deve refletir publicações reais do dia.
- Conferir `kurier_publicacoes_raw` com `motivo_descarte='fora_janela_disp'` para auditoria.

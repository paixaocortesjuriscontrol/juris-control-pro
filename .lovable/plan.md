# Acelerar DJEN Termos Servidor (travando hoje)

## Diagnóstico

Execução atual (`dd8062bd…`) está há 16+ min com **227/2002 itens concluídos** (~14/min). Worker vivo (heartbeat 5s), nenhum erro — está só processando devagar. Causa identificada em `monitor-servidor/engines/paralela.js`:

### Gargalo principal: "empty cross-slot rescue" (linhas 1441-1466)

Quando uma busca **(tribunal × monitoramento × dia)** retorna 0 publicações sem erro HTTP (situação **normal e maioritária** — a maior parte das combinações tribunal/termo/dia não tem nada), o motor agora itera **todas as outras 5 VPS** e refaz a busca paginada inteira em cada uma para confirmar o zero.

Custo por item zero: até **5 buscas paginadas extras**, cada uma com:
- `PAGE_DELAY_MS` = 800 ms entre páginas
- `PARTE_OR_DELAY_MS` = 1800 ms entre variantes de parte
- streaks de 2 páginas vazias antes de parar (mínimo ~3 req)

Resultado: o que era 1 chamada de ~1 s vira ~30-60 s por item zero. Como 6 slots competem por isso simultaneamente, o pool inteiro vive em "rescue" e quase não avança.

Isso foi adicionado para casos pontuais em que uma VPS específica devolvia listagem vazia indevidamente, mas o custo virou proibitivo agora que o pool tem 6 VPS.

## Mudanças propostas

**Arquivo:** `monitor-servidor/engines/paralela.js`

1. **Remover** o bloco `empty_cross_slot_rescue` (linhas 1441-1466). O **5xx failover** (linhas 1408-1434) e o **retry de página vazia** dentro de `buscarTermo` (delay 600 ms e refaz) continuam intactos — eles cobrem a instabilidade real da API sem multiplicar custo.

2. **Manter** todos os outros comportamentos (paginação `continueUntilEmpty` por streak, validação `buildTextoCompleto`, OAB fallback, delays atuais, `PARTE_OR_DELAY_MS` 1800, `PAGE_DELAY_MS` 800, `TERM_DELAY_MS` 2500). Nenhuma regra de match muda.

3. **Não** mexer no Browser, nas tabelas, nem nas demais engines.

## Deploy

Após o commit, na VPS Hostinger:
```bash
cd /opt/jc-monitor-servidor && git pull && pm2 restart jc-monitor-servidor
```

## Resultado esperado

- Buscas legítimas com 0 resultados voltam a custar ~1 s em vez de ~30-60 s.
- Throughput sobe de ~14 itens/min para a faixa habitual (~60-80 itens/min com 6 slots).
- Execução em andamento pode ser cancelada e refeita após o restart, ou deixar terminar.

## Risco

Baixo. O cross-slot rescue era uma proteção contra uma VPS específica devolver vazio indevidamente — caso volte a acontecer pontualmente, o item entra na refila do dia seguinte (mecanismo `recordFalha` continua ativo) e o usuário pode reexecutar.

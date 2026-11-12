# Tentar de novo as unidades bloqueadas pelo DJEN (403)

## O que muda para a equipe
Hoje, quando o DJEN bloqueia por alguns minutos, a pesquisa faz uma única nova tentativa imediata. Como o bloqueio ainda está valendo, a tentativa falha de novo e a execução fecha como "parcial".

Com a mudança, ao final de cada execução (normal ou repescagem):
1. Se houver unidades bloqueadas, o sistema espera o bloqueio passar (cerca de 5 minutos) antes de tentar de novo.
2. Ele tenta de novo devagar, uma unidade por vez, com intervalo maior entre as consultas.
3. Se o DJEN bloquear de novo, espera mais (10 e depois 15 minutos), até 3 rodadas.
4. A execução só fecha como "parcial" se, depois dessas 3 rodadas, ainda sobrar unidade sem coleta.
5. Na tela da execução aparece "Aguardando liberação do DJEN para tentar de novo X unidades", para ninguém achar que travou.

Limite total de espera: cerca de 30 minutos. Isso não atrasa a execução seguinte nem é tratado como execução travada.

## Detalhes técnicos
- `monitor-servidor/engines/paralela.js`, bloco "DRENAGEM FINAL": transformar a passada única em até 3 rodadas, com espera de 5/10/15 min só quando a rodada anterior teve 403 de bloqueio do DJEN (`isUpstreamBlockBody` / contador de bloqueio). Usar 1 via, com intervalo extra entre as consultas.
- Durante a espera, manter o heartbeat ativo e ver se a execução foi cancelada a cada 15 s, para o `reaper_execucoes_servidor_travadas` (3 min) não encerrar a execução.
- Gravar no diagnóstico `rodadas_drenagem` e `recuperadas_apos_bloqueio`, para mostrar quantas unidades foram salvas pela nova tentativa.
- Esse código roda na VPS: depois de alterado, é preciso atualizar o arquivo lá e reiniciar o pm2 (`pm2 restart`). Os comandos vão na resposta final.

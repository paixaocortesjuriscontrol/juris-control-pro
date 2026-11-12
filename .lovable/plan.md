# Repescagem DJEN: corrigir o que realmente falha

## O que os registros mostram
A repescagem **não está travando** e o DJEN **não bloqueou** a repescagem.

- **Repescagem de 11/11 às 23h30:** pesquisou 10/11 inteiro em 9 segundos e terminou sem nenhum erro (1 publicação nova, 3.480 já gravadas).
- **As 24 "unidades não coletadas"** que ela mostrou não são dela. São do dia **11/11**, da execução das **04h30 da manhã**. O DJEN bloqueou a Google VPS nessa execução e, depois de 3 tentativas, essas unidades foram abandonadas.
- **O mesmo aconteceu em 10/11:** 30 unidades bloqueadas de madrugada, e a repescagem da noite repetiu o mesmo aviso.

Os problemas de verdade são três:
1. **Unidades abandonadas não são pesquisadas de novo.** As execuções das 10h00 e das 17h00 não voltam a elas, e a repescagem olha só o dia anterior. Na prática, essas unidades ficam sem pesquisa naquele dia.
2. **O aviso confunde.** Cada execução mostra as falhas do dia inteiro, e não as suas próprias. Por isso a repescagem parece ter falhado.
3. **O bloqueio acontece na execução das 04h30,** que é a mais pesada (cerca de 4.600 publicações novas).

## O que muda
1. **As unidades abandonadas são pesquisadas de novo nas execuções seguintes.** As execuções das 10h00 e das 17h00 começam pelas unidades abandonadas do dia, devagar e uma por vez, antes da pesquisa normal.
2. **A repescagem da noite cobre dois dias:**
   - o dia anterior inteiro, como hoje;
   - as unidades do dia atual que ainda estiverem sem pesquisa.
   Assim nada fica para trás.
3. **Espera antes de tentar de novo:** quando o DJEN bloquear, o sistema espera de 5 a 15 minutos antes de tentar outra vez, em vez de gastar as 3 tentativas em sequência.
4. **Aviso correto:** cada execução mostra só as unidades que **ela** não conseguiu pesquisar, com o dia de cada uma. A repescagem só aparece como "parcial" se falhar de verdade.
5. **Menos bloqueio às 04h30:** a execução das 04h30 passa a dar mais intervalo entre as consultas feitas pela mesma VPS.

## Detalhes técnicos
- `monitor-servidor/falhasRefila.js`:
  - A busca de falhas aceita um dia e um modo "reabrir abandonadas". As abandonadas voltam a "pendente" com um contador próprio por execução, sem passar de 3 rodadas por dia.
  - A contagem e a lista de falhas passam a ser filtradas por `exec_id`, guardado no payload da falha.
- `monitor-servidor/engines/paralela.js`:
  - Antes dos itens normais, injetar as falhas do dia, do mesmo jeito que a drenagem final já faz.
  - Na repescagem, injetar também as falhas de `diaBrtHoje()`.
  - Drenagem com espera de 5, 10 e 15 minutos após bloqueio 403, mantendo o sinal de funcionamento (heartbeat) ativo para o encerramento automático não parar a execução.
  - Mais intervalo entre consultas por VPS quando a execução é grande.
- Diagnóstico: incluir `recuperadas_de_execucoes_anteriores`.
- Esse código roda na VPS. Depois de alterado, é preciso atualizar os arquivos lá e reiniciar o pm2. Os comandos vão na resposta final.

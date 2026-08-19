# Ajustes no alerta e na tabela de execuções do DJEN Termos Servidor

## Contexto
As execuções de Termos do servidor terminam como `concluido_parcial` sempre com a mesma unidade do TST não coletada. Hoje a tabela de execuções mostra totais idênticos (ex.: 2.025 em todas as rodadas), o que parece estranho, mas explica-se: o diário do dia sai completo na primeira rodada e as rodadas seguintes reencontram as mesmas publicações. Já o "parcial (1)" não diz qual tribunal falhou, e os alertas técnicos precisam ser encaminhados somente ao suporte.

## O que será feito

### 1. Tabela de execuções mais clara (Análise DJEN)
- Mostrar, em cada célula, **publicações vistas** e **publicações novas**.
- Exemplo: `720 · +0 novas` para deixar explícito que a rodada não trouxe novidade.
- Isso evita que totais iguais pareçam erro de contagem.

### 2. Badge "parcial" com explicação
- Ao passar o mouse sobre o badge, exibir:
  - tribunal que ficou pendente (ex.: TST);
  - quantidade de falhas;
  - erros 5xx;
  - tempo consumido por aquele tribunal.
- Dados virão do campo `falhas_por_tribunal` / `diagnostico` já gravado na execução.

### 3. Alerta de diferença entre execuções continua como está
- Mantém o filtro atual: só considera rodadas com status `concluido`.
- Não envia rodadas `concluido_parcial` para advogados/coordenadores.
- Destinatários e assunto permanecem os mesmos.

### 4. Problemas de execução só para suporte
- Todos os avisos técnicos (rodadas parciais, tribunal falhando em todas as rodadas do dia, erros 5xx/timeouts) são enviados exclusivamente para `suporte@paixaocortes.adv.br`.
- A função `verificar-saude-pool-djen` ganha uma checagem extra: se o mesmo tribunal ficar parcial em todas as rodadas de Termos do dia, incluir essa informação no corpo do e-mail de saúde.

### 5. Mitigação do TST no worker (fora deste projeto)

O motor que consulta o DJEN não roda no Supabase; ele roda em Node nas VPS/Hostinger (pasta `monitor-servidor/`, serviço `djen-proxy` gerido por PM2/systemd). É esse código que:
- divide os termos em unidades por tribunal;
- define quanto tempo cada unidade pode rodar (orçamento);
- decide se refila ou desiste quando dá erro.

Por que o TST dá "parcial (1)" todo dia:
- O TST está recebendo o mesmo orçamento dos outros tribunais (~90s por unidade), mas leva de 583 a 672 segundos e devolve muitos erros 5xx.
- Quando o orçamento acaba, a unidade é abandonada. A rodada fecha com `unidades_nao_coletadas = 1`, e o badge mostra "parcial (1)" sem dizer qual tribunal foi.
- Não é um bug na contagem da tela; é o worker que não consegue terminar a coleta do TST dentro do tempo.

O que será alterado no worker:
- **Orçamento dedicado ao TST**: dar mais tempo e uma fila própria ao TST, em vez de usar o mesmo limite de todos os tribunais.
- **Drenagem final**: antes de encerrar a rodada, tentar mais uma vez somente as unidades que ficaram pendentes, com uma concorrência reduzida (1 requisição por vez), para não provocar novos 5xx.
- **Diagnóstico detalhado**: registrar qual unidade/unidades ficaram de fora e o motivo, para o alerta de suporte citar exatamente o tribunal e o problema.

Como essa mudança entra em produção:
- O código do worker fica em `monitor-servidor/`. Eu edito esses arquivos no repositório.
- Nas VPS/Hostinger é preciso executar `git pull` + `pm2 restart` (ou `systemctl restart djen-proxy`) para o código novo passar a valer.
- Sem esse passo manual nas VPS, o parcial do TST continuará aparecendo todo dia.
- Entrego junto o roteiro de comandos para cada VPS.

## Arquivos que serão alterados
- `src/hooks/useExecucoesDoDiaPorCoordenacao.ts` — expor `falhasPorTribunal` e diagnóstico da execução.
- `src/pages/AnaliseDjen.tsx` — renderizar "vistas · +novas" e tooltip no badge parcial.
- `supabase/functions/verificar-saude-pool-djen/index.ts` — detectar tribunal parcial em todas as rodadas do dia e enviar apenas para `suporte@paixaocortes.adv.br`.
- `monitor-servidor/engines/...` — orçamento dedicado ao TST, drenagem final e diagnóstico detalhado.

## O que não muda
- O alerta de diferença entre execuções (`alertar-diferenca-djen-termos`) não será alterado.
- Não haverá mudança de schema no banco.
- Advogados e coordenadores não receberão avisos técnicos de rodadas parciais.

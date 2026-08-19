# DJEN Termos Servidor: totais iguais e "parcial (1)" sempre no mesmo tribunal

## O que os dados mostram (verificado hoje, 19/08/2026)

Houve 3 rodadas de Termos no servidor: 04:30, 10:00 e 17:00 (BRT). As três terminaram com status `concluido_parcial` e `unidades_nao_coletadas = 1`.

- **Totais iguais são reais, não erro de contagem.** As 2.025 publicações vinculadas a cada rodada são exatamente as mesmas (todas as 2.025 estão ligadas às 3 rodadas) e todas foram criadas na rodada das 04:30. O resultado da rodada das 17:00 registra `novas: 0` e `duplicatas: 2039`. Ou seja: o diário do dia já sai completo de manhã e as rodadas seguintes reencontram o mesmo conjunto. O problema é de **leitura da tela**: a coluna mostra "publicações vistas" e não "publicações novas", então parece que nada foi comparado.
- **O "parcial (1)" é sempre o TST.** Em todas as rodadas o campo `falhas_por_tribunal` aponta o TST (2 falhas às 04:30, 1 às 17:00), com 36 a 72 erros 5xx e o TST consumindo 583–672 segundos (o dobro do 2º colocado). Nenhum erro 429 e nenhuma unidade estourada. É sempre a mesma unidade do TST que não fecha a coleta — o badge hoje não diz qual, então parece um número solto.
- **O e-mail de diferença entre execuções não está sendo disparado.** A função de alerta só considera execuções com status `concluido`; como as 3 rodadas de Termos ficaram `concluido_parcial`, ela registrou "execuções Termos: 0" e não comparou nada.

## O que muda

1. **Deixar claro o que cada número é** na tabela de execuções da Análise DJEN: cada célula mostra "vistas" e "novas" com legenda, para que rodadas sem novidade fiquem explícitas (ex.: `720 · +0 novas`) em vez de parecerem repetição suspeita.
2. **Badge "parcial" explicado**: passar a mostrar, ao passar o mouse, o tribunal responsável, quantas falhas, erros 5xx e o tempo gasto — usando os dados que já existem no resultado da execução (`falhas_por_tribunal`, `diagnostico`).
3. **E-mail de diferença entre execuções fica como está hoje** (só rodadas `concluido`, destinatários atuais). Rodadas parciais **não** vão para advogados/coordenadores.
4. **Problemas de execução vão só para o suporte**: todo aviso técnico (rodada parcial, tribunal falhando em todas as rodadas do dia, erros 5xx/timeouts) é enviado exclusivamente para `suporte@paixaocortes.adv.br`, no e-mail de saúde já existente.
5. **Mitigação do TST no worker** — o que é e por que é fora deste projeto:
   - O motor que efetivamente consulta o DJEN não roda aqui no Supabase: roda em Node nas VPS/Hostinger (pasta `monitor-servidor/`, serviço `djen-proxy`/PM2). É esse código que divide os termos em "unidades" por tribunal, controla o orçamento de tempo de cada unidade e decide se refila ou desiste.
   - Hoje o TST recebe o mesmo orçamento dos demais tribunais (~90s por unidade), mas consome de 583 a 672 segundos e devolve muitos 5xx. Quando o orçamento estoura, a unidade é abandonada e a rodada fecha com `unidades_nao_coletadas = 1` — é exatamente o "parcial (1)" que aparece na tela todos os dias, sempre no TST.
   - A alteração: (a) orçamento próprio e maior para o TST, em vez do valor único global; (b) *drenagem final*: antes de encerrar a rodada, tentar mais uma vez somente as unidades que ficaram pendentes, com concorrência reduzida (1 requisição por vez) para não levar novo 5xx; (c) registrar no diagnóstico qual unidade ficou de fora, para o alerta de suporte citar o motivo.
   - Como entra em produção: eu edito os arquivos em `monitor-servidor/` aqui no repositório; nas VPS é preciso `git pull` + `pm2 restart` (ou `systemctl restart djen-proxy`) para o código novo passar a valer. Entrego o roteiro de comandos junto. Sem esse passo manual nas VPS, a correção não tem efeito e o parcial do TST continua todo dia.

## Detalhes técnicos

- `src/hooks/useExecucoesDoDiaPorCoordenacao.ts`: já calcula `total` e `novas` por célula; expor também `falhasPorTribunal` e um resumo do diagnóstico por execução.
- `src/pages/AnaliseDjen.tsx` (tabela de execuções do dia): renderizar "vistas · +novas", legenda e tooltip do badge parcial.
- `supabase/functions/alertar-diferenca-djen-termos/index.ts`: trocar `.eq("status","concluido")` por `.in("status", ["concluido","concluido_parcial"])` e marcar no corpo do e-mail as rodadas parciais e o tribunal afetado.
- `supabase/functions/verificar-saude-pool-djen`: acrescentar a checagem de "mesmo tribunal parcial em todas as rodadas do dia".
- Observação de dado: hoje `publicacoes_djen_servidor` tem 2.029 registros do dia e `publicacoes_djen` tem 1.913 — a tela de execuções conta a primeira e o alerta conta a segunda. Vou alinhar a fonte de contagem das duas para evitar divergência de números entre tela e e-mail.
- Sem alterações de schema.
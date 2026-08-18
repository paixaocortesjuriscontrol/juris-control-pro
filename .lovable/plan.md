# DJEN Termos Servidor "travado em 3%" — diagnosticar e corrigir a percepção/lentidão

## O que os dados mostram agora (medido)

Execução atual `e5eb30bf` (iniciada 19:15 BRT), tipo `djen_paralela_servidor`:

```text
unidades ............ 205
concluídas .......... 6      (~3%)
em execução ......... 13     (uma por VPS: Hostinger 1, Google 1..12)
pendentes ........... 186
erros ............... 0
idade ............... ~3 min
```

As 13 unidades em voo estão avançando páginas de verdade (ex.: "TRT6: 3/4", "TRT7: 1/4"), cada uma numa VPS diferente. Falhas do dia: 655 `resolvido` e apenas **1 pendente** — não há tempestade de refila.

Ou seja: a rodada **não está travada**; ela está no começo. O contador de 3% conta apenas unidades 100% concluídas, e as primeiras unidades da onda são as mais lentas (TRTs com muitas páginas + TST). Para comparação, a rodada das 20:00 levou 39 min para 208 unidades — 3% em 3 min está dentro desse ritmo.

O que mudou de fato com a última alteração: 429/401 deixaram de consumir tentativa e passou a existir uma "drenagem final". Nenhuma das duas coisas roda no início da rodada, então não explicam o 3% inicial — mas as duas podem, em teoria, alongar o **fim** da rodada.

## Correções propostas

### 1. Progresso honesto (elimina a sensação de travamento)
O percentual passa a considerar o avanço parcial das unidades em voo (páginas já lidas), não só unidades fechadas. No cabeçalho da execução: `X/205 unidades · N páginas lidas · 13 em voo`, com o horário do último avanço. Assim, quando 13 unidades pesadas estão a caminho, a barra se move.

### 2. Ordenação da onda: leves primeiro
Hoje as primeiras unidades sorteadas incluem os tribunais mais pesados, e o usuário fica minutos vendo 0–3%. A onda passa a começar pelas unidades historicamente rápidas, deixando as lentas para diluir no meio da rodada. Mesmo tempo total, progresso visivelmente contínuo desde o primeiro minuto.

### 3. Guarda-corpo nos retries que não consomem tentativa
429/401 continuam sem consumir o teto de tentativas (correto), mas ganham um **limite absoluto de reciclagens por unidade/dia** e um teto de tempo. Sem isso, uma unidade em 429 crônico pode circular indefinidamente e esticar o fim da rodada.

### 4. Teto de tempo para a drenagem final
A passada final de drenagem passa a ter orçamento próprio (poucos minutos). Se estourar, a rodada fecha como `concluido_parcial` e o botão **Recoletar faltantes** resolve o resto — em vez de a rodada ficar aberta indefinidamente.

### 5. Detector real de travamento
Se nenhuma unidade avançar página por X minutos, a execução passa a registrar isso na mensagem de progresso e no log (`paralela.sem_avanco`), com o nome das VPS silenciosas. Assim "travou" deixa de ser suposição e vira dado.

## Detalhes técnicos

- `monitor-servidor/engines/paralela.js`: percentual ponderado por páginas no `flushProgresso`; ordenação inicial das bandas por custo histórico do tribunal; orçamento próprio para o bloco de DRENAGEM FINAL; watchdog de "sem avanço".
- `monitor-servidor/falhasRefila.js`: contador separado de reciclagens (429/401) com teto, mantendo `tentativas` intacto para falhas reais.
- Front: `src/components/.../ExecucoesDoDia*Card.tsx` e `src/pages/DjenServidor.tsx` — exibir unidades em voo, páginas lidas e horário do último avanço.
- Sem mudança de schema. Deploy na Hostinger: `git pull` + `pm2 restart jc-monitor-servidor`.
- Nada disso cancela a rodada em andamento; se quiser, dá para deixá-la terminar e comparar a duração com as rodadas de 20:00 e 21:40 antes do deploy.

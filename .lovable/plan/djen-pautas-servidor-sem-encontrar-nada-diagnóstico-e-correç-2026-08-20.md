# DJEN Pautas Servidor sem encontrar nada — diagnóstico e correção

**Escopo restrito:** as mudanças ficam exclusivamente no motor DJEN Pautas Servidor
(`buscar-dejt-pautas`, `executar-djet-pautas-agendado`, `monitor-servidor/engines/pautas.js`
e o card de progresso das Pautas). Nenhum outro motor (DJEN Termos Servidor, Browser,
Processos, Kurier) é alterado.

## O que está acontecendo (verificado agora)

A rotina não está com defeito de busca: ela está **descartando os cadernos** porque a fonte do DEJT está atrasada.

O DEJT publica apenas o "caderno vigente" em um caminho fixo por tribunal
(`https://diario.jt.jus.br/cadernos/Diario_J_<ID>.pdf`). Consultando agora (20/08/2026, 13:47 BRT):

```text
TST   -> edição de 18/08 (last-modified 18/08 21:55 UTC)
TRT01 -> 18/08     TRT02 -> 18/08     TRT03 -> 17/08
TRT04 -> 17/08     TRT09 -> 18/08     TRT10 -> 18/08
TRT15 -> 17/08     TRT18 -> 13/08     TRT21 -> 17/08     TRT24 -> 14/08
```

Como a rotina pede sempre a data de hoje e a função `buscar-dejt-pautas` só aceita o PDF
quando a disponibilização (ou a publicação legal) é igual à data pedida, todo tribunal cai em
`caderno-de-outra-data` — exatamente o que aparece nos logs ("caderno de outra data para
pedido 20/08/2026: disponibilização=2026-08-17…"). Resultado: 0 encontrados em todos.

Confirmação no banco: a última gravação com fonte DEJT foi em 19/08 (4 registros); 18/08 teve 28,
17/08 teve 20. Ou seja, a queda coincide com o congelamento das edições no caminho fixo.

Também há um agravante de horário: as edições sobem por volta de **18:55 BRT** (21:55 UTC).
Qualquer execução de manhã/meio-dia nunca vê o caderno do próprio dia.

## Correção proposta

1. **Processar a edição realmente publicada, em vez de exigir a data pedida**
   - `buscar-dejt-pautas` passa a devolver o caderno vigente com a data interna que ele
     tem (`dataDisponibilizacao` / `dataPublicacaoLegal`), sem rejeitar por divergência.
   - Rejeição continua apenas quando aquela edição **já foi processada** antes para o mesmo
     tribunal (controle por tribunal + data de disponibilização), evitando retrabalho.
   - As publicações gravadas usam a data real da edição, não a data da execução — nada é
     atribuído ao dia errado.

2. **Controle de edições já processadas**
   - Registrar por tribunal a última `data_disponibilizacao` processada (no `metadata` da
     configuração de pautas, sem nova tabela).
   - Assim, quando o TRT18 finalmente pular de 13/08 para 19/08, a rotina captura a edição
     nova mesmo que não seja "a de hoje", e não reprocessa o que já entrou.

3. **Janela de horário compatível com a publicação**
   - Ajustar os horários padrão da rotina de pautas para rodar após ~19:15 BRT (mantendo
     uma passada de reforço na manhã seguinte, que agora é útil porque não exige data igual).

4. **Visibilidade em vez de "0 encontrados"**
   - Card do tribunal mostra a edição efetivamente lida: `Edição 18/08 processada` ou
     `Fonte atrasada — última edição 13/08`.
   - Alerta técnico diário para `suporte@paixaocortes.adv.br` quando algum tribunal estiver
     com edição mais antiga que 2 dias úteis (sinal de mudança/queda no portal do DEJT).

## Detalhes técnicos

- `supabase/functions/buscar-dejt-pautas/index.ts`: em `fetchPdf`, remover o `return
  { ok: false, reason: "caderno-de-outra-data" }` e devolver `ok: true` com as datas lidas;
  o consumidor decide se processa. Manter os guardas de `%PDF` e `MAX_PDF_BYTES`.
- `supabase/functions/executar-djet-pautas-agendado/index.ts`: comparar a
  `dataDisponibilizacao` retornada com a última processada por tribunal; se igual, marcar
  `Edição já processada` e seguir; se nova, paginar e persistir usando essa data.
- Mensagens de progresso (`item.mensagem`) e o payload de progresso ganham o campo
  `edicao` para o painel exibir a data real.
- Nenhuma mudança de schema; nenhuma leitura/escrita cruzada entre estruturas Servidor e
  Browser além do que já existe.

## Observação importante

Se o portal do DEJT tiver mudado o caminho dos cadernos novos (as edições de 19 e 20/08 não
aparecem em nenhum padrão testado, e `dejt.jt.jus.br` responde 403 a acesso direto), este
plano faz a rotina voltar a processar tudo que a fonte expõe, mas as edições ausentes só
entram quando o DEJT publicá-las. Nesse cenário o alerta técnico do item 4 é o que sinaliza
a necessidade de buscar o novo endpoint oficial.

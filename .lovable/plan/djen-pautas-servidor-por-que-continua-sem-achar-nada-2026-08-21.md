# DJEN Pautas Servidor — por que continua "sem achar nada"

Escopo: apenas o motor DJEN Pautas Servidor (`buscar-dejt-pautas`,
`executar-djet-pautas-agendado`, `_shared/dejtTribunais.ts` e o card do painel).
Nenhum outro motor é alterado.

## Diagnóstico (verificado agora no banco e no código)

A rodada de hoje (21/08, 10:30 UTC) terminou com todos os tribunais em
`0 encontrada(s)` — mas não por falha de busca:

1. A única fonte usada é o caminho fixo do "caderno vigente"
   (`https://diario.jt.jus.br/cadernos/Diario_J_<ID>.pdf`).
2. O controle `edicoes_processadas` gravado na configuração de pautas mostra a
   edição que cada tribunal está servindo: TST 18/08, TRT1/2/7/9/10 18/08,
   TRT3/4/5/6/15/17/19/20/21/22/23 17/08, TRT12/13/14/24 14/08, TRT18 13/08,
   TRT8 12/08, TRT16 31/07.
3. Todas essas edições **já foram processadas** em rodadas anteriores. O código
   então corta o tribunal em `edicaoJaProcessada` (nada novo a fazer) — correto —
   mas a mensagem final do card é sobrescrita por
   `Fonte atrasada — edição 18/08 · 0 encontrada(s)`, escondendo o motivo real.
4. Confirmação: a última gravação com `fonte = dejt-pdf` tem
   `data_disponibilizacao = 18/08`. Nenhuma edição de 19, 20 ou 21/08 apareceu
   nesse caminho fixo.

Ou seja: **não há bug de extração; falta fonte para as edições novas** e o painel
comunica isso de forma errada.

## Correção proposta

1. **Mensagem honesta no card (imediato)**
   - Quando o tribunal foi cortado por edição já processada, manter
     `Edição 18/08 já processada (nada novo na fonte)` em vez de
     `0 encontrada(s)`.
   - Distinguir três estados no card: `Edição nova processada · N achados`,
     `Edição já processada`, `Fonte atrasada há X dias úteis`.

2. **Buscar a edição do dia por data, não só o caderno vigente**
   - Adicionar em `buildDejtPdfUrls` candidatos por data (padrões datados do
     DEJT), tentados antes do caminho fixo, com fallback para o vigente.
   - As requisições passam a sair pelo pool de proxies DJEN já existente quando
     o acesso direto responder 403 (o portal bloqueia IPs de datacenter),
     usando a mesma infraestrutura das VPS.
   - Etapa 1 da implementação é uma sondagem: descobrir, pelo proxy, qual URL
     datada responde 200 para 20/08 e 21/08 em TST e 2 TRTs. Se nenhum padrão
     datado existir, seguimos apenas com os itens 1, 3 e 4 e informamos que a
     fonte pública realmente só expõe o caderno vigente.

3. **Reprocessar edição sob demanda**
   - Botão "Reprocessar edição" no card, que ignora `edicoes_processadas` para
     aquele tribunal (útil quando um caderno foi lido parcialmente por erro de
     chunk).

4. **Alerta técnico ao suporte**
   - Um e-mail por dia para `suporte@paixaocortes.adv.br` listando tribunais com
     edição mais antiga que 2 dias úteis (hoje: praticamente todos), para que a
     defasagem da fonte fique visível sem depender de olhar o painel.

## Detalhes técnicos

- `executar-djet-pautas-agendado/index.ts`: propagar `edicaoJaProcessada` para o
  fechamento do tribunal (linhas ~767-787) para não sobrescrever a mensagem;
  aceitar `ignorarEdicoesProcessadas?: string[]` no body.
- `_shared/dejtTribunais.ts`: `buildDejtPdfUrls` devolve lista ordenada
  (datadas → vigente).
- `buscar-dejt-pautas/index.ts`: rota de fetch com fallback por proxy do pool;
  guardas de `%PDF` e `MAX_PDF_BYTES` mantidos.
- Sem mudança de schema; `edicoes_processadas` continua no `metadata` da
  configuração `djet_pautas_servidor`.

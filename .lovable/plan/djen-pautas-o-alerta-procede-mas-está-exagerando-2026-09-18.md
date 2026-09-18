# DJEN Pautas — o alerta procede, mas está exagerando

## O que eu verifiquei agora (18/09/2026, BRT)

Conferi os cadernos direto na fonte oficial de PDFs do DEJT e as pautas gravadas no banco:

- TST, TRT7, TRT9 e TRT24: o caderno Judiciário disponível é o de **14/09/2026** (confirmei também a data impressa dentro do PDF do TST: "Data da Disponibilização: Segunda-feira, 14 de Setembro de 2026").
- TRT14: o caderno Judiciário **não existe** nesse repositório — todas as tentativas de endereço devolvem acesso negado. Por isso ele aparece no e-mail como "não identificada", e vai aparecer todo dia.
- TRT2 e TRT10: atualizados em **17/09/2026** — ou seja, a rotina está funcionando.
- Pautas gravadas: 4 (edição 14/09), 56 (15/09), 12 (16/09) e 30 (17/09). Há captura todos os dias.
- Não existe caderno por data no repositório (endereços com data devolvem acesso negado) e o índice do DEJT segue congelado em 04/09, listando só cadernos Administrativos.

**Conclusão:** não é falha da rotina. A fonte pública realmente está servindo cadernos antigos desses tribunais, e o TRT14 nunca teve caderno Judiciário ali. O e-mail está certo no fundo, mas mistura três coisas diferentes e assusta sem necessidade.

## O que eu proponho fazer

1. **Separar os casos no e-mail**, em vez de tratar tudo como "atraso":
   - *Fonte defasada*: caderno existe mas está velho (hoje: TST, TRT7, TRT9, TRT24).
   - *Caderno indisponível na fonte*: o arquivo não existe/está bloqueado (hoje: TRT14) — passa a ser uma seção separada, com aviso de que é uma limitação permanente da fonte.
2. **Alertar só o que interessa ao escritório**: limitar a verificação aos tribunais que realmente têm processos/monitoramento ativo, para o e-mail não listar tribunais onde nunca haveria pauta nossa.
3. **Silenciar repetição**: enviar no máximo um e-mail por dia por tribunal e só reenviar quando a situação mudar (piorou, ou voltou ao normal), com um aviso de "fonte normalizada" quando a edição voltar a ficar em dia.
4. **Deixar o motivo visível no painel**: no card DJEN Pautas, mostrar por tribunal a edição servida e o estado (em dia / edição já lida / fonte defasada / caderno indisponível), para não parecer "0 encontradas" sem explicação.
5. **Sondagem de fonte alternativa (etapa separada, sem promessa)**: testar, pelas VPS do pool, se o portal `dejt.jt.jus.br/dejt/f/n/diariocon` responde para TST/TRT7/TRT9/TRT14/TRT24. Se responder, incluo esse caminho como segunda fonte; se continuar bloqueado (é o esperado, o portal barra acesso automatizado), informo que a única fonte viável segue sendo o repositório de PDFs e seguimos com os itens 1 a 4.

## Detalhes técnicos

- `supabase/functions/alertar-dejt-fonte-atrasada/index.ts`: classificar em `defasados` e `indisponiveis` (status 403/404 vs. `last-modified` antigo); restringir a lista de tribunais consultando os monitoramentos ativos; tabela de estado por tribunal (última notificação + estado anterior) para o anti-repetição; e-mail com duas tabelas e seção de normalização.
- `supabase/functions/_shared/dejtTribunais.ts`: marcar TRT14 como sem caderno Judiciário no repositório, para não gerar candidato inútil.
- Card do painel (`MonitoramentoTermosCard`/card de pautas): exibir edição servida e estado por tribunal a partir do resultado da última execução.
- Sem mudança de schema além da tabela de estado do alerta; `edicoes_processadas` continua no `metadata` da configuração `djet_pautas_servidor`.

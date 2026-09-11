# Reclamação da Jéssica sobre o Workflow "ACÓRDÃO - EDS"

## O que os registros mostram

A reclamação não procede como falha do sistema. O fluxo criou exatamente a etapa que estava cadastrada no momento do uso.

Linha do tempo real do fluxo "ACÓRDÃO - EDS OU RR?":

```text
03/09 20:03  fluxo criado com UMA única etapa, chamada "ACÓRDÃO - RR"
08/09 11:04  fluxo iniciado -> criou o prazo "ACÓRDÃO - RR" (16/09)
08/09 19:20  fluxo iniciado de novo -> criou outro prazo "ACÓRDÃO - RR"
11/09 11:41  fluxo iniciado pela publicação -> criou o prazo "ACÓRDÃO - RR"
11/09 11:46  a etapa 1 foi RENOMEADA para "ACÓRDÃO - EDS"
11/09 11:47  a etapa 2 "ACÓRDÃO - RR" foi criada
```

Ou seja: no dia 8 o fluxo ainda não tinha a etapa "ACÓRDÃO - EDS". A primeira e única etapa se chamava "ACÓRDÃO - RR", e foi ela que o sistema agendou. A segunda etapa só passou a existir hoje, minutos depois do último teste.

Dois pontos secundários confirmados nos registros:

- Os usos de 08/09 não partiram de publicação nenhuma (não há publicação de origem gravada) e ficaram sem processo vinculado. O uso de hoje, 11/09, sim partiu da publicação e já veio com o processo vinculado.
- Renomear uma etapa não muda os prazos já criados antes: eles continuam com o título antigo.

## O que fazer

1. Responder à Jéssica explicando a linha do tempo: agora que o fluxo tem as duas etapas (ACÓRDÃO - EDS e depois ACÓRDÃO - RR), iniciar pela publicação vai criar primeiro o ACÓRDÃO - EDS, e o ACÓRDÃO - RR nasce quando o primeiro for concluído com sucesso.
2. Pedir que ela repita o teste em uma publicação para confirmar.

## Melhorias opcionais para evitar a confusão

Só implemento se você aprovar; nenhuma é necessária para o fluxo funcionar.

- Ao iniciar um fluxo, mostrar na confirmação a lista das etapas ("1. ACÓRDÃO - EDS -> 2. ACÓRDÃO - RR") e qual delas será criada agora, para a pessoa perceber na hora se o fluxo está incompleto.
- Avisar quando o fluxo tiver apenas uma etapa, já que nesse caso não existe "próximo passo" para nascer depois.
- Limpar/cancelar as três execuções antigas de 03/09 e 08/09 que ficaram penduradas em andamento com o título antigo.

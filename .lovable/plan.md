# Etapa seguinte do workflow fica com quem cumpriu a anterior

## Como fica a regra
Quando uma etapa é concluída e o workflow cria a próxima atividade, o responsável é escolhido nesta ordem:

1. **Pessoa escolhida para a etapa ao abrir o workflow**: essa escolha vale primeiro (como já é hoje).
2. **Pessoa fixa do modelo**: se a etapa tem um responsável definido no modelo, ele continua valendo.
3. **Nos outros casos, quem cumpriu a etapa anterior**: isso vale para as regras "Etapa anterior", "Quem iniciou o fluxo" e etapas sem regra.
4. Se não der para saber quem cumpriu a etapa anterior, fica com o responsável da atividade anterior e, depois, com quem abriu o workflow.

A primeira etapa, criada quando o workflow é aberto, não muda: continua com o "Responsável inicial" escolhido.

## Escopo
- Vale para os workflows novos e para as próximas etapas dos workflows que já estão em andamento.
- As atividades que já foram criadas não mudam.
- A importação de workflows do Projuris não muda.
- O número da versão não muda.

## Detalhes técnicos
- `src/lib/workflowExecutor.ts`: `materializarEtapas` passa a receber quem concluiu a etapa de referência. Esse dado vem do usuário da sessão que concluiu a etapa, usando `auth.getUser()` no caminho de conclusão, ou do campo de conclusão do item, quando existir.
- `resolverResponsavelEtapa`: recebe o novo campo `concluidoPor` no contexto. A ordem é: sobrescrita da etapa > `predefinido` com `responsavel_id` > `concluidoPor` > `responsavelAnterior` > `iniciadorId`.
- A sobrescrita por etapa já é aplicada antes, em `mesclarEtapa`/criação. Vou conferir que ela continua prevalecendo.
- Os testes de `resolverResponsavelEtapa` serão atualizados com um caso para cada regra: etapa com pessoa escolhida, etapa com pessoa fixa do modelo, etapa com "Etapa anterior" e etapa com "Quem iniciou o fluxo", estas duas indo para quem cumpriu a etapa anterior.

Pesquisa realizada para o processo 0000755-53.2024.5.11.0001.

Resultado encontrado na Judit/função atual:

```text
Data de julgamento: 27/04/2026
Campo técnico retornado: data_julgamento = 2026-04-27
Tem data de julgamento: S
Tipo de julgamento: Virtual
Relator: MORGANA DE ALMEIDA RICHA
Turma: 5ª Turma
Tribunal: TST
```

O log da função confirmou que ela aplicou a pauta oficial/virtual do TST:

```text
pauta TST virtual aplicada por janela provável: data=2026-04-27
pauta oficial TST aplicada -> data=2026-04-27 tipo=Virtual
```

O problema da tela não é mais a pesquisa em si. O banco ainda está com o valor antigo para essa linha:

```text
dados_benner.data_julgamento = 2026-04-06
dados_benner.tem_data_julgamento = N
dados_benner.tipo_julgamento = Virtual
```

Isso explica por que a tela continua mostrando errado: ela está exibindo o valor persistido antigo, não o retorno mais recente da função.

Plano para corrigir quando você aprovar:

1. Ajustar a sincronização do botão Judit
   - Garantir que, ao clicar em Judit, a data retornada pela função (`2026-04-27`) sobrescreva imediatamente `dados_benner.data_julgamento`.
   - Garantir que `tem_data_julgamento` seja salvo como `S`, não permaneça `N`.
   - Garantir que `tipo_julgamento = Virtual` continue sendo salvo.

2. Corrigir o refresh da tela após o salvamento automático
   - Recarregar o registro atualizado do banco depois do auto-save.
   - Atualizar o estado da tela com os campos de pauta (`tem_data_julgamento`, `data_julgamento`, `horario_julgamento`, `tipo_julgamento`) para não manter valor antigo em memória.

3. Corrigir o mapeamento interno da tela Distribuição TST
   - Incluir os campos de julgamento no tipo/mapeamento usado por `useDistribuicoesTst`, porque hoje esses campos passam como extras, mas não são parte completa do objeto exibido pela tela.
   - Isso evita que a tela reabra ou atualize sem esses campos.

4. Opcionalmente corrigir o registro atual no banco
   - Para este processo específico, atualizar a linha existente para:

```text
tem_data_julgamento = S
data_julgamento = 2026-04-27
tipo_julgamento = Virtual
```

Após essa correção, a tela deve exibir 27/04/2026 para o processo 0000755-53.2024.5.11.0001.
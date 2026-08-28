# Botão Judit na Distribuição TST — diagnóstico e correção

## O que os logs mostram (Kellen Ferreira)

Consultei a tabela `judit_logs` cruzada com `profiles`. A Kellen tem **124 cliques com sucesso**, **17 com "Judit não retornou dados para este processo"** e **1 com "Failed to send a request to the Edge Function"** (esse último é o clique que "não funciona": a Edge Function não respondeu no tempo do navegador).

Nos cliques com sucesso, o padrão é claro — quase todos voltam com `tribunal_selecionado = TRT2/TRT15/TRT3` e resposta de cache, e nesses casos **relator, turma e tipo de recurso vêm vazios**. Exemplos dos últimos dias dela: em 26, 27 e 28/08, de 8 consultas com sucesso, 8 vieram de instância não-TST e 7 sem relator/turma/tipo de recurso.

Caso que fecha o diagnóstico — processo 1002068-91.2023.5.02.0203, em 28/08:
- 20:13:48 — clique normal: resposta de cache, TRT2, relator/turma/tipo de recurso **nulos** → tela preenche pela metade.
- 20:14:22 — mesmo processo com "Forçar atualização": relator "ANTÔNIO FABRÍCIO DE MATOS GONÇALVES", 6ª Turma, Agravo de Instrumento → tela preenchida.

Ou seja: **não é falha aleatória do botão**. Na primeira tentativa a função devolve o cache da instância de origem (TRT), que não tem os campos do TST; a advogada só consegue o dado completo se souber clicar em "Forçar atualização" — e hoje isso não fica óbvio na tela.

Há também um problema de rastreabilidade: o log gravado por esta tela não preenche `user_email`, `origem`, `duracao_ms` nem `tipo_cobranca` (1009 registros com esses campos nulos), o que impede o relatório /consumo-judit de atribuir consumo e impede medir lentidão.

## O que fazer

1. **Segunda tentativa automática quando a resposta vier incompleta.**
   Se a resposta não é do TST (`instancia_tst === false` ou `tribunal_selecionado != TST`) **e** relator, turma e tipo de recurso vierem todos vazios, a tela repete a consulta uma vez com `force_refresh: true`, sem o usuário precisar fazer nada. O toast passa a informar: "Resposta rápida incompleta — buscando dados atualizados do TST…". Só depois disso, se ainda vier vazio, exibe o aviso atual.

2. **Aviso claro quando permanecer incompleto.**
   Substituir o toast informativo por um alerta persistente no cabeçalho do formulário listando quais campos a Judit não trouxe (Relator, Turma, Tipo de recurso, Dossiê), com botão "Forçar atualização" ao lado. Assim a advogada vê o que falta em vez de achar que o botão falhou.

3. **Erro de rede tratado com nova tentativa.**
   Em "Failed to send a request to the Edge Function" (timeout de rede) e em erros 5xx, tentar novamente uma vez após 2s antes de mostrar erro; a mensagem final explica que o processo pode ser consultado de novo em alguns segundos.

4. **"Judit não retornou dados" com mensagem útil.**
   Hoje aparece como erro genérico. Passa a explicar que a base Judit não tem o processo (comum em processos que ainda não subiram ao TST) e que os campos podem ser preenchidos manualmente.

5. **Log completo para auditoria.**
   Passar a gravar `user_email`, `origem` ("distribuicao-tst"), `duracao_ms` e `tipo_cobranca` no insert de `judit_logs` desta tela (reaproveitando `src/lib/juditLog.ts`, que já faz isso), registrando também as tentativas automáticas com uma marca `retry: true`. Isso permite acompanhar no /consumo-judit quem consultou, quanto demorou e quantas consultas precisaram de segunda tentativa.

## Detalhes técnicos

- `src/components/distribuicao-tst/DistribuicaoTstForm.tsx`: extrair a chamada da Judit em uma rotina reutilizável para permitir o retry com `force_refresh`; substituir o insert manual em `judit_logs` (linhas ~710-723) por `logJudit` de `src/lib/juditLog.ts` com `origem: "distribuicao-tst"` e duração medida; adicionar estado para o alerta de campos faltantes.
- Sem alteração na Edge Function `buscar-judit` e sem mudança de schema — a política de cache do backend continua a mesma, o retry é decidido no cliente para não encarecer consultas que já vêm completas.
- Custo: o retry só dispara quando a primeira resposta é inútil, mantendo `com_anexos: false` (cobrança datalake/on-demand, não a de anexos).

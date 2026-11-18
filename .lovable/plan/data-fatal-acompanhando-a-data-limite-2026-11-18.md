# Data fatal acompanhando a data limite

## O que encontrei
Na tela de Prazo, quando se muda a **data base**, as duas datas são recalculadas. Mas quando se muda a **quantidade de dias** ou a **unidade** (úteis/corridos), só a data limite (prevista) muda; a data fatal fica parada no valor antigo. O cálculo automático que roda ao abrir/preencher o prazo também só atualiza a data limite. Por isso o problema aparece "geralmente em prazos" e não em todos os casos.

## O que vou mudar
1. **Regra "andam juntas"**: quando o modelo tem a mesma contagem para limite e fatal (ex.: Manifestação 4 dias úteis + 4 dias úteis), ou quando a fatal ainda está igual à limite, a data fatal passa a seguir a data limite automaticamente.
2. Recalcular a data fatal sempre que mudar **data base, quantidade de dias ou unidade**, nas telas de Prazo e de Tarefa (incluindo a edição de um prazo já salvo).
3. Para equipes que usam datas diferentes (ex.: limite 2 dias antes da fatal), a diferença configurada no modelo é mantida no recálculo — nada muda para elas.
4. Se a pessoa escolher manualmente uma data fatal diferente no calendário, essa escolha é respeitada até ela mexer de novo na data base ou nos dias.

## Testes
Teste da regra: modelo 4du/4du com base 18/11/2026 → limite e fatal 24/11/2026; mudar para 5 dias → ambas 25/11/2026; modelo com fatal diferente mantém a diferença.

## Detalhes técnicos
- Nova função pura em `src/lib/aplicarPadroesModelo.ts` (`calcularFatalAcompanhando`) que decide fatal = limite ou limite + diferença do modelo.
- `PrazoDialog.tsx`: usar a função no `useEffect` de cálculo automático e nos `onChange` de prazo/unidade (hoje só atualizam `dataLimite`).
- `NovaTarefaDialog.tsx`: mesma lógica onde `data_vencimento` é recalculada.
- Sem mudanças no banco.

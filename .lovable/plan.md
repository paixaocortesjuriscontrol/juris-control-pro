# Distribuição automática não retirou os processos da Dra. Camilla

## O que os dados mostram (verificado no banco)

- Dra. Camilla Gomes (`4fb5f99d…`): **266 vínculos**, todos válidos e ativos. 263 deles foram criados em **03/08 às 20h** (distribuição em lote anterior) e 3 em ações individuais. **Nenhum vínculo dela foi apagado hoje.**
- Dra. Tatiana Hollanda (`cd8a5000…`): **283 vínculos**, sendo **76 criados hoje às 20h** (a redistribuição em questão).
- Cruzando os dois conjuntos: **zero interseção**. Os 76 processos que foram para a Dra. Tatiana **nunca estavam vinculados à Dra. Camilla** (nem pelo mesmo número de processo em outra linha). Todos vêm da aba `46978-41171 (13)`.
- Conclusão: a opção "Substituir responsáveis existentes" apagou os vínculos apenas dos 76 IDs processados — e nenhum deles era da Dra. Camilla. Logo, os processos redistribuídos não foram os processos dela; por isso o número 266 não caiu.
- **Não é possível confirmar qual conjunto foi enviado ao diálogo** (seleção da tela x filtro atual), porque a distribuição automática **não grava nada na auditoria de lotes** — não há registro do lote das 20h em `auditoria_lotes_admin_tst`.

## Implementação

1. **Auditoria da distribuição automática** (prioridade): registrar cada execução em `auditoria_lotes_admin_tst` com tipo de operação próprio, usuário, quantidade, origem dos IDs (seleção x filtro), resumo dos filtros aplicados, advogados de destino e — o ponto central — **quais responsáveis foram removidos e quantos vínculos de cada um**. Isso torna qualquer divergência futura rastreável em segundos.
2. **Pré-visualização antes de executar**: ao clicar em Distribuir, mostrar um resumo de confirmação com quantos processos serão afetados, de quais responsáveis atuais eles sairão (ex.: "Camilla Gomes: 76, Sem responsável: 0") e para quem irão. Assim fica evidente na hora se o conjunto escolhido não é o esperado.
3. **Deixar a origem explícita no diálogo**: destacar visualmente se a operação vai usar "somente os X selecionados" ou "todos os Y do filtro atual", incluindo os responsáveis presentes nesse conjunto, evitando redistribuir por engano um recorte diferente do pretendido.
4. **Modo "Transferir de um advogado para outro"** (o fluxo que estava sendo tentado): escolher o advogado de origem, quantos processos transferir (ou todos) e os advogados de destino; o sistema seleciona os vínculos daquele advogado, remove-os e recria nos destinos, garantindo que o total da origem caia exatamente na quantidade transferida.
5. **Atualizar os contadores por responsável após a execução**: incluir o recarregamento dos cartões "Por responsável" na rotina de refresh da tela (hoje ela recarrega lista, abas e totalizadores, mas não esses cartões), para que os números novos apareçam sem recarregar a página.

## Detalhes técnicos

- `src/components/distribuicao-tst/DistribuirAutomaticoDialog.tsx`: consultar `dados_benner_responsaveis` dos IDs alvo antes do delete para montar o resumo "de quem sai", exibir a confirmação, executar a operação em lotes como hoje e registrar a auditoria ao final; acrescentar o modo transferência por advogado de origem.
- `src/pages/DistribuicaoTst.tsx`: incluir `refetchResponsavelCounts()` em `handleRefresh` e aguardar o refresh no `onSuccess` do diálogo.
- Sem mudança de estrutura de banco: `auditoria_lotes_admin_tst` já suporta o registro; nenhuma alteração de RLS é necessária (as políticas de exclusão/inserção dos vínculos já funcionam corretamente).

## Resultado esperado

Toda redistribuição passa a mostrar antes o que será alterado, gravar auditoria completa depois e atualizar os contadores na hora — e a transferência da Dra. Camilla para a Dra. Tatiana passa a reduzir o total dela exatamente na quantidade transferida.

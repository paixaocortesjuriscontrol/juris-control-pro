# Marcadores do Projuris → Etiquetas do Juris Control

## Como funcionavam no Projuris
- **Marcador** = etiqueta com nome (ex.: AGUARDANDO LIMINAR, OUTLIER, CAPTURA, URGENTE, LGPD). 242 cadastrados, só **47 ativos**; todos os 8.867 vínculos usam marcadores ativos.
- **Vínculo**: cada marcador é colocado em um **processo** (5.383 vínculos) ou em uma **tarefa** (3.484 vínculos). Um item pode ter vários marcadores, com ordem de exibição (1º, 2º, 3º...).
- É exatamente o que nossas **etiquetas** já fazem (processos e itens, várias por item). Não precisa de tela nova.

## O que será feito
1. Novo quadro **"Marcadores do Projuris"** na tela Migração Projuris (só admin), recebendo `marcador` e `marcadorvinculomodulo` (aceita nomes com sufixo, ex. "marcador-2.csv").
2. Cada marcador ativo vira uma etiqueta na **Coordenação Santander Cível**, com o mesmo nome; se já existir uma etiqueta com esse nome lá (ex. CAPTURA), reaproveita, sem duplicar.
3. Vínculos de processo e tarefa são ligados aos registros já migrados (pela chave do Projuris). Os que não forem encontrados aparecem contados no resumo, sem erro.
4. Marcadores inativos (195) não entram.
5. Rodar de novo pula o que já entrou; botão **Desfazer** remove só o que essa importação criou.
6. A etiqueta CAPTURA continua sendo controlada pelo Acompanhamento Especial: vínculos CAPTURA do Projuris **não** serão importados para não conflitar com essa regra.

## Detalhes técnicos
- Reusa `etiquetas` / `etiquetas_itens` (entidade `processo` ou `tarefa`); sem migração de banco.
- Mapeamento: `cdmodulo 3 → processo`, `4 → tarefa`, via `migracoes_projuris_itens` (tipo + chave_externa = cdregistrovinculo).
- Auditoria em `migracoes_projuris` / `migracoes_projuris_itens` com tipo `marcador` e `marcador_vinculo`; desfazer apaga por esses registros.
- Leitura CSV com o mesmo helper `lerCsvPontoVirgula`; testes `node:test` para o mapeamento e filtro de inativos/CAPTURA.

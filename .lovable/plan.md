# Importar planilha "PRAZOS EQUIPE – atualizado até 24/09/26" na Coordenação GOL

## O que a planilha tem
5 abas (ALICE, SUELEN, SARAH, LAVÍNIA, BEATRIZ): cerca de 9.970 prazos em 1.719 processos diferentes, com data fatal entre jan/2023 e out/2026.

## O que será feito
1. **Conferir quem já existe**: comparar os 1.719 números com o banco (só os dígitos). Os que já existem não são duplicados: só recebem os prazos e ficam ligados à GOL.
2. **Cadastrar os processos novos** em Processos e Casos, na Coordenação GOL, preenchidos com a Judit (tribunal, vara, valor da causa, data de distribuição, andamentos). Reclamante e cliente vêm da planilha ("GOL" vira "GOL LINHAS AÉREAS S.A."). Se a Judit não encontrar o processo, ele é cadastrado só com os dados da planilha.
3. **Vincular os responsáveis**: associar os nomes da planilha (Alice, Suelen, Sarah, Lavínia, Beatriz, Isabela, Victor, Fernanda, Gabrielly, Emilly…) aos perfis da GOL. Nomes duplos (ex.: LAVÍNIA/SUELEN) ficam com **os dois como responsáveis**.
4. **Cadastrar todos os prazos como pendentes** no Painel de Controle, exatamente como na planilha: providência como título, data fatal, observações na descrição, origem "planilha", sem descartar repetidos da própria planilha só pela data.
5. **Conferência final** no banco: total de processos novos/existentes, quantos com Judit, prazos por responsável e lista dos que não tiveram correspondência.

## Pontos de atenção
- A consulta à Judit tem custo por processo e é demorada: o volume (possivelmente mais de 1.000 processos novos) será processado em lotes.
- Se algum nome da planilha não tiver perfil na GOL, aviso antes e o prazo fica atribuído à Emilly até você indicar a pessoa.
- Cerca de 9.500 prazos já vencidos entrarão como pendentes, o que vai deixar o Painel da GOL com muitos itens atrasados.

## Detalhes técnicos
- Função temporária de importação (lotes pequenos para evitar timeout), usando `busca-judit-processos-e-casos`, gravando em `processos`, `processos_responsaveis`, `movimentacoes`, `tarefas` + `tarefa_responsaveis`; coordenacao_id f5a0ac48-…; criado_por Emilly. Origem 'planilha' (ignorada pela trava de duplicados). Função apagada ao final.

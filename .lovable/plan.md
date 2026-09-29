# Importar planilha "PRAZOS EQUIPE – atualizado até 24/09/26" na Coordenação GOL

## O que a planilha tem
5 abas (ALICE, SUELEN, SARAH, LAVÍNIA, BEATRIZ): cerca de 9.970 prazos em 1.719 processos diferentes, com data fatal entre jan/2023 e out/2026.

## O que será feito
1. **Conferir quem já existe**: comparar os 1.719 números com o banco (só os dígitos). Os que já existem não são duplicados: só recebem os prazos.
2. **Cadastrar os processos novos** em Processos e Casos, na Coordenação GOL, **só com os dados da planilha** (número, reclamante, cliente, UF, valor da causa). "GOL" vira "GOL LINHAS AÉREAS S.A.". Sem consulta à Judit desta vez.
3. **Vincular os responsáveis**: associar os nomes da planilha (Alice, Suelen, Sarah, Lavínia, Beatriz, Isabela, Victor, Fernanda, Gabrielly, Emilly…) aos perfis da GOL. Nomes duplos (ex.: LAVÍNIA/SUELEN) ficam com **os dois como responsáveis**.
4. **Cadastrar todos os prazos como pendentes** no Painel de Controle, exatamente como na planilha: providência como título, data fatal, observações na descrição, origem "planilha".
5. **Conferência final** no banco: processos novos/existentes, prazos por responsável e lista dos que não tiveram correspondência.

## Pontos de atenção
- Se algum nome da planilha não tiver perfil na GOL, aviso e o prazo fica atribuído à Emilly até você indicar a pessoa.
- Cerca de 9.500 prazos já vencidos entrarão como pendentes, o que vai deixar o Painel da GOL com muitos itens atrasados.

## Detalhes técnicos
- Função temporária de importação em lotes pequenos, gravando em `processos`, `processos_responsaveis`, `tarefas` + `tarefa_responsaveis`; coordenacao_id f5a0ac48-…; criado_por Emilly; origem 'planilha'. Função apagada ao final.

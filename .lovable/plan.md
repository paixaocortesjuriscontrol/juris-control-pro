# Importar planilha "PRAZOS EQUIPE – atualizado até 24/09/26" na Coordenação GOL

## O que a planilha tem
5 abas (ALICE, SUELEN, SARAH, LAVÍNIA, BEATRIZ): cerca de 9.970 prazos em 1.719 processos diferentes, com data fatal entre jan/2023 e out/2026.

## O que será feito
1. **Conferir quem já existe**: comparar os 1.719 números com o banco (só os dígitos). Os que já existem não são duplicados: só recebem os prazos.
2. **Cadastrar os processos novos** em Processos e Casos, na Coordenação GOL, **só com os dados da planilha** (número, reclamante, cliente, UF, valor da causa). "GOL" vira "GOL LINHAS AÉREAS S.A.". Sem consulta à Judit.
3. **Vincular os responsáveis**: usar a coluna Responsável e associar aos perfis da GOL (Alice, Suelen, Sarah, Lavínia, Beatriz, Isabela, Victor, Fernanda, Gabrielly, Emilly…). Nomes duplos (ex.: LAVÍNIA/SUELEN) ficam com **os dois como responsáveis**. **Prazo sem responsável fica com a pessoa dona da aba** (ex.: toda a aba ALICE, que não tem essa coluna, vai para Alice).
4. **Cadastrar todos os prazos** no Painel de Controle: data fatal antes de 29/09/2026 entra como **cumprido**; de 29/09/2026 em diante entra como **pendente**. Providência como título, data fatal, observações na descrição, origem "planilha".
5. **Conferência final** no banco: processos novos/existentes, prazos por responsável e situação, e lista dos nomes sem correspondência.

## Pontos de atenção
- Se algum nome da planilha não tiver perfil na GOL, aviso antes de gravar para você indicar a pessoa.

## Detalhes técnicos
- Função temporária de importação em lotes pequenos, gravando em `processos`, `processos_responsaveis`, `tarefas` + `tarefa_responsaveis`; coordenacao_id f5a0ac48-…; criado_por Emilly; origem 'planilha'. Função apagada ao final.

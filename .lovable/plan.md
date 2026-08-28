# Aplicar pessoas fixas nos itens importados hoje (Coordenação Dra. Beatriz Costa)

## Situação verificada no banco

Configuração atual de pessoas fixas da coordenação:
- Prazo: envolvida fixa Beatriz Costa (nenhum responsável fixo)
- Tarefa: envolvida fixa Beatriz Costa (nenhum responsável fixo)
- Audiência: responsável fixo Mayara Gonçalves; envolvidos fixos Beatriz Costa, Estephany Cordeiro e Jéssica Alves

Itens criados hoje (27/08) por importação de planilha nessa coordenação:
- 25 audiências (origem `pauta_excel`, 22:54–22:55 UTC)
- Nenhum prazo e nenhuma tarefa vieram de planilha hoje (os de hoje são de `analise_djen` e cadastro manual)

Nas 25 audiências:
- Responsável Mayara Gonçalves: já presente em todas
- Envolvida Beatriz Costa: já presente em todas
- Envolvida Estephany Cordeiro: faltando em 25
- Envolvida Jéssica Alves: faltando em 25

## O que será feito

1. Inserir, nas 25 audiências importadas hoje via planilha, os vínculos de envolvido faltantes: Estephany Cordeiro e Jéssica Alves.
2. Nada é removido: responsáveis e envolvidos já existentes permanecem intactos (modo somar).
3. Prazos e tarefas: nenhuma alteração, pois nenhum foi importado por planilha hoje — e os fixos de Prazo/Tarefa (Beatriz Costa) já estão aplicados nos itens existentes.
4. Reconferência após a execução: confirmar que as 25 audiências passam a ter os 3 envolvidos fixos + Mayara como responsável.

## Detalhes técnicos

- Alteração apenas de dados (sem mudança de schema e sem mudança de código).
- Inserção em `audiencia_envolvidos` (`audiencia_id`, `usuario_id`) para as audiências de `audiencias_detectadas` com `coordenacao_id` da Beatriz Costa, `origem = 'pauta_excel'` e `created_at >= '2026-08-27'`, usando `NOT EXISTS` para evitar duplicidade.
- Consulta de verificação por audiência ao final, contando responsáveis e envolvidos.

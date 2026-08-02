# Limpeza total — Coordenação Dra. Janaina Catunda

Apagar **todas as tarefas** e **todos os processos e casos** que pertencem exclusivamente à coordenação da Dra. Janaina Catunda (id `9d4e11e2-e81f-45ef-a8d4-977ddf371e18`), junto com tudo que estiver vinculado a esses registros. Nenhuma outra coordenação é tocada.

## Volume confirmado no banco

- 9.180 tarefas
- 2.954 processos
- 22 audiências detectadas
- 1 evento de agenda

## O que será removido

1. Tarefas da coordenação e seus dependentes (comentários, responsáveis, envolvidos, vínculos com publicações, tarefas relacionadas, documentos anexados).
2. Processos da coordenação e seus dependentes: audiências detectadas, intimações detectadas, distribuições encontradas, partes, testemunhas, responsáveis, movimentações, pedidos, custas, depósitos recursais, documentos e downloads, monitoramentos, consultas Judit, alertas e vínculos de eventos.
3. Vínculos de eventos/agenda com esses processos (o evento em si é desvinculado, não apagado).

## O que será preservado

- Publicações do DJEN da coordenação: permanecem na Análise DJEN, apenas com o vínculo ao processo apagado zerado.
- Cadastros da coordenação: membros, clientes, etiquetas, modelos de título, configurações de monitoramento e notificações.
- Qualquer registro de outras coordenações.
- Registros com `coordenacao_id` nulo não são incluídos.

## Como será executado

Uma única operação de dados em ordem segura de dependências:

```text
1. desvincular publicacoes_djen / publicacoes_djen_descartadas / repositorio_documentos / pautas_tst / eventos_agenda (processo_id -> NULL)
2. apagar audiencias_detectadas, intimacoes_detectadas, distribuicoes_encontradas dos processos alvo
3. apagar tarefas da coordenação (cascata cobre comentários, responsáveis, envolvidos, vínculos)
4. apagar processos da coordenação (cascata cobre partes, testemunhas, movimentações, documentos, pedidos, custas, depósitos, monitoramentos)
```

Antes e depois da execução serão exibidas as contagens, para conferência do total efetivamente apagado.

## Aviso

A operação é irreversível — não há lixeira nem desfazer. Ao aprovar, confirmo a exclusão definitiva dos 9.180 itens de tarefa e dos 2.954 processos dessa coordenação.

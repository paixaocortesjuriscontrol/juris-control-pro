# Responsável de cada etapa do workflow: qualquer pessoa da coordenação

## Situação atual
Na janela da etapa, o campo **Responsável** mostra só regras ("Quem iniciou o fluxo", "Responsável da etapa anterior", "Responsáveis predefinidos"). A lista de pessoas só aparece quando se escolhe "Responsáveis predefinidos" — por isso parece que não dá para escolher alguém.

## O que muda
1. O campo **Responsável** passa a listar, no mesmo menu:
   - Quem iniciou o fluxo
   - Responsável da etapa anterior
   - Todas as pessoas da coordenação do workflow (coordenador e membros), em ordem alfabética, com cargo, e com busca por nome.
2. Escolhendo uma pessoa, ela vira o responsável da etapa. Logo abaixo aparece "+ Adicionar outro responsável" para incluir mais pessoas da coordenação, se quiser.
3. Quem já tem acesso a mais de uma coordenação continua podendo trocar a coordenação da lista.
4. No resumo das etapas, aparece o nome da pessoa escolhida (em vez de só "Responsáveis predefinidos").
5. Etapas já criadas continuam iguais: as de "Quem iniciou" seguem assim; as predefinidas mostram as pessoas já salvas.

## Detalhes técnicos
- Só `src/components/workflow/WorkflowEditor.tsx`. Escolher pessoa grava `regra_responsavel = "predefinido"` + `responsaveis = [id]`; reaproveita `useUsuariosCoordenacao` e a gravação existente em responsáveis da etapa. Sem mudança de banco ou permissões.

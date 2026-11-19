# Responsável escolhido ao iniciar o workflow

## O que foi confirmado
A reclamação da Lis procede. Em 19/11 ela iniciou 3 workflows na Santander Cível: às 08h30 e às 08h43 para a Sanny e às 08h33 para a Julia. Os 3 prazos foram criados com **ela** como responsável. Depois ela trocou o responsável à mão, às 08h36 e às 08h52 (BRT).

**Causa:** a primeira etapa desses workflows tem a regra "Quem iniciou o fluxo". Essa regra passa por cima da pessoa escolhida em "Responsável inicial", por isso o prazo ficava com quem abriu o workflow. Isso não tem relação com responsáveis fixos.

## O que muda
- A pessoa escolhida em **Responsável inicial**, ou nos responsáveis da etapa, sempre vale para as atividades criadas ao iniciar o workflow, qualquer que seja a regra da etapa.
- Sem escolha, a regra da etapa continua valendo: quem iniciou, a etapa anterior ou a pessoa pré-definida.
- As etapas seguintes continuam seguindo a regra de cada uma.
- Teste automático: com a regra "Quem iniciou", se a Lis escolhe a Sanny, a responsável é a Sanny; sem escolha, é a Lis.

## Fica de fora
- As atividades já criadas não mudam, porque a Lis já corrigiu as dela.

## Detalhe técnico
Em `resolverResponsavelEtapa` (`src/lib/workflowExecutor.ts`), dar prioridade a `responsavelInicial` sobre `iniciador` e `etapa_anterior` nas etapas criadas ao iniciar o fluxo. Para isso, passar um sinal de "início" pelo `useIniciarWorkflow`. O avanço de etapa não muda.

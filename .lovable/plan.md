# Coordenações visíveis para o Assistente de Coordenador

## Situação atual (conferida no código)
- Quem tem o **perfil geral** Assistente de Coordenador vê **todas** as coordenações nas listas do Painel de Controle, de Minha Agenda, da Central de Delegação e de Indicadores.
- Na delegação de tarefa, quem tem o cargo Coordenador ou Assistente de Coordenador vê **todas** as coordenações, seja pelo perfil geral ou pelo cargo numa coordenação.
- Quem é Assistente de Coordenador só pelo **cargo numa coordenação** vê apenas as próprias coordenações nas demais listas.

## Decisão
Como não houve escolha, **nada será alterado**. A regra atual continua valendo.

Se quiser restringir depois, a mudança seria tirar o Assistente de Coordenador da visão ampla em `podeVerTodasCoordenacoes` (`useUserRole`) e em `coordenadorGlobal`/`podeDelegar` (`src/lib/coordenacoesDoUsuario.ts`), deixando essa visão para Admin, Coordenador e Assistente Jurídico Geral.

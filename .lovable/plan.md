# Eventos visíveis a todos os membros no modo Escritório

## Regra
Um membro da coordenação vê todos os eventos dela quando a "Visão completa do Escritório" está ligada nessa coordenação. Com a opção desligada, continua a regra de hoje: só quem criou, é responsável, envolvido ou participante, além de coordenadores e administradores.

## O que muda
- Ajustar a permissão de leitura dos eventos no banco: liberar quem é membro de uma coordenação com a visão completa ligada para os eventos dessa coordenação.
- Editar continua como hoje. A regra nova vale só para ver.
- Não mudar perfis, cargos, coordenações nem eventos existentes.
- A Coordenação Dra. Beatriz Costa está com a opção desligada, então nada muda nela até um coordenador ligar.

## Conferência
- Contar no banco quantos eventos da Santander Cível Geovana e Giovanna passam a ver.
- Confirmar que eventos de outras coordenações continuam bloqueados.
- Rodar os testes da agenda.

## Detalhes técnicos
- Migração: em `can_access_evento`, somar a condição de que o evento tem `coordenacao_id` com `escritorio_visao_completa = true` e o usuário está em `membros_coordenacao`.
- Aplicar essa condição só na política SELECT, se `can_access_evento` também for usada para UPDATE/DELETE; senão, criar uma função separada só para leitura.

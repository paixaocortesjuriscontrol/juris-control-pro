# Acesso de responsáveis e envolvidos aos eventos

## Diagnóstico
- A agenda pessoal já procura vínculos em `evento_responsaveis`, `evento_envolvidos` e `participantes_evento`.
- A permissão de leitura `can_access_evento` só reconhece criador, coordenador geral e `participantes_evento`.
- Há 200 vínculos de responsáveis/envolvidos sem o vínculo antigo, em 156 eventos. Geovana tem 24 eventos bloqueados e Giovanna, 7.
- A ficha do processo aplica outro filtro por coordenação depois da consulta, podendo ocultar novamente um evento permitido pelo vínculo pessoal.

## Correção
1. Atualizar somente `can_access_evento` para aceitar também responsável e envolvido, mantendo criador, participante, administrador e coordenador geral.
2. Não alterar perfis, cargos, coordenações, participantes ou eventos existentes.
3. Fazer Painel de Controle (Pessoal), Minhas Responsabilidades, Minha Agenda e busca global usarem a permissão corrigida, sem novas consultas de IDs.
4. Na ficha do processo, confiar no acesso já aplicado pelo banco para eventos, removendo apenas o segundo filtro que esconde vínculos válidos de outra coordenação.
5. Manter os avisos automáticos como estão: eles já reúnem responsáveis, envolvidos e participantes.
6. O modo Escritório continua por coordenação até a resposta da pergunta sobre eventos pessoais de outras equipes.

## Verificação
- Conferir no banco que os eventos atualmente bloqueados da Geovana e da Giovanna passam a ser autorizados pela função.
- Confirmar que um evento sem vínculo continua negado.
- Rodar os testes existentes da agenda e verificar a compilação.
- Reabrir as consultas da ficha do processo e das visões pessoais para confirmar que não há outro bloqueio.
- Não será possível validar com o login dessas usuárias; essa limitação será informada.

## Detalhes técnicos
- Migração com `CREATE OR REPLACE FUNCTION public.can_access_evento(uuid, uuid)`, mantendo `SECURITY DEFINER`, `STABLE` e `search_path = public`.
- Ajustes restritos a `ProcessoDetalhes.tsx` e `ProcessoAgendaTab.tsx`; nenhuma regra de edição ou exclusão será ampliada.

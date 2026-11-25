# Painel de Controle em branco (Geovana e outras pessoas)

## Causa confirmada
- Na última hora, o banco cancelou **41 vezes** as duas buscas que montam a agenda do Painel (Escritório e Pessoal), porque passaram do limite de **8 segundos** por busca. A busca dos totais dos cartões também foi cancelada 4 vezes.
- O Painel não mostra agenda incompleta. Quando uma parte falha, ele recusa a página inteira e tenta de novo, e a tela fica em branco.
- **Por que piorou hoje:** em cada tarefa, o banco confere se a pessoa pode vê-la. Para tarefa sem processo, a conferência é rápida. Hoje 86.228 tarefas foram ligadas a processos, e 3.301 voltaram para novembro (a Santander Cível tem 5.656 tarefas no mês). Agora, em cada tarefa, o banco confere o acesso ao processo, e conferências como "é admin?" e "está ativo?" são repetidas linha por linha. Também se repetem por linha a contagem de anexos e os dados do processo.

## O que vou fazer
1. **Conferências feitas uma vez só:** reescrever as regras de leitura de tarefas, anexos e processos para que "é admin/coordenador?" e "está ativo?" sejam calculados uma vez por busca, e não em cada linha. Quem vê o quê continua exatamente igual.
2. **Agenda mais leve:** nas duas buscas da agenda, as tarefas continuam filtradas pelas regras de acesso da pessoa. Já os dados extras (contagem de anexos, processo, responsáveis, nomes) passam a ser montados de uma vez só para as tarefas que ela já pode ver, sem repetir a conferência em cada linha.
3. **Conferir:** medir as duas buscas com o perfil da Geovana (Santander Cível, novembro) antes e depois. A meta é ficar bem abaixo de 8 segundos. Depois, acompanhar o registro do banco para confirmar que os cancelamentos pararam.

Não muda nenhuma tela nem nenhuma permissão.

## Detalhes técnicos
- Políticas: trocar `is_admin_or_coordenador(auth.uid())` e `is_user_active(auth.uid())` por `(SELECT ...)` nas políticas de `tarefas` (ALL "Users can manage prazos…", "Responsaveis e envolvidos…"), `documentos` e `processos_select_scoped`, de modo que virem InitPlan.
- `get_agenda_escritorio` / `get_agenda_pessoal` continuam SECURITY INVOKER para selecionar os IDs, como hoje (os IDs passam pelo RLS). Uma função auxiliar SECURITY DEFINER `_agenda_tarefas_linhas(uuid[])` monta as linhas com docs/processo/responsáveis/perfis. O EXECUTE dela fica revogado de `authenticated`; ela só é chamada de dentro das RPCs, que são SECURITY DEFINER-owner-callable via `GRANT` ao dono. Se isso não for viável, a auxiliar reconfere `coordenacao_id` contra o escopo do chamador.
- Tudo em uma migration, com medição via EXPLAIN ANALYZE simulando o uid dela.
- Registrar a regra em AGENTS.md: a montagem das linhas da agenda não pode repetir checagens por linha.

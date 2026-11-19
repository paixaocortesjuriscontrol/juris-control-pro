# Luiza não consegue trocar responsáveis de audiências (Santander Cível)

## O que foi conferido
- Luiza Cavalcante é Assistente na Santander Cível e tem liberação individual para alterar **audiências**, prazos e tarefas. Ela também está na lista de quem pode mexer em itens de outras pessoas. A permissão da coordenação **não é o problema**.
- Hoje, às 17h24 (horário de Brasília), ela salvou uma audiência. Nenhuma troca de responsável foi registrada nesse salvamento.
- Causa: a regra de acesso que **remove** um responsável de audiência só deixa **administradores e coordenadores** fazerem isso. Para os outros perfis, o sistema não mostra erro, mas também não apaga nada. O responsável antigo continua e parece que "não salvou". Às vezes o novo responsável é acrescentado e a audiência fica com duas pessoas.
- Nos prazos, tarefas, eventos e nos envolvidos das audiências, a troca de pessoas já é liberada a qualquer pessoa conectada. Lá a falha não acontece, mas a regra é aberta demais.

## O que será feito
1. Uma regra única para incluir e retirar responsáveis e envolvidos em **todos os tipos** (audiência, prazo, tarefa, evento, ata): pode quem tem acesso à coordenação do item e liberação em "Quem pode agendar" para aquele tipo (Luiza tem), além de administradores e coordenadores.
2. Em todos os tipos, a tela passa a mostrar um erro quando a troca não for aceita, em vez de parecer que salvou.
3. A versão no menu passa para v10.3.2.

## Fora do escopo
- Não vou alterar a permissão da Luiza nem de nenhuma outra pessoa.
- Audiências já salvas não serão mudadas. Se alguma ficou com dois responsáveis, Luiza poderá corrigir depois da mudança.

## Detalhes técnicos
- Criar uma função SECURITY DEFINER `pode_alterar_participantes(tipo, item_id)`, que resolve a coordenação do item (`audiencias_detectadas`, `tarefas`, `eventos_agenda`) e verifica o acesso e `pode_configurar_agendamento`.
- Usar essa função nas políticas INSERT/DELETE de `audiencias_advogados`, `audiencia_envolvidos`, `tarefa_responsaveis`, `tarefa_envolvidos`, `evento_responsaveis` e `evento_envolvidos`. Hoje só a remoção em `audiencias_advogados` é restrita; as demais aceitam qualquer usuário conectado.
- As inclusões automáticas da etapa do workflow e dos responsáveis fixos continuam funcionando, porque rodam pelos gatilhos do sistema.
- No `sincronizarParticipantesTarefa`, usar `.select()` no delete e tratar como erro quando zero linhas forem removidas.

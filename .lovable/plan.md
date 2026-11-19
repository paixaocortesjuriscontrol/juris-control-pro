# Luiza não consegue trocar responsáveis de audiências (Santander Cível)

## O que foi conferido
- Luiza Cavalcante é Assistente na Santander Cível e tem liberação individual para alterar **audiências**, prazos e tarefas. Ela também está na lista de quem pode mexer em itens de outras pessoas. A permissão da coordenação **não é o problema**.
- Hoje, às 17h24 (horário de Brasília), ela salvou uma audiência. Nenhuma troca de responsável foi registrada nesse salvamento.
- Causa: a regra de acesso que **remove** um responsável de audiência só deixa **administradores e coordenadores** fazerem isso. Para os outros perfis, o sistema não mostra erro, mas também não apaga nada. O responsável antigo continua e parece que "não salvou". Às vezes o novo responsável é acrescentado e a audiência fica com duas pessoas.
- Para envolvidos de audiência e responsáveis de tarefas e prazos, essa restrição não existe.

## O que será feito
1. A remoção de responsável de audiência passa a seguir a mesma regra de quem pode editar a audiência: administrador, coordenador da coordenação ou pessoa com acesso à coordenação da audiência. As travas de "Quem pode agendar" continuam valendo.
2. A tela passa a mostrar um erro quando uma remoção não for aceita, em vez de parecer que salvou.
3. A versão no menu passa para v10.3.2.

## Fora do escopo
- Não vou alterar a permissão da Luiza nem de nenhuma outra pessoa.
- Audiências já salvas não serão mudadas. Se alguma ficou com dois responsáveis, Luiza poderá corrigir depois da mudança.

## Detalhes técnicos
- Trocar a política DELETE de `audiencias_advogados` (`is_admin_or_coordenador`) por uma regra baseada em `audiencias_detectadas.coordenacao_id`, usando a mesma função de acesso à coordenação das outras políticas. Também respeitar `pode_configurar_agendamento(auth.uid(), coordenacao_id, 'audiencia')`.
- No `sincronizarParticipantesTarefa`, usar `.select()` no delete e tratar como erro quando zero linhas forem removidas.

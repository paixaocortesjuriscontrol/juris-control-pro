# Liberar alteração de datas para o Dr. Jhonatan (Santander Cível)

## O que foi verificado
- A reclamação procede. Na Coordenação Santander Cível, em "Quem pode reagendar", Prazo está limitado a uma lista de 25 pessoas. Tarefa (24 pessoas) e Audiência (23 pessoas) também têm listas.
- O Dr. Jhonatan Gonçalves é coordenador da Santander Cível, mas não está em nenhuma dessas listas. Por isso o sistema trava as datas para ele.
- Hoje, a única pessoa que passa por cima dessa regra é o administrador. Coordenador não passa.

## O que será feito
1. **Coordenador sempre pode alterar datas na própria coordenação**, como o Dr. Jhonatan pediu ("perfil gerencial"). Isso vale para Prazo, Tarefa, Audiência, Evento e Parcelamento, em todas as telas que já usam essa regra (painel lateral, prazo, evento e audiência). Coordenadores de outras coordenações continuam sujeitos às regras daquela equipe.
2. Na tela "Quem pode reagendar" da coordenação, aparece o aviso: "Coordenadores e administradores sempre podem alterar datas".
3. A lista configurada pela equipe continua igual para os demais cargos. Ninguém é retirado dela.

## Detalhes técnicos
- `src/hooks/usePodeReagendar.ts`: além de `role === "admin"`, liberar quando o usuário tem cargo `coordenador` em `membros_coordenacao` na coordenação do item, usando os dados já carregados por `useCoordenacoesDoUsuario`, sem consulta nova.
- `PermissoesReagendamentoDialog.tsx`: incluir o aviso.
- Teste unitário: coordenador da própria coordenação pode alterar; coordenador de outra coordenação fora da lista não pode; perfil comum fora da lista não pode.
- Sem mudança no banco de dados.

# Corrigir erro ao alterar o nome do cliente (Processos e Casos)

## O que está acontecendo

A mensagem "Cannot coerce the result to a single JSON object" não é um bug de tela: é o banco recusando a gravação.

Confirmei as regras de acesso da tabela de clientes:

- Ver cliente: administrador, coordenador, usuário vinculado ao cliente **ou** quem é responsável/membro da coordenação de um processo daquele cliente.
- **Criar, alterar e excluir cliente: somente administrador ou coordenador.**

Ou seja, a advogada consegue ver e selecionar o cliente, clica em "Alterar nome", a alteração é bloqueada, nenhuma linha volta e o código — que exige exatamente um registro de retorno — estoura esse erro técnico em vez de avisar "sem permissão".

## O que vai mudar

1. **Permitir que o advogado responsável / membro da coordenação altere o cliente dos processos dele.** Nova regra de alteração na tabela de clientes: além de administrador e coordenador, pode alterar quem está ativo e é responsável por um processo daquele cliente ou é membro da coordenação desse processo. Mesma lógica já usada hoje para *ver* o cliente.
2. **Permitir o cadastro de novo cliente** para usuários ativos com perfil de advogado (além de admin/coordenador), já que o botão "Novo" ao lado do seletor de cliente foi feito para esse fluxo. Excluir cliente continua restrito a administrador e coordenador.
3. **Mensagem clara em vez de erro técnico.** No diálogo de cliente, tratar retorno vazio como falta de permissão e exibir "Você não tem permissão para alterar este cliente. Fale com o coordenador.", em vez de "Cannot coerce the result to a single JSON object".

## Detalhes técnicos

- Migração: substituir a policy `clientes_update_admin` por uma que aceite `is_admin_or_coordenador(auth.uid())` OR (`is_user_active(auth.uid())` AND o id do cliente aparecer em `processos` com `advogado_responsavel_id = auth.uid()` ou `coordenacao_id` entre as coordenações do usuário em `membros_coordenacao`) — espelhando o `USING` de `clientes_select_scoped`, com o mesmo predicado em `WITH CHECK`. Ajustar `clientes_insert_admin` para também aceitar usuário ativo com papel de advogado.
- A policy antiga `ALL` ("Admins and coordenadores can manage clientes") permanece, pois é permissiva e não bloqueia.
- `src/components/clientes/ClienteDialog.tsx`: trocar `.single()` por `.maybeSingle()` nos caminhos de update e insert e, quando `data` vier nulo sem erro, lançar erro amigável de permissão.

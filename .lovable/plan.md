# Card "Usuários por coordenação" no menu Administração

## O que o usuário verá
Na tela **Administração**, um novo card **"Planilha de usuários e cargos"** com o botão **Gerar Excel**. O arquivo baixado (`usuarios_por_coordenacao_DD-MM-AAAA.xlsx`) terá:

**Aba 1 – Resumo por usuário:** nome, e-mail, perfil geral, situação (ativo/inativo), coordenações em que participa, total de processos como responsável, como envolvido e total geral.

**Aba 2 – Por coordenação:** uma linha por usuário em cada coordenação: coordenação, usuário, cargo na coordenação, nº de processos como responsável e como envolvido naquela coordenação. Agrupado por coordenação com subtotal.

**Aba 3 – Resumo das coordenações:** coordenação, nº de membros por cargo, total de processos vinculados.

Visual profissional: Calibri, cabeçalho colorido fixo, filtros automáticos, colunas ajustadas, linhas zebradas, datas DD/MM/AAAA, título e data de geração em BRT.

## Regras
- Card visível só para administradores (como os demais da tela).
- Conta processos distintos; vínculos inativos não entram.
- "Responsável"/"Envolvido" vêm do papel registrado no vínculo do processo.
- Nada é alterado no banco; apenas leitura.

## Detalhes técnicos
- Novo `src/lib/exportarUsuariosCoordenacoes.ts`: lê `profiles`, `user_roles`, `coordenacoes`, `membros_coordenacao` e `processos_responsaveis` (ativo=true) em lotes paginados de 1000; agrega no navegador; gera com a lib de planilhas já usada no projeto.
- Card em `src/pages/Administracao.tsx` com estado de carregamento e toast de erro.
- Teste unitário da agregação (contagem distinta por papel e por coordenação).

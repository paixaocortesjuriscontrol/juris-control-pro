# Daiane Souza: prazo não fica como "Concluído"

## O que já foi confirmado
- O último salvamento dela foi em 27/10, às 10h02 (Brasília): a reclamação chegou às 10h05.
- Nos 7 prazos que ela salvou entre 26/10 e 27/10, a gravação chegou com a situação **"Pendente"**. Só a data-base mudou, sempre para o dia atual.
- Não houve recusa: ela tem permissão, não há bloqueio na coordenação e nenhum erro foi registrado.
- Também não há baixa salva no controle de itens que se repetem.
- Ou seja, a tela mostra "sucesso", mas envia "Pendente". **A reclamação procede**: o problema está na tela, não na permissão.

## Causa ainda não confirmada (hipóteses)
1. A tela pode estar tratando o prazo como item que se repete. Nesse caso ela esconde a situação e grava sem ela. Esses prazos vieram da planilha com um campo de repetição preenchido, e isso pode enganar a tela.
2. A situação escolhida pode estar voltando para "Pendente" antes de salvar, por exemplo depois de anexar o arquivo. Ela anexa um documento logo antes de cada salvamento.
3. A lista de situações pode estar filtrando "Cumprido" para o perfil dela, deixando outra opção marcada.

## Passos
1. Entrar no sistema como Daiane (vai pedir sua autorização) e repetir o caminho dela: abrir o prazo, mudar para "Concluído", anexar um arquivo e salvar. Depois conferir no banco o que foi gravado.
2. Corrigir a causa encontrada:
   - Hipótese 1: só considerar "repete" quando o prazo estiver de fato marcado como recorrente.
   - Hipótese 2: não deixar a situação escolhida voltar ao valor antigo ao anexar ou recarregar.
   - Hipótese 3: garantir que "Cumprido" apareça para quem pode concluir.
3. Impedir "sucesso falso": depois de salvar, conferir a situação gravada. Se for diferente da escolhida, mostrar um erro claro.
4. Pedir que ela teste de novo. Os 7 prazos não serão alterados por mim.

## Detalhes técnicos
- Arquivos: `src/components/prazos/PrazoDialog.tsx`, `src/components/agenda/EdicaoItemPanel.tsx`, `src/lib/baixaOcorrencia.ts` (`isOcorrenciaRecorrente`), `src/hooks/usePrazos.ts` (`useUpdateTarefa` com `.select()` para confirmar a linha).
- Teste: o prazo com `recorrente=false` não deve ser tratado como ocorrência. Ao salvar com "cumprido", o envio precisa ter `status: "cumprido"`.

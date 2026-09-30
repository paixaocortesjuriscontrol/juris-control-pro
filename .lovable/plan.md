# Importar Processos (Dra. Beatriz Costa): não duplicar e não mexer nos existentes

## O que a conferência mostrou
- A importação procura o processo na base pelo **texto exato** do número. Se o número estiver escrito de outro jeito (com ou sem pontos e traços, com espaço), o processo não é encontrado e é cadastrado de novo.
- O mesmo processo em duas linhas ou abas da planilha, escrito de jeitos diferentes, entra duas vezes.
- Quando acha o processo, regrava os dados dele, troca a coordenação para a Dra. Beatriz Costa e pode apagar campos que estão vazios na planilha.

## O que será feito
1. Comparar sempre **só os dígitos** do número, na planilha e em todos os processos do sistema, de todas as coordenações.
2. **Processo que já existe não é alterado:** não muda dados, coordenação, advogado, cliente nem responsáveis. Na lista do resultado, aparece como "Já existia — não alterado".
3. Processo repetido na planilha entra uma vez. As outras linhas aparecem na lista como "Repetido na planilha".
4. Logo antes de gravar, o sistema confere de novo se o processo já existe, para não duplicar se outra pessoa estiver importando ao mesmo tempo.
5. O resumo final mostra quantos processos foram cadastrados, quantos já existiam e quantos estavam repetidos.
6. O texto da tela deixa de dizer "Processos existentes são atualizados" e passa a dizer "Processos que já existem não são alterados".
7. Nada que já está gravado é apagado.

## Detalhes técnicos
- `src/components/importar/BeatrizCostaImportTab.tsx`:
  - Chave do `validMap` passa a ser `onlyDigits(numero)`. As linhas repetidas ganham o status "repetido".
  - A busca de existentes é feita pelos dígitos (RPC `find_processo_by_digits` ou comparação dos dígitos em lotes), em vez de `.in("numero", ...)`.
  - O ramo `update` é removido: quando o processo existe, a linha é só marcada como "já existia" e nada é gravado.
  - O sistema confere de novo pelos dígitos antes de cada `insert`.
  - Novos contadores e novo texto de descrição na tela.

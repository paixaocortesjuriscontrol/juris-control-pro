# Acelerar a leitura da planilha de pautas

## Problema
Na leitura, o sistema faz uma consulta separada para cada linha da planilha, para descobrir se aquele processo existe. Uma planilha com cerca de 2.000 pautas faz cerca de 2.000 consultas, uma depois da outra. Por isso demora vários minutos.

## O que muda
- O sistema lê todas as abas de uma vez e junta os números de processo sem repetição.
- Depois, procura esses processos em poucos grupos grandes (500 números por vez), em vez de um por um.
- Com essa lista pronta, cada pauta é ligada ao processo na hora, sem consultar de novo.
- A gravação passa de 50 para 200 pautas por vez.
- A barra de progresso e o resultado da importação continuam iguais. A barra mostra três etapas: "Lendo planilha", "Localizando processos" e "Gravando aba X".

O que é importado e a regra de substituir a aba inteira não mudam. A expectativa é que a importação passe de vários minutos para poucos segundos.

## Detalhes técnicos
- `src/components/pautas-tst/PautasTstImport.tsx`:
  - 1ª passada: monta `records` de todas as abas sem `await` e reúne um `Set` com os números de processo.
  - Busca `processos.select("id, numero").in("numero", chunk)` em blocos de 500, com até 4 blocos em paralelo, e monta um `Map numero→id`.
  - Preenche `processo_id` e as contagens de processos vinculados a partir do Map.
  - Mantém o delete por `aba_origem` e grava em lotes de 200.
  - O progresso passa a medir as etapas de busca e de gravação.

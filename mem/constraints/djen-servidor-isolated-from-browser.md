---
name: DJEN Servidor isolated from Browser
description: monitor-servidor engines and progress UI must not read/write publicacoes_djen; only publicacoes_djen_servidor
type: constraint
---
DJEN Servidor é uma estrutura **separada** que vai substituir o DJEN Browser. Regras:

- `monitor-servidor/engines/paralela.js` e qualquer resgate/persistência do Servidor **NÃO** podem ler nem escrever em `publicacoes_djen`. Só `publicacoes_djen_servidor`.
- Reaproveitamento entre coordenações no Servidor olha apenas `publicacoes_djen_servidor`.
- Lacunas no Servidor devem ser corrigidas melhorando a consulta/validação via API PJE Comunica (VPS), nunca copiando do Browser.
- A única exceção é o painel "Comparador Servidor × Browser" (`src/hooks/useDjenServidor.ts` `useComparadorAnalise`), que existe justamente para comparar as duas estruturas — leitura visual, não influencia gravação.
- Cores dos cards de tribunal: `executando`=azul, `concluido` com novas/duplicadas>0 = verde, `concluido` zerado = neutro, `erro`=vermelho, `cancelado`=amarelo.
- Barra global de progresso deve somar `novas`/`duplicatas`/`descartadas` dos `tracks` ao vivo (durante execução). `resultado.*` só é usado como mínimo no final.
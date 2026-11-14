# Processos com erro e relatório de importação melhor

## Os 7 processos com erro
Todos deram o mesmo erro: o número **já está cadastrado em outra coordenação**, e o sistema não aceita o mesmo número duas vezes.

| Linha | Processo |
|---|---|
| 4064 | 1013710-27.2024.8.26.0003 |
| 5442 | 0001925-57.2024.5.10.0011 |
| 6036 | 0000029-18.2025.8.12.0017 |
| 10095 | 0003828-43.2025.8.26.0126 |
| 11309 | 5129544-63.2026.8.09.0051 |
| 12393 | 5001446-88.2026.8.21.0063 |
| 13543 | 0018711-50.2023.8.26.0001 |

Nada foi alterado nas outras coordenações.

## O que muda
1. **Antes de gravar**, a importação verifica se o número já existe em outra coordenação. Esses processos não viram "erro": passam a sair como **"Existe em outra coordenação"**, mostrando o nome dela. A coordenação Santander Cível é adicionada como **coordenação responsável** do processo (sem duplicar nem mexer nos dados da outra equipe).
2. **Relatório mais claro**, com abas separadas:
   - **Resumo**: só os números principais, com cores (verde novos, azul corrigidos, laranja avisos, vermelho erros).
   - **Erros e atenção**: só os processos com problema, com explicação em português (nunca mensagem técnica).
   - **Clientes não encontrados**: um cliente por linha, com quantos processos ficaram sem cliente, em vez de dezenas de frases repetidas.
   - **Etiquetas não aplicadas**: processo e etiqueta que falharam (hoje só aparece o total de 306).
   - **Todos os processos**: lista completa com filtro e cores por resultado.
   - **Linhas ignoradas**: as 8 sem número.
3. Nomes de clientes combinados (ex.: "BANCO SANTANDER (BRASIL) S/A (Requerido), OSMAR ...") passam a usar o primeiro nome da lista, que costuma ser o cliente cadastrado.

## Pergunta em aberto
Para os 7 processos de outra coordenação: incluir o Santander Cível como coordenação responsável (proposto acima) ou só listá-los no relatório sem mexer?

## Detalhes técnicos
- `importacaoPlanilhaCompleta.ts`: antes do insert, consultar `processos` por número (dígitos) em todas as coordenações; para os de outras, inserir em `processos_coordenacoes_responsaveis` (on conflict nada) e registrar resultado `outra_coordenacao`. Traduzir erros 23505 e outros para texto amigável.
- Registrar falhas de etiqueta por processo/etiqueta; agrupar avisos de cliente com contagem.
- Gerador do Excel do relatório: novas abas, cores, autofiltro, larguras de coluna, cabeçalho congelado.
- Teste para tradução de erro e agrupamento de clientes.

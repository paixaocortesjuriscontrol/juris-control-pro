Plano para corrigir isso de verdade:

1. Tratar como bug de regra, não como instabilidade da API.
   - Conferi a coordenação `Coordenação Dr. Thomás` em `23/06/2026`.
   - Há diferença real por tipo: o Browser e o Servidor não estão classificando/validando exatamente do mesmo jeito.
   - Também há casos em que a mesma publicação aparece em um lado por um tipo e no outro lado por outro tipo, o que deixa o comparador confuso.

2. Igualar as regras de validação entre Browser e Servidor.
   - `parte`: validar contra partes estruturadas ou seção `Parte(s)`, sem aceitar cegamente tudo que a API devolve por `nomeParte` quando a própria publicação mostra que o nome está em advogado/texto e não em parte.
   - `advogado`: validar somente em metadados/lista de advogados, sem fallback amplo no corpo da publicação.
   - `palavra-chave`: validar somente no corpo da publicação, sem concatenar partes/advogados/destinatários.
   - `termos_or` de parte: o Browser deve limpar termos no formato `310314/NOME`, como o Servidor já faz, antes de mandar para `nomeParte`.

3. Corrigir o reaproveitamento para ser simétrico entre as duas fontes.
   - Hoje o reaproveitamento consulta principalmente `publicacoes_djen` e não espelha de forma consistente o que já caiu em `publicacoes_djen_servidor`.
   - Vou fazer Browser e Servidor consultarem as duas bases, validar novamente pela regra do monitoramento e só então persistir na própria origem.
   - Isso mantém isolamento por coordenação e evita que uma publicação encontrada pelo Servidor fique invisível para o Browser, ou vice-versa.

4. Ajustar o comparador para não mascarar o problema.
   - Manter a comparação por publicação única, mas adicionar/ajustar a visão por tipo real do monitoramento.
   - No CSV, incluir `monitoramento_id`, termo, condição concomitante e tipo original para explicar por que algo caiu como `parte`, `advogado` ou `palavra-chave`.
   - Isso evita conclusões erradas como “Servidor achou a mais por advogado” quando a mesma publicação existe do outro lado, mas em outro tipo.

5. Validar especificamente com Dr. Thomás em `23/06/2026`.
   - Reconsultar os totais por `parte`, `advogado` e `palavra-chave`.
   - Conferir os exclusivos por `id_djen` e por tipo.
   - Confirmar que as diferenças restantes sejam somente publicações realmente inexistentes no outro motor, não falha de classificação ou reaproveitamento.
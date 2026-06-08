O motivo é a fila atual estar agrupando o TRT10 como uma única unidade serial: primeiro `parte`, depois `advogado`, depois `palavra-chave`. Enquanto a unidade `TRT10/parte` está executando, `TRT10/advogado` e `TRT10/palavra-chave` aparecem como “Aguardando slot”, mas tecnicamente não estão disponíveis para outro worker pegar. Além disso, quando a fila da banda fica vazia e ainda há uma unidade em processamento, os outros workers ficam só aguardando a drenagem da banda.

Plano para corrigir:

1. Alterar o agendamento das bandas 1 e 2 para criar unidades por `tribunal + tipo`, em vez de uma única unidade por tribunal com steps seriais.
   - Exemplo atual: `TRT10 = [parte, advogado, palavra-chave]` em série.
   - Novo comportamento: `TRT10/parte`, `TRT10/advogado`, `TRT10/palavra-chave` como unidades independentes.

2. Manter a prioridade de tipos dentro de cada tribunal quando possível, mas sem bloquear slots livres.
   - `parte` continua entrando antes de `advogado`, e `advogado` antes de `palavra-chave` na fila.
   - Se houver worker livre, ele poderá executar outro tipo do mesmo tribunal em paralelo.

3. Ajustar o cálculo de total/progresso para contar essas unidades independentes corretamente.
   - A tela deixará de mostrar tipos pendentes “presos” quando houver worker disponível.

4. Preservar regras já críticas da DJEN Paralela:
   - `parte` continua usando somente `nomeParte`.
   - `continueUntilEmpty: true` permanece intacto.
   - Sem mexer no retry, deduplicação, Kurier, checkpoint ou gravação no banco.

Resultado esperado:
- No caso da imagem, enquanto `TRT10/parte` roda, `TRT10/advogado` e/ou `TRT10/palavra-chave` poderão ser pegos por outros workers se houver slot livre, em vez de aguardarem a finalização da busca por parte.